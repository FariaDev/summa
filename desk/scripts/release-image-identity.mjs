import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

function readElfBytes(fd, position, length) {
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const read = fs.readSync(fd, bytes, offset, length - offset, position + offset);
    if (!read) throw new Error('ELF truncado');
    offset += read;
  }
  return bytes;
}

function appImageOffset(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const length = fs.fstatSync(fd).size;
    if (length < 64) throw new Error('ELF64 little-endian ausente');
    const header = readElfBytes(fd, 0, 64);
    if (header.toString('hex', 0, 6) !== '7f454c460201') throw new Error('ELF64 little-endian ausente');
    const table = Number(header.readBigUInt64LE(40));
    const size = header.readUInt16LE(58), count = header.readUInt16LE(60);
    let end = table + size * count;
    if (!count || size < 64 || !Number.isSafeInteger(end) || table < 64 || end > length) throw new Error('tabela ELF inválida');
    const sections = readElfBytes(fd, table, size * count);
    for (let index = 0; index < count; index++) {
      const section = index * size;
      if (sections.readUInt32LE(section + 4) === 8) continue;
      const sectionEnd = Number(sections.readBigUInt64LE(section + 24)) + Number(sections.readBigUInt64LE(section + 32));
      if (!Number.isSafeInteger(sectionEnd) || sectionEnd > length) throw new Error('seção ELF inválida');
      end = Math.max(end, sectionEnd);
    }
    return end;
  } finally {
    fs.closeSync(fd);
  }
}

function appImagePackage(file, run) {
  const offset = appImageOffset(file);
  return run('unsquashfs', ['-o', String(offset), '-cat', file, 'resources/app/package.json'], {encoding:'utf8', stdio:['ignore','pipe','pipe'], maxBuffer:1024 * 1024});
}

function dmgPackage(file, run) {
  const mount = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-identity-'));
  let attached = false;
  try {
    run('hdiutil', ['attach', '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount, file], {stdio:'pipe'});
    attached = true;
    return fs.readFileSync(path.join(mount, 'Summa.app', 'Contents', 'Resources', 'app', 'package.json'), 'utf8');
  } finally {
    if (attached) run('hdiutil', ['detach', mount], {stdio:'pipe'});
    fs.rmdirSync(mount);
  }
}

/** Confere o package.json do payload sem executar código da imagem.
 * AppImage requer squashfs-tools; DMG requer hdiutil no macOS.
 * @param {string} file imagem produzida pelo build
 * @param {'AppImage'|'DMG'} kind formato da imagem
 * @param {{version:string,commit:string}} expected identidade da tag
 * @param {typeof execFileSync} [run] executor de ferramentas, substituível nos testes
 * @returns {void}
 * @example assertReleaseImageIdentity(file,'AppImage',{version:'1.3.3',commit:'a'.repeat(40)})
 */
export function assertReleaseImageIdentity(file, kind, expected, run = execFileSync) {
  const wanted = `summa ${expected.version}, commit ${expected.commit} quando embutido, no package.json do payload`;
  let identity;
  try { identity = JSON.parse(kind === 'AppImage' ? appImagePackage(file, run) : dmgPackage(file, run)); }
  catch (error) {
    const tool = kind === 'AppImage' ? 'unsquashfs (squashfs-tools)' : 'hdiutil (macOS)';
    const reason = error.code === 'ENOENT' ? `ferramenta ${tool} ausente` : 'imagem ilegível ou package.json inválido/ausente';
    throw new Error(`identidade ${kind}: recebido ${reason}; esperado ${wanted}`);
  }
  const received = identity && {name:identity.name, productName:identity.productName, version:identity.version, commit:identity.commit};
  if (identity?.name === 'summa' && (!Object.hasOwn(identity, 'productName') || identity.productName === 'Summa') && identity.version === expected.version &&
      (!Object.hasOwn(identity, 'commit') || identity.commit === expected.commit)) return;
  throw new Error(`identidade ${kind}: recebido ${JSON.stringify(received)}; esperado ${wanted}`);
}
