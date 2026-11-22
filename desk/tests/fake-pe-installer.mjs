const align = value => (value + 3) & ~3;

function versionBlock(key, value = Buffer.alloc(0), children = [], text = false) {
  const name = Buffer.from(`${key}\0`, 'utf16le');
  const valueAt = align(6 + name.length);
  const childrenAt = align(valueAt + value.length);
  const size = childrenAt + children.reduce((sum, child) => sum + align(child.length), 0);
  const block = Buffer.alloc(size);
  block.writeUInt16LE(size);
  block.writeUInt16LE(text ? value.length / 2 : value.length, 2);
  block.writeUInt16LE(text ? 1 : 0, 4);
  name.copy(block, 6);
  value.copy(block, valueAt);
  let at = childrenAt;
  for (const child of children) { child.copy(block, at); at += align(child.length); }
  return block;
}

/** PE sintetico com RT_VERSION real, sem executavel nem ferramentas externas.
 * @param {{version?:string,commit?:string,pe64?:boolean}} options
 * @returns {Buffer}
 * @example fakePeInstaller({version:'1.2.3',commit:'a'.repeat(40)})
 */
export function fakePeInstaller({version = '0.1.0', commit = 'a'.repeat(40), pe64 = false} = {}) {
  const fields = {ProductName: 'Summa', ProductVersion: version, SummaCommit: commit};
  const strings = Object.entries(fields).map(([key, value]) => versionBlock(key, Buffer.from(`${value}\0`, 'utf16le'), [], true));
  const fixed = Buffer.alloc(52);
  const [major, minor, patch] = version.split('.').map(Number);
  fixed.writeUInt32LE(0xfeef04bd);
  fixed.writeUInt32LE(0x10000, 4);
  fixed.writeUInt32LE(major * 65536 + minor, 16);
  fixed.writeUInt32LE(patch * 65536, 20);
  const resource = versionBlock('VS_VERSION_INFO', fixed, [versionBlock('StringFileInfo', Buffer.alloc(0), [versionBlock('040904b0', Buffer.alloc(0), strings)])]);
  const file = Buffer.alloc(0x400 + resource.length);
  file.write('MZ'); file.writeUInt32LE(0x80, 0x3c); file.write('PE\0\0', 0x80);
  file.writeUInt16LE(1, 0x86);
  const optionalSize = pe64 ? 240 : 224;
  file.writeUInt16LE(optionalSize, 0x94);
  file.writeUInt16LE(pe64 ? 0x20b : 0x10b, 0x98);
  const directory = 0x98 + (pe64 ? 112 : 96);
  file.writeUInt32LE(16, directory - 4);
  file.writeUInt32LE(0x1000, directory + 16);
  file.writeUInt32LE(0x200 + resource.length, directory + 20);
  const section = 0x98 + optionalSize;
  file.write('.rsrc', section);
  file.writeUInt32LE(0x200 + resource.length, section + 8);
  file.writeUInt32LE(0x1000, section + 12);
  file.writeUInt32LE(0x200 + resource.length, section + 16);
  file.writeUInt32LE(0x200, section + 20);
  for (let depth = 0; depth < 3; depth++) {
    const at = 0x200 + depth * 24;
    file.writeUInt16LE(1, at + 14);
    file.writeUInt32LE(depth === 0 ? 16 : 1, at + 16);
    file.writeUInt32LE(depth < 2 ? (0x80000000 + (depth + 1) * 24) : 72, at + 20);
  }
  file.writeUInt32LE(0x1200, 0x248);
  file.writeUInt32LE(resource.length, 0x24c);
  resource.copy(file, 0x400);
  return file;
}
