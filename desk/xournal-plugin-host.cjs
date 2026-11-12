// @ts-check
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {message} = require('./src/i18n.mjs');

/* Instala o plugin MesaPagina do Xournal++ por pedido explícito (#133): o
   aluno clica "Instalar plugin da página" na linha do Xournal++ do painel de
   Componentes e a pasta do plugin é copiada para a pasta de plugins do
   Xournal++. Nunca automático na partida; nunca escreve fora de
   `<plugins>/MesaPagina/` e da área de instalação; recusa pasta de outro
   autor sem tocar nela.

   Identidade (#133): a instalação grava `.mesa-instalado.json` na pasta com a
   versão e o sha256 de cada arquivo. Só é "nossa" a pasta cujo manifesto
   existe, cujos arquivos LISTADOS no manifesto conferem e que não tem arquivo
   extra — assim uma versão futura com um arquivo a mais continua
   reconhecendo a instalação antiga. Arquivo editado ou extra vira o estado
   novo "modificado" e a reinstalação recusa. Pasta sem manifesto é alheia —
   até quando o `plugin.ini` é igual ao da Mesa, porque essa fatia nunca foi
   publicada e o mais seguro é não tocar.

   Escrita atômica: tudo nasce na área de instalação
   `<config>/xournalpp/.mesa-instalacao/` (irmã de `<plugins>`, no mesmo
   sistema de arquivos, que o Xournal++ não varre) e entra por `rename` —
   instalação nova com um rename só; reinstalação com a antiga para a reserva,
   a nova para o lugar e só então o apagar da reserva. Antes de cada
   instalação a área é limpa; se sobrou reserva de um crash com `MesaPagina`
   ausente, ela é restaurada primeiro. Falha no meio restaura a antiga e
   apaga só o que esta tentativa criou.

   Symlinks (#133, revisão): os links ATÉ `plugins` inclusive são seguidos
   (gerenciadores de dotfiles apontam `~/.config` ou `xournalpp`); só é
   recusado symlink em `<plugins>/MesaPagina`, nos arquivos dentro dela
   (inclusive `.mesa-instalado.json`) e na área temporária.

   Os fatos (pasta por SO, estado, versão do nosso `plugin.ini` e da cópia)
   são do host; o que se mostra na tela é texto traduzível (locales). */

const PLUGIN_NAME = 'MesaPagina';
const PLUGIN_FILES = ['main.lua', 'tamanho.lua', 'converter.lua', 'ponte.lua', 'mesa-runtime.json', 'plugin.ini', 'README.md'];
const MANIFEST_NAME = '.mesa-instalado.json';
const STAGING_AREA_NAME = '.mesa-instalacao';
const LOCK_NAME = '.mesa-lock';
const LOCK_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * Pasta de plugins do Xournal++: `$XDG_CONFIG_HOME/xournalpp/plugins` quando
 * o `XDG_CONFIG_HOME` é absoluto (nos 3 sistemas, como o `g_get_user_config_dir`
 * do GLib — relativo é ignorado); sem ele, `~/.config/xournalpp/plugins`
 * (Linux/macOS) e `%LOCALAPPDATA%\xournalpp\plugins` (Windows); '' quando não
 * há onde instalar.
 * @param {{platform?: string, env?: NodeJS.ProcessEnv, homedir?: string}} input
 * @returns {string}
 * @example pluginsDir({platform: 'linux', env: {XDG_CONFIG_HOME: '/xdg'}, homedir: '/home/u'}) // '/xdg/xournalpp/plugins'
 */
function pluginsDir({platform = process.platform, env = process.env, homedir = os.homedir()} = {}) {
  const xdg = env.XDG_CONFIG_HOME;
  if (typeof xdg === 'string' && path.isAbsolute(xdg)) return path.join(xdg, 'xournalpp', 'plugins');
  if (platform === 'win32') return env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'xournalpp', 'plugins') : '';
  return path.join(homedir, '.config', 'xournalpp', 'plugins');
}

/**
 * Origem do plugin no repo: `desk/src/xournal-plugins/MesaPagina` (dentro de
 * `desk/` e de `src/`, para a regra da 0.5.0 já substituir pelo zip). No app
 * empacotado, o payload copia `src/` inteiro (`bundle-runtime.cjs`), então o
 * mesmo caminho serve nos dois casos — sem cópia separada.
 * @param {{deskDir?: string}} input
 * @returns {string}
 * @example resolvePluginSource({deskDir: '/app/desk'}) // '/app/desk/src/xournal-plugins/MesaPagina'
 */
function resolvePluginSource({deskDir = __dirname} = {}) {
  return path.join(deskDir, 'src', 'xournal-plugins', PLUGIN_NAME);
}

/**
 * Pasta de plugins com os links resolvidos até ela inclusive: quem aponta
 * `~/.config`, `xournalpp` ou `plugins` para outro lugar (dotfiles) é
 * seguido, e a área de instalação fica irmã da pasta REAL, no mesmo sistema
 * de arquivos do `rename`. Sem a pasta, devolve o caminho lógico.
 * @param {typeof fs} fspkg filesystem injetado
 * @param {string} dir pasta lógica de plugins
 * @returns {string}
 * @example realPluginsDir(fs, '/home/u/.config/xournalpp/plugins') // pasta real do link, ou a lógica
 */
function realPluginsDir(fspkg, dir) {
  try {
    return fspkg.realpathSync(dir);
  } catch {
    return dir;
  }
}

/**
 * Chaves `chave=valor` de um `plugin.ini` (sem cabeçalhos nem comentários);
 * as chaves saem em minúsculas e o valor, aparado.
 * @param {string} text conteúdo do `plugin.ini`
 * @returns {Record<string, string>}
 * @example parsePluginIni('[about]\nauthor=Lucas\nversion=1.0.0\n') // {author: 'Lucas', version: '1.0.0'}
 */
function parsePluginIni(text) {
  const out = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith('#') || entry.startsWith(';') || entry.startsWith('[')) continue;
    const eq = entry.indexOf('=');
    if (eq <= 0) continue;
    out[entry.slice(0, eq).trim().toLowerCase()] = entry.slice(eq + 1).trim();
  }
  return out;
}

function readIni(dir, fspkg) {
  const file = path.join(dir, 'plugin.ini');
  if (!fspkg.existsSync(file)) return null;
  try {
    return parsePluginIni(fspkg.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function bundledIni(source, fspkg) {
  return readIni(source, fspkg) || {};
}

function isSymlink(fspkg, file) {
  try {
    return fspkg.lstatSync(file).isSymbolicLink();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function fileHash(fspkg, file) {
  return crypto.createHash('sha256').update(fspkg.readFileSync(file)).digest('hex');
}

function readManifest(dir, fspkg) {
  const file = path.join(dir, MANIFEST_NAME);
  if (isSymlink(fspkg, file)) return null;
  if (!fspkg.existsSync(file)) return null;
  try {
    const data = JSON.parse(fspkg.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object' || typeof data.version !== 'string') return null;
    if (!data.files || typeof data.files !== 'object' || Array.isArray(data.files)) return null;
    for (const name of Object.keys(data.files)) if (typeof data.files[name] !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Arquivos (relativos, com `/`) de uma pasta, recursivo; uma entrada que é
 * symlink conta como arquivo e não é seguida.
 * @param {string} dir pasta a listar
 * @param {typeof fs} fspkg filesystem injetado
 * @returns {string[]}
 * @example listPluginFiles('/x/MesaPagina', fs) // ['.mesa-instalado.json', 'main.lua', ...]
 */
function listPluginFiles(dir, fspkg) {
  const out = [];
  const walk = (current, prefix) => {
    for (const entry of fspkg.readdirSync(current, {withFileTypes: true})) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
      else out.push(rel);
    }
  };
  walk(dir, '');
  return out.sort();
}

/**
 * @param {string} dir pasta instalada (`<plugins>/MesaPagina`)
 * @param {typeof fs} fspkg filesystem injetado
 * @param {string} bundledVersion versão da fonte (`version=` do `plugin.ini` da Mesa)
 * @returns {{status: 'missing'|'installed'|'different'|'modified'|'foreign'|'symlink', version: string}}
 */
function manifestStatus(dir, fspkg, bundledVersion) {
  if (isSymlink(fspkg, dir)) return {status: 'symlink', version: ''};
  if (!fspkg.existsSync(dir)) return {status: 'missing', version: ''};
  const manifest = readManifest(dir, fspkg);
  if (!manifest) return {status: 'foreign', version: ''};
  for (const name of Object.keys(manifest.files)) {
    const file = path.join(dir, name);
    if (!fspkg.existsSync(file) || isSymlink(fspkg, file) || fileHash(fspkg, file) !== manifest.files[name]) {
      return {status: 'modified', version: manifest.version};
    }
  }
  let actual;
  try {
    actual = listPluginFiles(dir, fspkg);
  } catch {
    return {status: 'modified', version: manifest.version};
  }
  if (actual.some((name) => name !== MANIFEST_NAME && !(name in manifest.files))) {
    return {status: 'modified', version: manifest.version};
  }
  return {status: manifest.version === bundledVersion ? 'installed' : 'different', version: manifest.version};
}

/**
 * Estado do plugin na pasta do Xournal++: `missing` (não instalado),
 * `installed`, `different` (instalado pela Mesa, versão diferente),
 * `modified` (instalado pela Mesa mas com um arquivo editado ou extra),
 * `foreign` (pasta de outro autor, ou sem manifesto — inclusive o legado não
 * publicado com `plugin.ini` igual ao da Mesa) e `symlink` (a pasta é um link
 * simbólico — inclusive quebrado). Só lê; nunca escreve.
 * @param {{fs?: typeof fs, platform?: string, env?: NodeJS.ProcessEnv, homedir?: string, source?: string}} input
 * @returns {{status: 'missing'|'installed'|'different'|'modified'|'foreign'|'symlink', version: string, bundled: string}}
 * @example pluginStatus({fs, platform: 'linux', env: {}, homedir: '/home/u', source: '/repo/desk/src/xournal-plugins/MesaPagina'})
 */
function pluginStatus({fs: fspkg = fs, platform = process.platform, env = process.env, homedir = os.homedir(), source = resolvePluginSource()} = {}) {
  const logical = pluginsDir({platform, env, homedir});
  const dir = logical ? realPluginsDir(fspkg, logical) : '';
  const target = dir ? path.join(dir, PLUGIN_NAME) : '';
  const bundled = bundledIni(source, fspkg);
  if (!target) return {status: 'missing', version: '', bundled: bundled.version ?? ''};
  const classified = manifestStatus(target, fspkg, bundled.version ?? '');
  return {status: classified.status, version: classified.version || readIni(target, fspkg)?.version || '', bundled: bundled.version ?? ''};
}

function toEnabled(iniText) {
  const text = String(iniText ?? '');
  if (/^enabled\s*=/m.test(text)) return text.replace(/^enabled\s*=.*$/m, 'enabled=true');
  return text.endsWith('\n') ? `${text}enabled=true\n` : `${text}\nenabled=true\n`;
}

function removeTree(fspkg, target) {
  try {
    fspkg.rmSync(target, {recursive: true, force: true});
  } catch { /* melhor esforço: a temporária não pode mascarar o erro original */ }
}

function stagingAreaDir(dir) {
  return path.join(path.dirname(dir), STAGING_AREA_NAME);
}

function stagingName(area) {
  return path.join(area, `.mesa-install-${crypto.randomBytes(6).toString('hex')}`);
}

function backupName(area) {
  return path.join(area, `.mesa-backup-${crypto.randomBytes(6).toString('hex')}`);
}

function lockPathFor(area) {
  return path.join(area, LOCK_NAME);
}

function releaseInstallLock(fspkg, lockPath) {
  if (!lockPath) return;
  try {
    fspkg.rmSync(lockPath, {recursive: true, force: true});
  } catch { /* melhor esforço: o lock velho quebra em 2 min */ }
}

function acquireInstallLock(fspkg, area) {
  if (fspkg.existsSync(area) && isSymlink(fspkg, area)) throw Error(message('component.plugin.symlink'));
  fspkg.mkdirSync(area, {recursive: true});
  if (isSymlink(fspkg, area)) throw Error(message('component.plugin.symlink'));
  const lockPath = lockPathFor(area);
  const tryCreate = () => fspkg.mkdirSync(lockPath);
  try {
    tryCreate();
    return lockPath;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  let mtimeMs;
  try {
    mtimeMs = fspkg.lstatSync(lockPath).mtimeMs;
  } catch {
    try {
      tryCreate();
      return lockPath;
    } catch (retryError) {
      if (retryError?.code !== 'EEXIST') throw retryError;
      throw Error(message('component.plugin.locked'));
    }
  }
  if (Date.now() - mtimeMs < LOCK_MAX_AGE_MS) throw Error(message('component.plugin.locked'));
  try {
    fspkg.rmSync(lockPath, {recursive: true, force: true});
  } catch { /* segue para tentar criar; o EEXIST abaixo vira locked */ }
  try {
    tryCreate();
  } catch (error) {
    if (error?.code === 'EEXIST') throw Error(message('component.plugin.locked'));
    throw error;
  }
  return lockPath;
}

/* Limpa a área de instalação antes de cada instalação: apaga só o que é da
   Mesa (`.mesa-install-*` e `.mesa-backup-*`) que sobrou de um crash — menos
   a reserva quando `MesaPagina` não existe, que é restaurada para o lugar
   primeiro (senão a versão anterior se perderia). Qualquer outra entrada
   segue intacta. A área em si sendo symlink é recusada antes de apagar
   qualquer coisa. */
function cleanupStagingArea(fspkg, area, dir, target) {
  if (!fspkg.existsSync(area)) return;
  if (isSymlink(fspkg, area)) throw Error(message('component.plugin.symlink'));
  let entries;
  try {
    entries = fspkg.readdirSync(area);
  } catch {
    return;
  }
  let remaining = entries;
  if (!fspkg.existsSync(target)) {
    const backupEntry = entries.find((name) => name.startsWith('.mesa-backup-'));
    if (backupEntry) {
      const backupPath = path.join(area, backupEntry);
      if (isSymlink(fspkg, backupPath)) throw Error(message('component.plugin.symlink'));
      fspkg.mkdirSync(dir, {recursive: true});
      fspkg.renameSync(backupPath, target);
      remaining = entries.filter((name) => name !== backupEntry);
    }
  }
  for (const entry of remaining) {
    if (!entry.startsWith('.mesa-install-') && !entry.startsWith('.mesa-backup-')) continue;
    removeTree(fspkg, path.join(area, entry));
  }
}

/* Recusa symlink em qualquer arquivo dentro de `MesaPagina` (inclusive o
   manifesto `.mesa-instalado.json`): a mensagem é a de symlink, nunca a de
   pasta alheia. */
function assertNoSymlinkInside(fspkg, target) {
  const walk = (current) => {
    for (const entry of fspkg.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink() || isSymlink(fspkg, full)) throw Error(message('component.plugin.symlink'));
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(target);
}

function stagePlugin(fspkg, staging, source, version, runtimePath) {
  /* O `runtime` pode chegar relativo (config, teste ou CLI): o plugin roda
     com o cwd do Xournal++, então grava sempre absoluto (#159, revisão). */
  const absoluteRuntime = runtimePath ? path.resolve(runtimePath) : '';
  for (const file of PLUGIN_FILES) {
    if (file === 'plugin.ini') {
      fspkg.writeFileSync(path.join(staging, file), toEnabled(fspkg.readFileSync(path.join(source, file), 'utf8')));
    } else if (file === 'mesa-runtime.json') {
      /* O caminho do runtime é da instalação da Mesa (nunca fixo nem do
         repo): o plugin lê a ponte (`ink-convert-bridge.json`) da pasta que
         a Mesa grava aqui ao instalar (#159). */
      fspkg.writeFileSync(path.join(staging, file), `${JSON.stringify({runtime: absoluteRuntime}, null, 2)}\n`);
    } else {
      fspkg.copyFileSync(path.join(source, file), path.join(staging, file));
    }
  }
  const files = {};
  for (const file of PLUGIN_FILES) files[file] = fileHash(fspkg, path.join(staging, file));
  fspkg.writeFileSync(path.join(staging, MANIFEST_NAME), `${JSON.stringify({version, files}, null, 2)}\n`);
}

function swapIntoPlace(fspkg, area, target, staging, upgraded) {
  if (!upgraded) {
    fspkg.renameSync(staging, target);
    return;
  }
  const backup = backupName(area);
  fspkg.renameSync(target, backup);
  try {
    fspkg.renameSync(staging, target);
  } catch (swapError) {
    try {
      fspkg.renameSync(backup, target);
    } catch {
      swapError.reserveKept = true;
      throw swapError;
    }
    throw swapError;
  }
  removeTree(fspkg, backup);
}

/**
 * Copia o plugin para `<plugins>/MesaPagina/` com `enabled=true` na cópia do
 * `plugin.ini`, o caminho do runtime gravado no `mesa-runtime.json` (#159) e
 * o manifesto `.mesa-instalado.json`. A escrita é atômica:
 * tudo nasce na área de instalação irmã de `<plugins>` e entra por `rename`.
 * Pasta de outro autor (e pasta nossa editada ou com extra, "modificada") é
 * recusada antes de escrever qualquer arquivo.
 * @param {{fs?: typeof fs, platform?: string, env?: NodeJS.ProcessEnv, homedir?: string, source?: string, runtime?: string}} input
 * @returns {{ok: true, upgraded: boolean, version: string}}
 * @example installXournalPlugin({fs, platform: 'linux', env: {}, homedir: '/home/u', source: '/repo/desk/src/xournal-plugins/MesaPagina', runtime: '/home/u/.runtime'})
 */
function installXournalPlugin({fs: fspkg = fs, platform = process.platform, env = process.env, homedir = os.homedir(), source = resolvePluginSource(), runtime = ''} = {}) {
  const logical = pluginsDir({platform, env, homedir});
  if (!logical) throw Error(message('component.plugin.noFolder'));
  for (const file of PLUGIN_FILES) {
    if (!fspkg.existsSync(path.join(source, file))) throw Error(message('component.plugin.installFailed', {file}));
  }
  let dir = realPluginsDir(fspkg, logical);
  let target = path.join(dir, PLUGIN_NAME);
  let area = stagingAreaDir(dir);
  /** @type {string} */
  let lockPath;
  try {
    lockPath = acquireInstallLock(fspkg, area);
  } catch (error) {
    const raw = String(error?.message ?? error);
    if (raw.includes('component.plugin.symlink') || raw.includes('component.plugin.locked')) throw error;
    throw Error(message('component.plugin.installFailed', {file: PLUGIN_NAME}));
  }
  let staging = '';
  let stagingCreated = false;
  try {
    try {
      cleanupStagingArea(fspkg, area, dir, target);
    } catch (error) {
      const raw = String(error?.message ?? error);
      if (raw.includes('component.plugin.symlink') || raw.includes('component.plugin.locked')) throw error;
      throw Error(message('component.plugin.installFailed', {file: PLUGIN_NAME}));
    }
    dir = realPluginsDir(fspkg, logical);
    target = path.join(dir, PLUGIN_NAME);
    const upgraded = fspkg.existsSync(target) || isSymlink(fspkg, target);
    const bundled = bundledIni(source, fspkg);
    if (upgraded) {
      if (isSymlink(fspkg, target)) throw Error(message('component.plugin.symlink'));
      assertNoSymlinkInside(fspkg, target);
      const {status} = manifestStatus(target, fspkg, bundled.version ?? '');
      if (status === 'symlink') throw Error(message('component.plugin.symlink'));
      if (status === 'foreign') throw Error(message('component.plugin.foreign'));
      if (status === 'modified') throw Error(message('component.plugin.modifiedError'));
    }
    try {
      fspkg.mkdirSync(dir, {recursive: true});
      dir = realPluginsDir(fspkg, logical);
      target = path.join(dir, PLUGIN_NAME);
      area = stagingAreaDir(dir);
      if (fspkg.existsSync(area) && isSymlink(fspkg, area)) throw Error(message('component.plugin.symlink'));
      fspkg.mkdirSync(area, {recursive: true});
      staging = stagingName(area);
      fspkg.mkdirSync(staging, {recursive: false});
      stagingCreated = true;
      stagePlugin(fspkg, staging, source, bundled.version ?? '', runtime);
      swapIntoPlace(fspkg, area, target, staging, upgraded);
    } catch (error) {
      if (stagingCreated) removeTree(fspkg, staging);
      const raw = String(error?.message ?? error);
      if (raw.includes('component.plugin.symlink') || raw.includes('component.plugin.locked')) throw error;
      if (error?.reserveKept) throw Error(message('component.plugin.installFailedReserve', {file: PLUGIN_NAME}));
      throw Error(message('component.plugin.installFailed', {file: error?.code === 'ENOENT' ? 'arquivo do plugin' : PLUGIN_NAME}));
    }
    return {ok: true, upgraded, version: bundled.version ?? ''};
  } finally {
    releaseInstallLock(fspkg, lockPath);
  }
}

/**
 * Registra `xournal-plugin-install` no main (instalação só pelo clique).
 * @param {{ipcMain: {handle: (channel: string, listener: (event: Electron.IpcMainInvokeEvent) => unknown) => void}, deskDir?: string, env?: NodeJS.ProcessEnv, runtime?: string, allowSender?: (event: Electron.IpcMainInvokeEvent) => boolean}} input
 * @example registerXournalPluginHost({ipcMain, deskDir: __dirname, env: process.env, runtime, allowSender: trustedMainSender})
 */
function registerXournalPluginHost(input) {
  const {ipcMain, deskDir, env = process.env, runtime = '', allowSender = () => true} = input || {};
  const source = () => resolvePluginSource({deskDir: deskDir ?? __dirname});
  const home = () => os.homedir();
  ipcMain.handle('xournal-plugin-install', (event) => {
    if (!allowSender(event)) throw Error(message('err.ipc.senderDenied', {channel: 'xournal-plugin-install'}));
    return installXournalPlugin({fs, platform: process.platform, env, homedir: home(), source: source(), runtime});
  });
}

module.exports = {PLUGIN_NAME, PLUGIN_FILES, pluginsDir, resolvePluginSource, parsePluginIni, pluginStatus, installXournalPlugin, registerXournalPluginHost};
