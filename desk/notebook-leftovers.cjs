// @ts-check
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* Limpeza única dos restos da biblioteca de cadernos (#50/#158/#159). Grava
   `runtime/.limpeza-cadernos-feita` e não repete; cada passo falha sozinho,
   só entra no log, e nada derruba o app. O plugin MesaPagina só cai quando é
   EXATAMENTE a instalação da Mesa: não é symlink, `.mesa-instalado.json`
   válido, hashes conferem e nenhum arquivo extra (a identidade do
   `xournal-plugin-host.cjs`, #133); senão fica intacto.

   Caminhos do código antigo: `notebook-ink-watch.cjs` (índice),
   `notebook-ink-wiring.cjs` (workspace) e `ink-convert-host.cjs` (ponte).
   O `runtime` do app é `envRuntime || config.runtimePath || <userData>/runtime` (`main.cjs`). */
const PLUGIN_NAME = 'MesaPagina';
const MANIFEST_NAME = '.mesa-instalado.json';
const MARKER_NAME = '.limpeza-cadernos-feita';
/* Área temporária da instalação, irmã de `<plugins>` (`xournal-plugin-host.cjs`
   na tag `cadernos-antes-do-xournal`): só a Mesa cria uma pasta com esse nome. */
const STAGING_AREA_NAME = '.mesa-instalacao';
const RUNTIME_LEFTOVERS = [
  ['notebook-ink', path.join('notebook-ink')],
  ['ink-convert-bridge.json', 'ink-convert-bridge.json'],
  ['opencode-workspaces/notebook-ink', path.join('opencode-workspaces', 'notebook-ink')],
];
/** @param {typeof import('node:fs')} fspkg @param {string} target @returns {'missing'|'symlink'|'dir'|'file'|'other'} */
function entryKind(fspkg, target) {
  try {
    const info = fspkg.lstatSync(target);
    if (info.isSymbolicLink()) return 'symlink';
    if (info.isDirectory()) return 'dir';
    if (info.isFile()) return 'file';
    return 'other';
  } catch (error) {
    if (/** @type {{code?: unknown}} */ (error)?.code === 'ENOENT') return 'missing';
    throw error;
  }
}
/** @param {unknown} error @returns {string} código curto, sem caminho pessoal */
function codeOf(error) {
  const code = /** @type {{code?: unknown}} */ (error)?.code;
  return typeof code === 'string' && code ? code : 'erro';
}
/** @param {unknown} name @returns {boolean} nome relativo seguro dentro da pasta do plugin */
function safeManifestName(name) {
  if (typeof name !== 'string' || !name || name === MANIFEST_NAME) return false;
  if (path.isAbsolute(name) || /^[A-Za-z]:/.test(name)) return false;
  return name.split(/[\\/]/).every((part) => part && part !== '.' && part !== '..');
}
/** @param {typeof import('node:fs')} fspkg @param {string} dir @returns {{version: string, files: Record<string, string>}|null} */
function readManifest(fspkg, dir) {
  const file = path.join(dir, MANIFEST_NAME);
  if (entryKind(fspkg, file) !== 'file') return null;
  try {
    const parsed = JSON.parse(fspkg.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (typeof parsed.version !== 'string' || !parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files)) return null;
    /** @type {Record<string, string>} */ const files = {};
    for (const [name, hash] of Object.entries(parsed.files)) {
      if (!safeManifestName(name) || typeof hash !== 'string') return null;
      files[name] = hash;
    }
    return {version: parsed.version, files};
  } catch {
    return null;
  }
}
/** @param {typeof import('node:fs')} fspkg @param {string} file @returns {string} */
function hashFile(fspkg, file) {
  return crypto.createHash('sha256').update(fspkg.readFileSync(file)).digest('hex');
}
/** @param {typeof import('node:fs')} fspkg @param {string} dir @param {Record<string, string>} manifestFiles @returns {boolean} */
function hashesMatch(fspkg, dir, manifestFiles) {
  for (const [name, expected] of Object.entries(manifestFiles)) {
    const file = path.join(dir, name);
    if (entryKind(fspkg, file) !== 'file' || hashFile(fspkg, file) !== expected) return false;
  }
  return true;
}
/** @param {typeof import('node:fs')} fspkg @param {string} dir @param {Record<string, string>} manifestFiles @returns {boolean} */
function hasNoExtra(fspkg, dir, manifestFiles) {
  const walk = (current, prefix) => {
    for (const entry of fspkg.readdirSync(current, {withFileTypes: true})) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const inside = Object.keys(manifestFiles).some((name) => name.startsWith(`${rel}/`));
        if (!inside || !walk(path.join(current, entry.name), rel)) return false;
        continue;
      }
      if (rel === MANIFEST_NAME) continue;
      if (entry.isSymbolicLink() || !(rel in manifestFiles)) return false;
    }
    return true;
  };
  return walk(dir, '');
}
/** @param {typeof import('node:fs')} fspkg @param {string} dir @returns {'missing'|'symlink'|'foreign'|'modified'|'ok'} */
function pluginVerdict(fspkg, dir) {
  const kind = entryKind(fspkg, dir);
  if (kind !== 'dir') return kind === 'missing' || kind === 'symlink' ? kind : 'foreign';
  const manifest = readManifest(fspkg, dir);
  if (!manifest) return 'foreign';
  if (!hashesMatch(fspkg, dir, manifest.files)) return 'modified';
  if (!hasNoExtra(fspkg, dir, manifest.files)) return 'modified';
  return 'ok';
}
/** @param {typeof import('node:fs')} fspkg @param {string} root @param {string} target @returns {boolean} */
function hasSymlinkParent(fspkg, root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return true;
  let current = root;
  for (const part of rel.split(path.sep).slice(0, -1)) {
    current = path.join(current, part);
    const kind = entryKind(fspkg, current);
    if (kind === 'missing') return false;
    if (kind !== 'dir') return true;
  }
  return false;
}
/** @param {typeof import('node:fs')} fspkg @param {string} runtimeDir @param {string} label @param {string} target @param {(line: string) => void} note @returns {'removed'|'kept'|'missing'} */
function removeRuntimeLeftover(fspkg, runtimeDir, label, target, note) {
  if (hasSymlinkParent(fspkg, runtimeDir, target)) {
    note(`${label} mantido (symlink no caminho)`);
    return 'kept';
  }
  const kind = entryKind(fspkg, target);
  if (kind === 'missing') return 'missing';
  if (kind === 'symlink') {
    note(`${label} mantido (symlink)`);
    return 'kept';
  }
  fspkg.rmSync(target, {recursive: kind === 'dir', force: true});
  note(`${label} apagado`);
  return 'removed';
}
/** @param {typeof import('node:fs')} fspkg @param {string} pluginDir @param {(line: string) => void} note @returns {'removed'|'kept'|'missing'} */
function cleanPlugin(fspkg, pluginDir, note) {
  const target = path.join(pluginDir, PLUGIN_NAME);
  const verdict = pluginVerdict(fspkg, target);
  if (verdict === 'missing') return 'missing';
  const where = `${PLUGIN_NAME} em ${path.basename(pluginDir)}`;
  if (verdict !== 'ok') {
    note(`${where} mantido (${verdict})`);
    return 'kept';
  }
  fspkg.rmSync(target, {recursive: true, force: true});
  note(`${where} apagado`);
  return 'removed';
}
/**
 * Limpa uma vez os restos da biblioteca de cadernos: `runtime/notebook-ink/`,
 * `runtime/ink-convert-bridge.json`, `runtime/opencode-workspaces/notebook-ink/`
 * a pasta `MesaPagina` de cada pasta de plugins do Xournal++ e a área
 * temporária `.mesa-instalacao` ao lado dela. Nunca toca em
 * `.xopp`, PDF nem fora desses caminhos; nunca segue symlink. Não lança; cada erro vai para `log` com o código, sem HOME.
 * @param {{fs?: typeof import('node:fs'), runtimeDir?: string, pluginDirs?: string[], log?: (line: string) => void}} input `fs`/`log` injetados; `pluginDirs` são as pastas de plugins do Xournal++
 * @returns {{ran: boolean, removed: string[], kept: string[]}} o que rodou e os nomes relativos apagados/mantidos
 * @example cleanNotebookLeftovers({fs, runtimeDir: '/home/u/.config/Mesa de Estudos/runtime', pluginDirs: ['/home/u/.config/xournalpp/plugins'], log: console.log});
 */
function cleanNotebookLeftovers({fs: fspkg = fs, runtimeDir, pluginDirs = [], log = () => {}} = {}) {
  /** @type {string[]} */ const removed = [];
  /** @type {string[]} */ const kept = [];
  const note = (line) => { try { log(`limpeza de cadernos: ${line}`); } catch { /* o log não pode derrubar a limpeza */ } };
  if (typeof runtimeDir !== 'string' || !runtimeDir) return {ran: false, removed, kept};
  const marker = path.join(runtimeDir, MARKER_NAME);
  try {
    if (entryKind(fspkg, marker) !== 'missing') return {ran: false, removed, kept};
  } catch (error) {
    note(`marcador não lido (${codeOf(error)})`);
  }
  for (const [label, relative] of RUNTIME_LEFTOVERS) {
    try {
      const result = removeRuntimeLeftover(fspkg, runtimeDir, label, path.join(runtimeDir, relative), note);
      if (result === 'removed') removed.push(label);
      else if (result === 'kept') kept.push(label);
    } catch (error) {
      note(`${label} não apagado (${codeOf(error)})`);
    }
  }
  for (const pluginDir of Array.isArray(pluginDirs) ? pluginDirs : []) {
    if (typeof pluginDir !== 'string' || !pluginDir) continue;
    const label = `${PLUGIN_NAME} em ${path.basename(pluginDir)}`;
    try {
      const result = cleanPlugin(fspkg, pluginDir, note);
      if (result === 'removed') removed.push(label);
      else if (result === 'kept') kept.push(label);
    } catch (error) {
      note(`${label} não apagado (${codeOf(error)})`);
    }
    const stagingLabel = `${STAGING_AREA_NAME} junto de ${path.basename(pluginDir)}`;
    try {
      const configDir = path.dirname(pluginDir);
      const result = removeRuntimeLeftover(fspkg, configDir, stagingLabel, path.join(configDir, STAGING_AREA_NAME), note);
      if (result === 'removed') removed.push(stagingLabel);
      else if (result === 'kept') kept.push(stagingLabel);
    } catch (error) {
      note(`${stagingLabel} não apagado (${codeOf(error)})`);
    }
  }
  try {
    fspkg.mkdirSync(runtimeDir, {recursive: true});
    fspkg.writeFileSync(marker, 'ok\n', {mode: 0o600});
  } catch (error) {
    note(`marcador não gravado (${codeOf(error)})`);
  }
  return {ran: true, removed, kept};
}

/**
 * Pasta de plugins do Xournal++ por SO, a mesma que o instalador antigo usava
 * (`pluginsDir` em `xournal-plugin-host.cjs`, tag `cadernos-antes-do-xournal`).
 * Vazio no Windows sem `LOCALAPPDATA`.
 * @param {{platform?: string, env?: Record<string, string|undefined>, homedir?: string}} [input]
 * @returns {string[]}
 * @example xournalPluginDirs({platform: 'linux', env: {}, homedir: '/home/u'}) // ['/home/u/.config/xournalpp/plugins']
 */
function xournalPluginDirs({platform = process.platform, env = process.env, homedir = os.homedir()} = {}) {
  const xdg = env.XDG_CONFIG_HOME;
  if (typeof xdg === 'string' && path.isAbsolute(xdg)) return [path.join(xdg, 'xournalpp', 'plugins')];
  if (platform === 'win32') return env.LOCALAPPDATA ? [path.join(env.LOCALAPPDATA, 'xournalpp', 'plugins')] : [];
  return [path.join(homedir, '.config', 'xournalpp', 'plugins')];
}

module.exports = {cleanNotebookLeftovers, xournalPluginDirs, MARKER_NAME};
