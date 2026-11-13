/* Fake nomeado do fs para o bundle antigo (#190). O teste o passa por
   parâmetro; ele registra as chamadas e nunca toca no disco.
   `kind`: 'absent' (não existe), 'bundle' (diretório antigo) ou 'symlink'
   (link para `target`). `appBundle`: o `Contents/Info.plist` existe (#27). */
import path from 'node:path';

function enoent(file) {
  return Object.assign(Error(`ENOENT: no such file or directory, lstat '${file}'`), {code: 'ENOENT'});
}

/**
 * @param {{app?: string, legacy?: string, kind?: 'absent'|'bundle'|'symlink', target?: string, failRemove?: boolean, appBundle?: boolean}} [options]
 * @returns {{calls: {exists: string[], lstat: string[], realpath: string[], rm: {file: string, options: object}[], symlink: {target: string, link: string}[]}, existsSync: Function, lstatSync: Function, realpathSync: Function, rmSync: Function, symlinkSync: Function}}
 * @example fakeLegacyBundleFs({kind:'symlink',target:'/repo/Summa.app'})
 */
export function fakeLegacyBundleFs({
  app = '/repo/Summa.app',
  legacy = '/repo/Mesa de Estudos.app',
  kind = 'absent',
  target = '',
  failRemove = false,
  appBundle = false,
} = {}) {
  const calls = {exists: [], lstat: [], realpath: [], rm: [], symlink: []};
  const infoPlist = path.join(app, 'Contents', 'Info.plist');
  const realpath = (file) => {
    if (file === legacy) {
      if (kind === 'symlink') return target;
      if (kind === 'bundle') return legacy;
      throw enoent(file);
    }
    if (file === app) return app;
    throw enoent(file);
  };
  return {
    calls,
    existsSync(file) {
      calls.exists.push(file);
      return file === infoPlist && appBundle;
    },
    lstatSync(file) {
      calls.lstat.push(file);
      if (file === legacy && kind !== 'absent') return {isSymbolicLink: () => kind === 'symlink'};
      if (file === app) return {isSymbolicLink: () => false};
      throw enoent(file);
    },
    realpathSync(file) {
      calls.realpath.push(file);
      return realpath(file);
    },
    rmSync(file, options) {
      calls.rm.push({file, options});
      if (failRemove) throw Error('remoção recusada pelo fake');
    },
    symlinkSync(target, link) {
      calls.symlink.push({target, link});
    },
  };
}
