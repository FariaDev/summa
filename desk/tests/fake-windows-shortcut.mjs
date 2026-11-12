/* Fakes nomeados do `shell` e do `fs` para o atalho do menu Iniciar (#178).
   O teste de unidade os passa por parâmetro; `readShortcutLink` lança quando o
   .lnk não existe, como o Electron. */

/** shell do Electron com um .lnk em memória. */
export function fakeShortcutShell({shortcut = null, failWrite = false} = {}) {
  const state = {shortcut: shortcut && {...shortcut}, reads: [], writes: []};
  const shell = {
    reads: state.reads,
    writes: state.writes,
    get shortcut() { return state.shortcut; },
    readShortcutLink(file) {
      state.reads.push(file);
      if (!state.shortcut) throw Error(`atalho não existe: ${file}`);
      return {...state.shortcut};
    },
    writeShortcutLink(file, operation, details) {
      if (failWrite) throw Error('gravação recusada pelo fake');
      state.writes.push({file, operation, details: {...details}});
      state.shortcut = {...details};
      return true;
    },
  };
  return shell;
}

/** fs mínimo do atalho: registra as pastas criadas e as remoções, sem tocar no disco. */
export function fakeShortcutFs({files = []} = {}) {
  const dirs = [];
  const removed = [];
  const present = new Set(files);
  return {
    dirs,
    removed,
    mkdirSync: (dir, options) => { dirs.push({dir, options}); },
    existsSync: (file) => present.has(file),
    rmSync: (file, options) => { removed.push({file, options}); present.delete(file); },
  };
}
