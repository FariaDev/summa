import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';

/** Cria imagem com identidade controlada para o leitor de ferramentas falso.
 * @param {string} kind AppImage ou DMG
 * @param {object} identity package.json embutido
 * @returns {Buffer}
 * @example fakeReleaseImage('DMG', {name:'summa',version:'1.3.3'})
 */
export function fakeReleaseImage(kind, identity) {
  const header = Buffer.alloc(128);
  if (kind === 'AppImage') {
    header.write('\x7fELF', 0, 'binary');
    header[4] = 2;
    header[5] = 1;
    header.writeUInt32LE(64, 40);
    header.writeUInt16LE(64, 58);
    header.writeUInt16LE(1, 60);
  }
  return Buffer.concat([header, Buffer.from(JSON.stringify(identity))]);
}

const originalExec = childProcess.execFileSync;
function fakeImageTool(file, args, options) {
  if (file === 'unsquashfs') return fs.readFileSync(args[args.indexOf('-cat') + 1]).subarray(128).toString();
  if (file !== 'hdiutil') return originalExec(file, args, options);
  if (args[0] === 'detach') {
    fs.rmSync(path.join(args[1], 'Summa.app'), {recursive:true, force:true});
    return '';
  }
  const mount = args[args.indexOf('-mountpoint') + 1];
  const payload = path.join(mount, 'Summa.app', 'Contents', 'Resources', 'app');
  fs.mkdirSync(payload, {recursive:true});
  fs.writeFileSync(path.join(payload, 'package.json'), fs.readFileSync(args.at(-1)).subarray(128));
  return '';
}
if (process.argv[1]?.endsWith('update-release.mjs')) {
  childProcess.execFileSync = fakeImageTool;
  syncBuiltinESMExports();
}
