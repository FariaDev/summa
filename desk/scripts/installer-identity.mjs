/* Recursos PE lidos em Node: update:sign roda no macOS (#119, ADR 0006). */
const align = value => Math.ceil(value / 4) * 4;

function requireBytes(bytes, offset, size) {
  if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > bytes.length) throw Error('PE truncado');
}

function peResources(bytes) {
  requireBytes(bytes, 0, 64);
  if (bytes.toString('ascii', 0, 2) !== 'MZ') throw Error('assinatura MZ ausente');
  const pe = bytes.readUInt32LE(60);
  requireBytes(bytes, pe, 24);
  if (bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0') throw Error('assinatura PE ausente');
  const optional = pe + 24, size = bytes.readUInt16LE(pe + 20);
  requireBytes(bytes, optional, size);
  const magic = bytes.readUInt16LE(optional);
  const directories = magic === 0x10b ? 96 : magic === 0x20b ? 112 : 0;
  if (!directories || size < directories + 24 || bytes.readUInt32LE(optional + directories - 4) < 3) throw Error('diretorio PE ausente');
  const sections = optional + size, count = bytes.readUInt16LE(pe + 6);
  requireBytes(bytes, sections, count * 40);
  const locate = (rva, length) => {
    for (let i = 0; i < count; i++) {
      const at = sections + i * 40, start = bytes.readUInt32LE(at + 12), rawSize = bytes.readUInt32LE(at + 16);
      if (rva < start || rva - start + length > rawSize) continue;
      const offset = bytes.readUInt32LE(at + 20) + rva - start;
      requireBytes(bytes, offset, length);
      return bytes.subarray(offset, offset + length);
    }
    throw Error('RVA fora das secoes');
  };
  const resource = optional + directories + 16;
  return {root: locate(bytes.readUInt32LE(resource), bytes.readUInt32LE(resource + 4)), locate};
}

function resourceEntries(root, offset) {
  requireBytes(root, offset, 16);
  const count = root.readUInt16LE(offset + 12) + root.readUInt16LE(offset + 14);
  if (count > 256) throw Error('diretorio de recursos excessivo');
  requireBytes(root, offset + 16, count * 8);
  return Array.from({length: count}, (_, i) => {
    const at = offset + 16 + i * 8;
    return {id: root.readUInt32LE(at), target: root.readUInt32LE(at + 4)};
  });
}

function versionResources(bytes) {
  const {root, locate} = peResources(bytes);
  const versions = [];
  function walk(offset, depth) {
    if (versions.length > 32) throw Error('recursos de versao excessivos');
    for (const entry of resourceEntries(root, offset)) {
      if (depth === 0 && entry.id !== 16) continue;
      if (depth < 2) {
        if (!(entry.target & 0x80000000)) throw Error('arvore de recursos invalida');
        walk(entry.target & 0x7fffffff, depth + 1);
      } else {
        if (entry.target & 0x80000000) throw Error('recurso sem dados');
        requireBytes(root, entry.target, 16);
        versions.push(locate(root.readUInt32LE(entry.target), root.readUInt32LE(entry.target + 4)));
      }
    }
  }
  walk(0, 0);
  if (!versions.length) throw Error('RT_VERSION ausente');
  return versions;
}

function versionBlock(bytes, start, limit) {
  requireBytes(bytes, start, 6);
  const end = start + bytes.readUInt16LE(start), valueLength = bytes.readUInt16LE(start + 2);
  if (end <= start + 6 || end > limit) throw Error('bloco de versao invalido');
  let at = start + 6;
  while (at + 2 <= end && bytes.readUInt16LE(at) !== 0) at += 2;
  if (at + 2 > end) throw Error('chave sem terminador');
  const key = bytes.toString('utf16le', start + 6, at);
  const valueAt = align(at + 2), text = bytes.readUInt16LE(start + 4) === 1;
  const valueEnd = valueAt + valueLength * (text ? 2 : 1);
  if (valueEnd > end) throw Error('valor truncado');
  const children = [];
  for (at = align(valueEnd); at + 6 <= end;) {
    const child = versionBlock(bytes, at, end);
    children.push(child);
    at = align(child.end);
  }
  return {key, value: bytes.subarray(valueAt, valueEnd), children, end};
}

function identityOf(bytes) {
  const root = versionBlock(bytes, 0, bytes.length), fixed = root.value;
  if (root.key !== 'VS_VERSION_INFO' || fixed.length !== 52 || fixed.readUInt32LE(0) !== 0xfeef04bd) throw Error('VS_FIXEDFILEINFO ausente');
  const ms = fixed.readUInt32LE(16), ls = fixed.readUInt32LE(20);
  const version = `${ms >>> 16}.${ms & 65535}.${ls >>> 16}`;
  if (ls & 65535) throw Error('revisao inesperada');
  const tables = root.children.filter(child => child.key === 'StringFileInfo').flatMap(child => child.children);
  if (!tables.length) throw Error('StringFileInfo ausente');
  return tables.map(table => {
    const fields = new Map();
    for (const field of table.children) {
      if (fields.has(field.key)) throw Error('chave duplicada');
      fields.set(field.key, field.value.toString('utf16le').replace(/\0$/, ''));
    }
    return {version, productVersion: fields.get('ProductVersion'), product: fields.get('ProductName'), commit: fields.get('SummaCommit')};
  });
}

/** Confere a identidade embutida em todos os recursos RT_VERSION, sem executar o PE.
 * @param {Buffer} bytes instalador NSIS
 * @param {{version:string,commit:string}} expected versao e commit da tag
 * @returns {void}
 * @example assertInstallerIdentity(bytes,{version:'1.3.3',commit:'a'.repeat(40)})
 */
export function assertInstallerIdentity(bytes, expected) {
  const wanted = `Summa ${expected.version}, commit ${expected.commit}`;
  let identities;
  try { identities = versionResources(bytes).flatMap(identityOf); }
  catch { throw Error(`identidade do instalador: recebido PE inválido ou sem recurso de versão; esperado ${wanted} em RT_VERSION`); }
  for (const identity of identities) {
    if (identity.product === 'Summa' && identity.version === expected.version && identity.productVersion === expected.version && identity.commit === expected.commit) continue;
    throw Error(`identidade do instalador: recebido ${JSON.stringify(identity)}; esperado ${wanted} em RT_VERSION`);
  }
}
