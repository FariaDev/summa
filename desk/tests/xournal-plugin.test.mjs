import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';
import {ptMatches, ptText} from './pt-text.mjs';
import {fakeFailingFs} from './fake-failing-fs.mjs';

/* Instalação do plugin MesaPagina pelo painel de Componentes (#133): o host
   copia só os arquivos do plugin para `<plugins>/MesaPagina/`, com
   `enabled=true` na cópia; recusa a pasta de outro autor sem tocar em nada.
   Tudo num temporário próprio e na fonte do repo (lida, nunca escrita). */
const require = createRequire(import.meta.url);
const pluginHost = require('../xournal-plugin-host.cjs');
const components = require('../components.cjs');
const rules050 = require('./fixtures/updater-rules-0.5.0.cjs');

const DESK_DIR = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE = path.resolve(import.meta.dirname, '..', 'src', 'xournal-plugins', 'MesaPagina');
const tmp = () => tempDir('mesa-xournal-plugin');
const depsFor = (home, extra = {}) => ({fs, platform: 'linux', env: {}, homedir: home, source: SOURCE, ...extra});

const listTree = (root) => {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else out.push(rel);
    }
  };
  walk(root, '');
  return out.sort();
};

const sourceIni = fs.readFileSync(path.join(SOURCE, 'plugin.ini'), 'utf8');

test('pluginsDir: linux/darwin em ~/.config/xournalpp/plugins, win32 em %LOCALAPPDATA%', () => {
  assert.equal(pluginHost.pluginsDir({platform: 'linux', env: {}, homedir: '/h'}), path.join('/h', '.config', 'xournalpp', 'plugins'));
  assert.equal(pluginHost.pluginsDir({platform: 'darwin', env: {}, homedir: '/h'}), path.join('/h', '.config', 'xournalpp', 'plugins'));
  assert.equal(pluginHost.pluginsDir({platform: 'win32', env: {LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local'}, homedir: 'C:\\Users\\u'}), path.join('C:\\Users\\u\\AppData\\Local', 'xournalpp', 'plugins'));
  assert.equal(pluginHost.pluginsDir({platform: 'win32', env: {}, homedir: 'C:\\Users\\u'}), '', 'sem LOCALAPPDATA não há onde instalar no Windows');
});

test('instala em pasta vazia: 7 arquivos, enabled=true na cópia, fonte intacta', () => {
  const home = tmp();
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.ok, true);
  assert.equal(result.upgraded, false);
  const dir = path.join(home, '.config', 'xournalpp', 'plugins', 'MesaPagina');
  assert.deepEqual(listTree(dir), ['.mesa-instalado.json', 'README.md', 'converter.lua', 'main.lua', 'mesa-runtime.json', 'plugin.ini', 'ponte.lua', 'tamanho.lua']);
  const copiedIni = fs.readFileSync(path.join(dir, 'plugin.ini'), 'utf8');
  assert.match(copiedIni, /^enabled=true$/m, 'a cópia nasce ligada');
  assert.equal(fs.readFileSync(path.join(SOURCE, 'plugin.ini'), 'utf8'), sourceIni, 'o repo segue enabled=false');
  assert.match(sourceIni, /^enabled=false$/m);
  for (const file of ['main.lua', 'tamanho.lua', 'converter.lua', 'ponte.lua', 'README.md']) {
    assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), fs.readFileSync(path.join(SOURCE, file), 'utf8'));
  }
});

test('reinstala por cima da nossa versão intacta e atualiza (upgraded)', () => {
  const home = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = path.join(home, '.config', 'xournalpp', 'plugins', 'MesaPagina');
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.upgraded, true);
  assert.equal(fs.readFileSync(path.join(dir, 'main.lua'), 'utf8'), fs.readFileSync(path.join(SOURCE, 'main.lua'), 'utf8'));
  assert.match(fs.readFileSync(path.join(dir, 'plugin.ini'), 'utf8'), /version=1\.1\.0/);
});

test('recusa MesaPagina de outro autor sem tocar em nada', () => {
  const home = tmp();
  const dir = path.join(home, '.config', 'xournalpp', 'plugins', 'MesaPagina');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'plugin.ini'), '[about]\nauthor=Outra Pessoa\ndescription=Outro plugin\nversion=9.9.9\n\n[default]\nenabled=false\n\n[plugin]\nmainfile=outro.lua\n');
  fs.writeFileSync(path.join(dir, 'outro.lua'), '-- não tocar\n');
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home)), ptMatches(/outro autor/), 'a recusa diz o motivo');
  assert.deepEqual(listTree(dir), ['outro.lua', 'plugin.ini'], 'nada criado nem apagado');
  assert.equal(fs.readFileSync(path.join(dir, 'outro.lua'), 'utf8'), '-- não tocar\n');
});

test('estado: não instalado / instalado / versão diferente (manifesto, não plugin.ini)', () => {
  const home = tmp();
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'missing');
  pluginHost.installXournalPlugin(depsFor(home, {source: oldSource()}));
  const different = pluginHost.pluginStatus(depsFor(home));
  assert.equal(different.status, 'different');
  assert.equal(different.version, '0.9.0');
  pluginHost.installXournalPlugin(depsFor(home));
  const installed = pluginHost.pluginStatus(depsFor(home));
  assert.equal(installed.status, 'installed');
  assert.equal(installed.version, '1.1.0');
});

test('nada é escrito fora de <pasta>/MesaPagina/', () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, 'outra'), {recursive: true});
  fs.writeFileSync(path.join(home, 'outra', 'sentinela.txt'), 'não tocar');
  fs.writeFileSync(path.join(home, 'sentinela-raiz.txt'), 'não tocar');
  pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(fs.readFileSync(path.join(home, 'outra', 'sentinela.txt'), 'utf8'), 'não tocar');
  assert.equal(fs.readFileSync(path.join(home, 'sentinela-raiz.txt'), 'utf8'), 'não tocar');
  assert.deepEqual(listTree(home), [
    '.config/xournalpp/plugins/MesaPagina/.mesa-instalado.json',
    '.config/xournalpp/plugins/MesaPagina/README.md',
    '.config/xournalpp/plugins/MesaPagina/converter.lua',
    '.config/xournalpp/plugins/MesaPagina/main.lua',
    '.config/xournalpp/plugins/MesaPagina/mesa-runtime.json',
    '.config/xournalpp/plugins/MesaPagina/plugin.ini',
    '.config/xournalpp/plugins/MesaPagina/ponte.lua',
    '.config/xournalpp/plugins/MesaPagina/tamanho.lua',
    'outra/sentinela.txt',
    'sentinela-raiz.txt',
  ]);
});

const targetOf = (home) => path.join(home, '.config', 'xournalpp', 'plugins', 'MesaPagina');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const oldSource = () => {
  const dir = tmp();
  for (const file of ['main.lua', 'tamanho.lua', 'converter.lua', 'ponte.lua', 'mesa-runtime.json', 'README.md']) fs.copyFileSync(path.join(SOURCE, file), path.join(dir, file));
  fs.writeFileSync(path.join(dir, 'plugin.ini'), sourceIni.replace('version=1.1.0', 'version=0.9.0'));
  return dir;
};

test('pluginsDir: XDG_CONFIG_HOME absoluto vale nos 3 sistemas (GLib)', () => {
  assert.equal(pluginHost.pluginsDir({platform: 'linux', env: {XDG_CONFIG_HOME: '/xdg'}, homedir: '/h'}), path.join('/xdg', 'xournalpp', 'plugins'));
  assert.equal(pluginHost.pluginsDir({platform: 'darwin', env: {XDG_CONFIG_HOME: '/xdg'}, homedir: '/h'}), path.join('/xdg', 'xournalpp', 'plugins'));
  assert.equal(pluginHost.pluginsDir({platform: 'win32', env: {XDG_CONFIG_HOME: '/xdg', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local'}, homedir: 'C:\\Users\\u'}), path.join('/xdg', 'xournalpp', 'plugins'));
  assert.equal(pluginHost.pluginsDir({platform: 'linux', env: {XDG_CONFIG_HOME: 'relativo'}, homedir: '/h'}), path.join('/h', '.config', 'xournalpp', 'plugins'), 'XDG relativo é ignorado (GLib)');
  assert.equal(pluginHost.pluginsDir({platform: 'win32', env: {XDG_CONFIG_HOME: 'relativo', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local'}, homedir: 'C:\\Users\\u'}), path.join('C:\\Users\\u\\AppData\\Local', 'xournalpp', 'plugins'));
});

test('instala sob XDG_CONFIG_HOME quando ele é absoluto', () => {
  const home = tmp();
  const xdg = tmp();
  const result = pluginHost.installXournalPlugin(depsFor(home, {env: {XDG_CONFIG_HOME: xdg}}));
  assert.equal(result.ok, true);
  assert.deepEqual(listTree(path.join(xdg, 'xournalpp', 'plugins', 'MesaPagina')), ['.mesa-instalado.json', 'README.md', 'converter.lua', 'main.lua', 'mesa-runtime.json', 'plugin.ini', 'ponte.lua', 'tamanho.lua']);
  assert.equal(fs.existsSync(path.join(home, '.config')), false, 'nada vai para o HOME quando há XDG');
});

test('recusa symlink em MesaPagina sem tocar no alvo e sem vazar caminho', () => {
  const home = tmp();
  const outside = tmp();
  fs.writeFileSync(path.join(outside, 'alvo.txt'), 'não tocar');
  fs.mkdirSync(path.join(home, '.config', 'xournalpp', 'plugins'), {recursive: true});
  fs.symlinkSync(outside, targetOf(home), 'dir');
  const deps = depsFor(home);
  assert.throws(() => pluginHost.installXournalPlugin(deps), (error) => {
    const raw = String(error?.message ?? error);
    return /link simbólico/i.test(ptText(raw)) && !raw.includes(String(outside)) && !raw.includes(home);
  });
  assert.equal(fs.readFileSync(path.join(outside, 'alvo.txt'), 'utf8'), 'não tocar');
  assert.deepEqual(listTree(outside), ['alvo.txt']);
});

test('recusa symlink num arquivo de destino, mas segue symlink num pai dentro de xournalpp', () => {
  const home = tmp();
  const outside = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = targetOf(home);
  fs.rmSync(path.join(dir, 'main.lua'));
  fs.symlinkSync(path.join(outside, 'fora.lua'), path.join(dir, 'main.lua'));
  fs.writeFileSync(path.join(outside, 'fora.lua'), 'fora');
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home)), ptMatches(/link simbólico/i));
  assert.equal(fs.readFileSync(path.join(outside, 'fora.lua'), 'utf8'), 'fora', 'o alvo do link segue intacto');

  const home2 = tmp();
  const outside2 = tmp();
  fs.mkdirSync(path.join(home2, '.config'), {recursive: true});
  fs.symlinkSync(outside2, path.join(home2, '.config', 'xournalpp'), 'dir');
  const result = pluginHost.installXournalPlugin(depsFor(home2));
  assert.equal(result.ok, true, 'pai por symlink é seguido (dotfiles apontam ~/.config ou xournalpp)');
  assert.equal(fs.existsSync(path.join(outside2, 'plugins', 'MesaPagina', 'main.lua')), true);
  assert.equal(pluginHost.pluginStatus(depsFor(home2)).status, 'installed');
});

test('instalação grava o manifesto .mesa-instalado.json com versão e sha256', () => {
  const home = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = targetOf(home);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.mesa-instalado.json'), 'utf8'));
  assert.equal(manifest.version, '1.1.0');
  assert.deepEqual(Object.keys(manifest.files).sort(), ['README.md', 'converter.lua', 'main.lua', 'mesa-runtime.json', 'plugin.ini', 'ponte.lua', 'tamanho.lua']);
  for (const file of pluginHost.PLUGIN_FILES) assert.equal(manifest.files[file], sha256(path.join(dir, file)), `hash de ${file}`);
});

test('instalação grava o runtime da Mesa no mesa-runtime.json (#159)', () => {
  const home = tmp();
  const runtimeAlvo = path.join(tmp(), '.runtime');
  pluginHost.installXournalPlugin(depsFor(home, {runtime: runtimeAlvo}));
  const dir = targetOf(home);
  const gravado = JSON.parse(fs.readFileSync(path.join(dir, 'mesa-runtime.json'), 'utf8'));
  assert.equal(gravado.runtime, runtimeAlvo, 'o plugin encontra a ponte pela pasta gravada');
  const fonte = JSON.parse(fs.readFileSync(path.join(SOURCE, 'mesa-runtime.json'), 'utf8'));
  assert.equal(fonte.runtime, '', 'o repo segue com o runtime vazio (sem caminho fixo)');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed', 'com runtime gravado a pasta continua "nossa"');
});

test('mesa-runtime.json grava o runtime como caminho absoluto (#159)', () => {
  const home = tmp();
  const relativo = path.join('runtime-relativo', 'mesa');
  pluginHost.installXournalPlugin(depsFor(home, {runtime: relativo}));
  const gravado = JSON.parse(fs.readFileSync(path.join(targetOf(home), 'mesa-runtime.json'), 'utf8'));
  assert.equal(gravado.runtime, path.resolve(relativo), 'o plugin acha a ponte mesmo com runtime relativo na chamada');
  assert.equal(path.isAbsolute(gravado.runtime), true, 'mesa-runtime.json nunca guarda caminho relativo');
  const vazio = tmp();
  pluginHost.installXournalPlugin(depsFor(vazio));
  assert.equal(JSON.parse(fs.readFileSync(path.join(targetOf(vazio), 'mesa-runtime.json'), 'utf8')).runtime, '', 'sem runtime segue vazio');
});

test('arquivo editado vira "modificado": estado novo e recusa de sobrescrever', () => {
  const home = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = targetOf(home);
  fs.appendFileSync(path.join(dir, 'main.lua'), '-- edição da pessoa\n');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'modified');
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home)), ptMatches(/modificada/));
  assert.match(fs.readFileSync(path.join(dir, 'main.lua'), 'utf8'), /edição da pessoa/, 'a edição segue lá');
});

test('pasta sem manifesto mas com plugin.ini igual ao da Mesa é alheia (legado não publicado)', () => {
  const home = tmp();
  const dir = targetOf(home);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'plugin.ini'), fs.readFileSync(path.join(SOURCE, 'plugin.ini'), 'utf8').replace(/^enabled=false$/m, 'enabled=true'));
  for (const file of ['main.lua', 'tamanho.lua', 'README.md']) fs.copyFileSync(path.join(SOURCE, file), path.join(dir, file));
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'foreign');
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home)), ptMatches(/outro autor/));
});

test('reinstalação da versão antiga intacta (com manifesto) é "different" e atualiza', () => {
  const home = tmp();
  const old = oldSource();
  pluginHost.installXournalPlugin(depsFor(home, {source: old}));
  const dir = targetOf(home);
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'different');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).version, '0.9.0');
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.upgraded, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.mesa-instalado.json'), 'utf8')).version, '1.1.0');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('escrita atômica: falha no meio limpa a temporária e a próxima tentativa não vira alheia', () => {
  const home = tmp();
  const plugins = path.join(home, '.config', 'xournalpp', 'plugins');
  const failing = fakeFailingFs({failWhen: ({method, args}) => method === 'copyFileSync' && String(args[0]).endsWith('tamanho.lua')});
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home, {fs: failing.fs})), ptMatches(/Não deu para instalar/));
  assert.equal(fs.existsSync(path.join(plugins, 'MesaPagina')), false, 'sem pasta parcial');
  assert.deepEqual(fs.readdirSync(plugins), [], 'sem temporária sobrando');
  const retry = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(retry.upgraded, false);
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('escrita atômica na reinstalação: falha restaura a antiga e apaga a reserva', () => {
  const home = tmp();
  const plugins = path.join(home, '.config', 'xournalpp', 'plugins');
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = targetOf(home);
  const installedMain = fs.readFileSync(path.join(dir, 'main.lua'), 'utf8');
  const failing = fakeFailingFs({failWhen: ({method, args}) => method === 'copyFileSync' && String(args[0]).endsWith('tamanho.lua')});
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home, {fs: failing.fs})), ptMatches(/Não deu para instalar/));
  assert.equal(fs.readFileSync(path.join(dir, 'main.lua'), 'utf8'), installedMain, 'a antiga segue instalada');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed', 'a antiga continua "nossa"');
  assert.deepEqual(fs.readdirSync(plugins), ['MesaPagina'], 'sem reserva nem temporária sobrando');
});

test('escrita atômica: falha na troca restaura a antiga, apaga a reserva e o retry instala', () => {
  const home = tmp();
  const plugins = path.join(home, '.config', 'xournalpp', 'plugins');
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = targetOf(home);
  const installedMain = fs.readFileSync(path.join(dir, 'main.lua'), 'utf8');
  const failing = fakeFailingFs({failWhen: ({method, args}) => method === 'renameSync' && String(args[0]).includes('.mesa-install-')});
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home, {fs: failing.fs})), ptMatches(/Não deu para instalar/));
  assert.equal(fs.readFileSync(path.join(dir, 'main.lua'), 'utf8'), installedMain, 'a antiga voltou para o lugar');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
  assert.deepEqual(fs.readdirSync(plugins), ['MesaPagina'], 'sem reserva nem temporária');
  const retry = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(retry.upgraded, true);
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('instalação nova faz um rename só e a reinstalação dois', () => {
  const home = tmp();
  const fresh = fakeFailingFs();
  pluginHost.installXournalPlugin(depsFor(home, {fs: fresh.fs}));
  const renamesOf = (calls) => calls.filter((call) => call.method === 'renameSync').length;
  assert.equal(renamesOf(fresh.calls), 1, 'instalação nova: um rename só');
  const again = fakeFailingFs();
  pluginHost.installXournalPlugin(depsFor(home, {fs: again.fs}));
  assert.equal(renamesOf(again.calls), 2, 'reinstalação: antiga para a reserva e nova para o lugar');
});

test('fonte do plugin em dev fica sob desk/ e é substituível pela regra da 0.5.0', () => {
  const resolved = pluginHost.resolvePluginSource({deskDir: DESK_DIR});
  assert.ok(resolved.startsWith(DESK_DIR + path.sep), `fonte sob desk/: ${resolved}`);
  const rel = path.relative(REPO_ROOT, resolved).split(path.sep).join('/');
  for (const file of pluginHost.PLUGIN_FILES) {
    assert.equal(rules050.isReplaceable(`${rel}/${file}`), true, `regra 0.5.0 substitui ${rel}/${file}`);
  }
  assert.equal(rules050.isReplaceable('desk/src/xournal-plugins/tests/mesa-pagina.test.lua'), true);
});

test('temporária e reserva ficam em .mesa-instalacao, irmã de plugins, e a sobra é apagada antes de instalar', () => {
  const home = tmp();
  const recorder = fakeFailingFs();
  pluginHost.installXournalPlugin(depsFor(home, {fs: recorder.fs}));
  const plugins = path.join(home, '.config', 'xournalpp', 'plugins');
  const stagingArea = path.join(home, '.config', 'xournalpp', '.mesa-instalacao');
  assert.deepEqual(fs.readdirSync(plugins), ['MesaPagina'], 'plugins só tem MesaPagina');
  assert.equal(fs.existsSync(stagingArea), true, 'área de instalação existe irmã de plugins');
  assert.deepEqual(fs.readdirSync(stagingArea), [], 'área vazia depois de instalar');
  const temporary = recorder.calls.flatMap((call) => call.args).filter((arg) => typeof arg === 'string' && (arg.includes('.mesa-install-') || arg.includes('.mesa-backup-')));
  assert.ok(temporary.length > 0, 'a instalação usou temporária/reserva');
  for (const item of temporary) assert.ok(item.startsWith(stagingArea + path.sep), `temporária fora de .mesa-instalacao: ${item}`);
  fs.mkdirSync(path.join(stagingArea, '.mesa-install-sobra'), {recursive: true});
  fs.writeFileSync(path.join(stagingArea, '.mesa-install-sobra', 'resto.txt'), 'sobra');
  fs.mkdirSync(path.join(stagingArea, '.mesa-backup-sobra'), {recursive: true});
  fs.writeFileSync(path.join(stagingArea, '.mesa-backup-sobra', 'resto.txt'), 'sobra');
  pluginHost.installXournalPlugin(depsFor(home));
  assert.deepEqual(fs.readdirSync(stagingArea), [], 'sobra apagada antes de instalar');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('mkdir da temporária com EEXIST não apaga a pasta que já existia', () => {
  const home = tmp();
  let created = '';
  const failing = fakeFailingFs({failWhen: ({method, args}) => {
    if (method !== 'mkdirSync') return false;
    const target = String(args[0]);
    if (!target.includes('.mesa-install-')) return false;
    created = target;
    fs.mkdirSync(target, {recursive: false});
    fs.writeFileSync(path.join(target, 'sentinela.txt'), 'não tocar');
    return true;
  }});
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home, {fs: failing.fs})), ptMatches(/Não deu para instalar/));
  assert.ok(created, 'a temporária foi tentada');
  assert.equal(fs.readFileSync(path.join(created, 'sentinela.txt'), 'utf8'), 'não tocar', 'pasta pré-existente segue intacta');
});

test('segue symlink em plugins e instala no destino real', () => {
  const home = tmp();
  const realBase = tmp();
  const realPlugins = path.join(realBase, 'plugins');
  fs.mkdirSync(realPlugins, {recursive: true});
  fs.mkdirSync(path.join(home, '.config', 'xournalpp'), {recursive: true});
  fs.symlinkSync(realPlugins, path.join(home, '.config', 'xournalpp', 'plugins'), 'dir');
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.ok, true);
  assert.deepEqual(listTree(path.join(realPlugins, 'MesaPagina')), ['.mesa-instalado.json', 'README.md', 'converter.lua', 'main.lua', 'mesa-runtime.json', 'plugin.ini', 'ponte.lua', 'tamanho.lua']);
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('symlink em .mesa-instalado.json dá mensagem de symlink, não "outro autor"', () => {
  const home = tmp();
  const outside = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = targetOf(home);
  fs.rmSync(path.join(dir, '.mesa-instalado.json'));
  fs.writeFileSync(path.join(outside, 'fora.json'), '{}');
  fs.symlinkSync(path.join(outside, 'fora.json'), path.join(dir, '.mesa-instalado.json'));
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home)), (error) => {
    const raw = String(error?.message ?? error);
    const pt = ptText(raw);
    return /link simbólico/i.test(pt) && !/outro autor/i.test(pt) && !raw.includes(home) && !raw.includes(outside);
  });
  assert.equal(fs.readFileSync(path.join(outside, 'fora.json'), 'utf8'), '{}');
});

test('recusa symlink na pasta temporária .mesa-instalacao sem escrever no alvo', () => {
  const home = tmp();
  const outside = tmp();
  fs.mkdirSync(path.join(home, '.config', 'xournalpp'), {recursive: true});
  fs.symlinkSync(outside, path.join(home, '.config', 'xournalpp', '.mesa-instalacao'), 'dir');
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home)), ptMatches(/link simbólico/i));
  assert.deepEqual(listTree(outside), [], 'o alvo do link não recebe nada');
  assert.equal(fs.existsSync(path.join(home, '.config', 'xournalpp', 'plugins', 'MesaPagina')), false, 'nada instalado');
});

test('arquivo extra na pasta instalada vira "modificado" e a instalação recusa sem apagar', () => {
  const home = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const dir = targetOf(home);
  fs.writeFileSync(path.join(dir, 'extra.txt'), 'da pessoa');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'modified');
  assert.throws(() => pluginHost.installXournalPlugin(depsFor(home)), ptMatches(/modificada/));
  assert.equal(fs.readFileSync(path.join(dir, 'extra.txt'), 'utf8'), 'da pessoa', 'o arquivo extra segue lá');
});

test('manifesto com menos arquivos que PLUGIN_FILES continua sendo "nossa" (futura versão)', () => {
  const home = tmp();
  const dir = targetOf(home);
  fs.mkdirSync(dir, {recursive: true});
  const listed = ['main.lua', 'tamanho.lua', 'plugin.ini'];
  for (const file of listed) {
    const content = file === 'plugin.ini' ? fs.readFileSync(path.join(SOURCE, file), 'utf8').replace(/^enabled=false$/m, 'enabled=true') : fs.readFileSync(path.join(SOURCE, file), 'utf8');
    fs.writeFileSync(path.join(dir, file), content);
  }
  const files = {};
  for (const file of listed) files[file] = sha256(path.join(dir, file));
  fs.writeFileSync(path.join(dir, '.mesa-instalado.json'), `${JSON.stringify({version: '1.1.0', files}, null, 2)}\n`);
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed', 'só os listados precisam bater');
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.upgraded, true);
  assert.equal(fs.existsSync(path.join(dir, 'README.md')), true, 'a reinstalação traz o arquivo novo');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('troca e restauração falhando: erro diz que a anterior ficou na reserva, sem caminho', () => {
  const home = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const plugins = path.join(home, '.config', 'xournalpp', 'plugins');
  const stagingArea = path.join(home, '.config', 'xournalpp', '.mesa-instalacao');
  const failing = fakeFailingFs({failWhen: ({method, args}) => method === 'renameSync' && (String(args[0]).includes('.mesa-install-') || String(args[0]).includes('.mesa-backup-'))});
  let error;
  try { pluginHost.installXournalPlugin(depsFor(home, {fs: failing.fs})); } catch (caught) { error = caught; }
  assert.ok(error, 'instalação falha');
  const raw = String(error.message ?? error);
  const pt = ptText(raw);
  assert.match(pt, /reserva/i, 'erro diz que a anterior ficou na reserva');
  assert.ok(!raw.includes(home) && !pt.includes(home), 'sem caminho pessoal');
  assert.equal(fs.existsSync(path.join(plugins, 'MesaPagina')), false, 'sem MesaPagina no lugar (restauração falhou)');
  const backups = fs.readdirSync(stagingArea).filter((name) => name.startsWith('.mesa-backup-'));
  assert.equal(backups.length, 1, 'reserva guardada em .mesa-instalacao');
  assert.match(fs.readFileSync(path.join(stagingArea, backups[0], 'main.lua'), 'utf8'), /MesaPagina/);
});

test('sobra de reserva com MesaPagina ausente é restaurada antes de instalar', () => {
  const home = tmp();
  const stagingArea = path.join(home, '.config', 'xournalpp', '.mesa-instalacao');
  pluginHost.installXournalPlugin(depsFor(home, {source: oldSource()}));
  const dir = targetOf(home);
  assert.equal(pluginHost.pluginStatus(depsFor(home)).version, '0.9.0');
  fs.mkdirSync(stagingArea, {recursive: true});
  fs.renameSync(dir, path.join(stagingArea, '.mesa-backup-crash'));
  assert.equal(fs.existsSync(dir), false);
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.upgraded, true, 'a reserva restaurada conta como instalada');
  assert.deepEqual(fs.readdirSync(stagingArea), [], 'reserva e sobras acabaram');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).version, '1.1.0');
});

test('components.collect traz o estado do plugin na linha do Xournal++', async () => {
  const home = tmp();
  const base = {deskDir: tmp(), config: {}, cacheFile: '', version: '0.4.0', testMode: true, run: async () => ({stdout: ''}), platform: 'linux', nodeVersion: '22.19.0', claudeLauncher: '', home, env: {}, pluginSourceDir: SOURCE};
  const missing = await components.collect({...base});
  const xournalMissing = missing.rows.find((row) => row.id === 'xournal');
  assert.equal(xournalMissing.plugin.status, 'missing');
  pluginHost.installXournalPlugin(depsFor(home));
  const installed = await components.collect({...base});
  assert.equal(installed.rows.find((row) => row.id === 'xournal').plugin.status, 'installed');
});

test('limpeza apaga só o que é da Mesa e deixa o resto intacto (#133)', () => {
  const home = tmp();
  pluginHost.installXournalPlugin(depsFor(home));
  const stagingArea = path.join(home, '.config', 'xournalpp', '.mesa-instalacao');
  fs.mkdirSync(path.join(stagingArea, '.mesa-install-leftover'), {recursive: true});
  fs.writeFileSync(path.join(stagingArea, '.mesa-install-leftover', 'resto.txt'), 'sobra');
  fs.mkdirSync(path.join(stagingArea, '.mesa-backup-leftover'), {recursive: true});
  fs.writeFileSync(path.join(stagingArea, '.mesa-backup-leftover', 'resto.txt'), 'sobra');
  fs.writeFileSync(path.join(stagingArea, 'keep-me.txt'), 'não tocar');
  fs.mkdirSync(path.join(stagingArea, 'user-dir'), {recursive: true});
  fs.writeFileSync(path.join(stagingArea, 'user-dir', 'f.txt'), 'não tocar');
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(path.join(stagingArea, 'keep-me.txt'), 'utf8'), 'não tocar', 'arquivo alheio na área segue intacto');
  assert.equal(fs.readFileSync(path.join(stagingArea, 'user-dir', 'f.txt'), 'utf8'), 'não tocar', 'pasta alheia na área segue intacta');
  assert.deepEqual(fs.readdirSync(stagingArea).sort(), ['keep-me.txt', 'user-dir'], 'só o que não é da Mesa ficou');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('lock: segunda instalação recusa com .mesa-lock fresco e quebra lock velho (#133)', () => {
  const home = tmp();
  const stagingArea = path.join(home, '.config', 'xournalpp', '.mesa-instalacao');
  fs.mkdirSync(stagingArea, {recursive: true});
  const lockPath = path.join(stagingArea, '.mesa-lock');
  fs.mkdirSync(lockPath);
  const otherTemp = path.join(stagingArea, '.mesa-install-other');
  fs.mkdirSync(otherTemp);
  fs.writeFileSync(path.join(otherTemp, 'partial.txt'), 'da outra');
  let error;
  try { pluginHost.installXournalPlugin(depsFor(home)); } catch (caught) { error = caught; }
  assert.ok(error, 'instalação concorrente recusa');
  const raw = String(error.message ?? error);
  const pt = ptText(raw);
  assert.match(pt, /outra instalação em andamento/i, 'mensagem traduzida de lock');
  assert.ok(!raw.includes(home) && !pt.includes(home), 'sem caminho pessoal');
  assert.equal(fs.existsSync(lockPath), true, 'lock da outra instalação segue lá');
  assert.equal(fs.readFileSync(path.join(otherTemp, 'partial.txt'), 'utf8'), 'da outra', 'temporária da outra não é apagada');
  assert.equal(fs.existsSync(targetOf(home)), false, 'nada instalado pela segunda');
  const old = new Date(Date.now() - 3 * 60 * 1000);
  fs.utimesSync(lockPath, old, old);
  const result = pluginHost.installXournalPlugin(depsFor(home));
  assert.equal(result.ok, true, 'lock velho é quebrado');
  assert.equal(fs.existsSync(lockPath), false, 'lock removido no finally');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'installed');
});

test('symlink quebrado em MesaPagina: estado symlink e mensagem de symlink (#133)', () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.config', 'xournalpp', 'plugins'), {recursive: true});
  fs.symlinkSync(path.join(home, 'nao-existe'), targetOf(home), 'dir');
  assert.equal(fs.existsSync(targetOf(home)), false, 'link quebrado não existe para existsSync');
  assert.equal(pluginHost.pluginStatus(depsFor(home)).status, 'symlink', 'estado mostra symlink, não "não instalado"');
  let error;
  try { pluginHost.installXournalPlugin(depsFor(home)); } catch (caught) { error = caught; }
  assert.ok(error, 'instalação recusa');
  const raw = String(error.message ?? error);
  const pt = ptText(raw);
  assert.match(pt, /link simbólico/i, 'mensagem de symlink');
  assert.ok(!raw.includes(home) && !pt.includes(home), 'sem caminho pessoal');
});

test('erro na limpeza/restauração vira mensagem traduzida sem caminho (#133)', () => {
  const home = tmp();
  pluginHost.installXournalPlugin(depsFor(home, {source: oldSource()}));
  const dir = targetOf(home);
  const stagingArea = path.join(home, '.config', 'xournalpp', '.mesa-instalacao');
  fs.mkdirSync(stagingArea, {recursive: true});
  fs.renameSync(dir, path.join(stagingArea, '.mesa-backup-crash'));
  assert.equal(fs.existsSync(dir), false);
  const failing = fakeFailingFs({failWhen: ({method, args}) => method === 'renameSync' && String(args[0]).includes('.mesa-backup-')});
  let error;
  try { pluginHost.installXournalPlugin(depsFor(home, {fs: failing.fs})); } catch (caught) { error = caught; }
  assert.ok(error, 'instalação falha');
  const raw = String(error.message ?? error);
  const pt = ptText(raw);
  assert.match(pt, /Não deu para instalar/, 'erro traduzido, não cru');
  assert.ok(!raw.includes(home) && !pt.includes(home), 'sem caminho pessoal');
  assert.equal(fs.existsSync(path.join(stagingArea, '.mesa-backup-crash')), true, 'reserva segue na área');
  assert.equal(fs.existsSync(path.join(stagingArea, '.mesa-lock')), false, 'lock removido mesmo com limpeza falhando');
});
