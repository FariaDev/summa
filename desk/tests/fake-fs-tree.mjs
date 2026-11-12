import path from 'node:path';

/* Árvore de `fs` falsa da biblioteca de cadernos (#133): só `readdirSync`/
   `statSync`/`realpathSync`/`existsSync`. Não há `readFileSync` de verdade —
   há uma armadilha que registra e explode, então ler o conteúdo de um `.xopp`
   quebra o teste em vez de passar em silêncio. `calls` guarda cada chamada
   para o teste provar que nada além de stat/readdir/realpath foi chamado. */
export function fakeFsTree(roots, {symlinks = {}} = {}) {
  const nodes = new Map();
  const calls = [];
  const root = path.normalize('/');
  nodes.set(root, {type: 'dir', entries: []});

  function ensureDir(dir) {
    const key = path.normalize(dir);
    if (nodes.has(key)) return;
    const parent = path.dirname(key);
    if (parent !== key) ensureDir(parent);
    const name = path.basename(key);
    const parentNode = nodes.get(parent);
    if (parentNode && !parentNode.entries.includes(name)) parentNode.entries.push(name);
    nodes.set(key, {type: 'dir', entries: []});
  }

  function build(dirPath, spec) {
    ensureDir(dirPath);
    for (const [name, value] of Object.entries(spec || {})) {
      const full = path.join(dirPath, name);
      if (value && typeof value === 'object') {
        build(full, value);
      } else {
        nodes.set(path.normalize(full), {type: 'file', mtimeMs: typeof value === 'number' ? value : 0});
        const dirNode = nodes.get(path.normalize(dirPath));
        if (!dirNode.entries.includes(name)) dirNode.entries.push(name);
      }
    }
  }

  for (const [root, spec] of Object.entries(roots)) build(root, spec);

  for (const [link, target] of Object.entries(symlinks)) {
    ensureDir(path.dirname(path.normalize(link)));
    nodes.set(path.normalize(link), {type: 'link', target: path.normalize(target)});
    const parentNode = nodes.get(path.dirname(path.normalize(link)));
    const name = path.basename(path.normalize(link));
    if (!parentNode.entries.includes(name)) parentNode.entries.push(name);
  }

  function resolve(p, depth = 0) {
    if (depth > 10) throw Error(`laço de symlink em ${p}`);
    const node = nodes.get(path.normalize(p));
    if (!node) throw Error(`ENOENT ${p}`);
    if (node.type === 'link') return resolve(node.target, depth + 1);
    return path.normalize(p);
  }

  function statSync(p) {
    calls.push(['statSync', String(p)]);
    const node = nodes.get(resolve(p));
    return {
      isDirectory: () => node.type === 'dir',
      isFile: () => node.type === 'file',
      mtimeMs: node.mtimeMs || 0,
    };
  }

  function readdirSync(dir) {
    calls.push(['readdirSync', String(dir)]);
    const node = nodes.get(resolve(dir));
    if (node.type !== 'dir') throw Error(`ENOTDIR ${dir}`);
    return [...node.entries];
  }

  function realpathSync(p) {
    calls.push(['realpathSync', String(p)]);
    return resolve(p);
  }
  realpathSync.native = realpathSync;

  function existsSync(p) {
    calls.push(['existsSync', String(p)]);
    try {
      resolve(p);
      return true;
    } catch {
      return false;
    }
  }

  function readFileSync() {
    calls.push(['readFileSync', 'CONTEÚDO']);
    throw Error('fake-fs-tree: nenhum arquivo é lido na biblioteca de cadernos');
  }

  return {statSync, readdirSync, realpathSync, existsSync, readFileSync, calls};
}
