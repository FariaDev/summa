import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';
import {fakeLeftoversFs} from './fake-leftovers-fs.mjs';

/* Limpeza única dos restos da biblioteca de cadernos: índice da tinta, ponte,
   workspace e plugin MesaPagina. O plugin só cai quando o manifesto prova que
   é a instalação intacta da Mesa; nada fora dos caminhos exatos é tocado. */
const require = createRequire(import.meta.url);
const {cleanNotebookLeftovers, xournalPluginDirs, MARKER_NAME} = require('../notebook-leftovers.cjs');

const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex');
const newHome = () => tempDir('summa-leftovers');
const runtimeAt = (home) => path.join(home, 'runtime');
const pluginsAt = (home) => path.join(home, '.config', 'xournalpp', 'plugins');

/**
 * Cria uma pasta de plugin com manifesto opcional; `mutated` reescreve um
 * arquivo depois do manifesto e `extra` acrescenta um arquivo não listado.
 * @param {string} dir @param {{content?: Record<string, string>, manifest?: boolean|'invalid', mutated?: string, extra?: string}} [options]
 * @returns {string} a pasta criada
 */
function writePluginTree(dir, {content = {'plugin.ini': 'enabled=true\n', 'main.lua': '-- mesa\n'}, manifest = true, mutated = '', extra = ''} = {}) {
  fs.mkdirSync(dir, {recursive: true});
  const files = {};
  for (const [name, text] of Object.entries(content)) {
    fs.writeFileSync(path.join(dir, name), text);
    files[name] = hashOf(text);
  }
  if (manifest === true) fs.writeFileSync(path.join(dir, '.mesa-instalado.json'), `${JSON.stringify({version: '1.1.0', files}, null, 2)}\n`);
  if (manifest === 'invalid') fs.writeFileSync(path.join(dir, '.mesa-instalado.json'), '{isto não é json');
  if (mutated) fs.writeFileSync(path.join(dir, mutated), 'alterado depois do manifesto\n');
  if (extra) fs.writeFileSync(path.join(dir, extra), '-- arquivo extra\n');
  return dir;
}

const writePlugin = (pluginsDir, options) => writePluginTree(path.join(pluginsDir, 'MesaPagina'), options);

/**
 * Semeia o runtime com os restos e com sentinelas vizinhos que a limpeza não
 * pode tocar.
 * @param {string} runtime @returns {void}
 */
function seedRuntime(runtime) {
  fs.mkdirSync(path.join(runtime, 'notebook-ink'), {recursive: true});
  fs.writeFileSync(path.join(runtime, 'notebook-ink', 'index.json'), '{"version":2,"files":{}}\n');
  fs.writeFileSync(path.join(runtime, 'ink-convert-bridge.json'), '{"port":1}\n');
  fs.mkdirSync(path.join(runtime, 'opencode-workspaces', 'notebook-ink'), {recursive: true});
  fs.writeFileSync(path.join(runtime, 'opencode-workspaces', 'notebook-ink', 'sessao.jsonl'), '{}\n');
  fs.mkdirSync(path.join(runtime, 'notebook-ink-outra'), {recursive: true});
  fs.writeFileSync(path.join(runtime, 'notebook-ink-outra', 'index.json'), 'vizinho\n');
  fs.mkdirSync(path.join(runtime, 'opencode-workspaces', 'outra'), {recursive: true});
  fs.writeFileSync(path.join(runtime, 'opencode-workspaces', 'outra', 'keep.txt'), 'vizinho\n');
  fs.writeFileSync(path.join(runtime, 'materia.xopp'), 'xopp\n');
  fs.writeFileSync(path.join(runtime, 'material.pdf'), 'pdf\n');
}

test('apaga o índice, a ponte e o workspace derivados do runtime', () => {
  const home = newHome();
  const runtime = runtimeAt(home);
  seedRuntime(runtime);
  const result = cleanNotebookLeftovers({fs, runtimeDir: runtime, pluginDirs: [pluginsAt(home)]});
  assert.equal(result.ran, true);
  assert.deepEqual(result.removed.sort(), ['ink-convert-bridge.json', 'notebook-ink', 'opencode-workspaces/notebook-ink']);
  assert.equal(fs.existsSync(path.join(runtime, 'notebook-ink')), false);
  assert.equal(fs.existsSync(path.join(runtime, 'ink-convert-bridge.json')), false);
  assert.equal(fs.existsSync(path.join(runtime, 'opencode-workspaces', 'notebook-ink')), false);
  assert.ok(fs.existsSync(path.join(runtime, 'opencode-workspaces', 'outra')), 'a pasta-mãe fica');
  assert.ok(fs.existsSync(path.join(runtime, MARKER_NAME)), 'grava o marcador da limpeza');
});

test('plugin intacto com manifesto válido é apagado', () => {
  const home = newHome();
  const plugins = pluginsAt(home);
  const dir = writePlugin(plugins);
  fs.mkdirSync(path.join(plugins, 'OutroPlugin'), {recursive: true});
  fs.writeFileSync(path.join(plugins, 'OutroPlugin', 'plugin.ini'), 'outro\n');
  const result = cleanNotebookLeftovers({fs, runtimeDir: runtimeAt(home), pluginDirs: [plugins]});
  assert.deepEqual(result.removed, ['MesaPagina em plugins']);
  assert.equal(fs.existsSync(dir), false);
  assert.ok(fs.existsSync(path.join(plugins, 'OutroPlugin', 'plugin.ini')), 'plugin vizinho fica');
});

test('plugin com arquivo modificado fica', () => {
  const home = newHome();
  const plugins = pluginsAt(home);
  const dir = writePlugin(plugins, {mutated: 'main.lua'});
  const result = cleanNotebookLeftovers({fs, runtimeDir: runtimeAt(home), pluginDirs: [plugins]});
  assert.deepEqual(result.kept, ['MesaPagina em plugins']);
  assert.equal(fs.readFileSync(path.join(dir, 'main.lua'), 'utf8'), 'alterado depois do manifesto\n');
  assert.ok(fs.existsSync(path.join(dir, '.mesa-instalado.json')));
});

test('plugin com arquivo extra fica', () => {
  const home = newHome();
  const plugins = pluginsAt(home);
  const dir = writePlugin(plugins, {extra: 'extra.lua'});
  const result = cleanNotebookLeftovers({fs, runtimeDir: runtimeAt(home), pluginDirs: [plugins]});
  assert.deepEqual(result.kept, ['MesaPagina em plugins']);
  assert.equal(fs.readFileSync(path.join(dir, 'extra.lua'), 'utf8'), '-- arquivo extra\n');
});

test('plugin que é symlink fica, e o alvo não é tocado', () => {
  const home = newHome();
  const plugins = pluginsAt(home);
  const real = writePluginTree(path.join(home, 'plugin-real'));
  fs.mkdirSync(plugins, {recursive: true});
  const link = path.join(plugins, 'MesaPagina');
  fs.symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir');
  const result = cleanNotebookLeftovers({fs, runtimeDir: runtimeAt(home), pluginDirs: [plugins]});
  assert.deepEqual(result.kept, ['MesaPagina em plugins']);
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.ok(fs.existsSync(path.join(real, '.mesa-instalado.json')), 'o alvo do link fica intacto');
  assert.equal(fs.readFileSync(path.join(real, 'main.lua'), 'utf8'), '-- mesa\n');
});

test('pasta sem manifesto ou com manifesto inválido fica', () => {
  const home = newHome();
  const semManifesto = path.join(home, 'plugins-a');
  const manifestoRuim = path.join(home, 'plugins-b');
  const first = writePlugin(semManifesto, {manifest: false});
  const second = writePlugin(manifestoRuim, {manifest: 'invalid'});
  const result = cleanNotebookLeftovers({fs, runtimeDir: runtimeAt(home), pluginDirs: [semManifesto, manifestoRuim]});
  assert.deepEqual(result.kept, ['MesaPagina em plugins-a', 'MesaPagina em plugins-b']);
  assert.ok(fs.existsSync(path.join(first, 'main.lua')));
  assert.ok(fs.existsSync(path.join(second, 'main.lua')));
});

test('o marcador impede a segunda execução', () => {
  const home = newHome();
  const runtime = runtimeAt(home);
  seedRuntime(runtime);
  const plugins = pluginsAt(home);
  const dir = writePlugin(plugins);
  const first = cleanNotebookLeftovers({fs, runtimeDir: runtime, pluginDirs: [plugins]});
  assert.equal(first.ran, true);
  assert.equal(fs.existsSync(dir), false);
  fs.mkdirSync(path.join(runtime, 'notebook-ink'), {recursive: true});
  fs.writeFileSync(path.join(runtime, 'notebook-ink', 'index.json'), 'de novo\n');
  const second = cleanNotebookLeftovers({fs, runtimeDir: runtime, pluginDirs: [plugins]});
  assert.deepEqual(second, {ran: false, removed: [], kept: []});
  assert.equal(fs.readFileSync(path.join(runtime, 'notebook-ink', 'index.json'), 'utf8'), 'de novo\n');
});

test('erro de fs em um passo não impede os outros e não lança', () => {
  const home = newHome();
  const runtime = runtimeAt(home);
  seedRuntime(runtime);
  const plugins = pluginsAt(home);
  const dir = writePlugin(plugins);
  const logs = [];
  const fake = fakeLeftoversFs({failWhen: ({method, args}) => method === 'rmSync' && String(args[0]).endsWith('ink-convert-bridge.json')});
  const result = cleanNotebookLeftovers({fs: fake.fs, runtimeDir: runtime, pluginDirs: [plugins], log: (line) => logs.push(line)});
  assert.equal(result.ran, true);
  assert.ok(fs.existsSync(path.join(runtime, 'ink-convert-bridge.json')), 'a ponte que falhou fica');
  assert.equal(fs.existsSync(path.join(runtime, 'notebook-ink')), false, 'o índice seguinte foi apagado');
  assert.equal(fs.existsSync(path.join(runtime, 'opencode-workspaces', 'notebook-ink')), false, 'o workspace seguinte foi apagado');
  assert.equal(fs.existsSync(dir), false, 'o plugin foi apagado mesmo com a falha anterior');
  assert.ok(fs.existsSync(path.join(runtime, MARKER_NAME)), 'o marcador é gravado mesmo com falha parcial');
  assert.equal(result.removed.includes('ink-convert-bridge.json'), false);
  assert.ok(logs.some((line) => line.includes('ink-convert-bridge.json') && line.includes('EFAKE')), 'a falha vai para o log com o código');
});

test('não toca em .xopp, PDF nem em pastas vizinhas', () => {
  const home = newHome();
  const runtime = runtimeAt(home);
  seedRuntime(runtime);
  writePlugin(pluginsAt(home));
  fs.writeFileSync(path.join(home, 'sentinela.txt'), 'fora\n');
  cleanNotebookLeftovers({fs, runtimeDir: runtime, pluginDirs: [pluginsAt(home)]});
  assert.equal(fs.readFileSync(path.join(runtime, 'materia.xopp'), 'utf8'), 'xopp\n');
  assert.equal(fs.readFileSync(path.join(runtime, 'material.pdf'), 'utf8'), 'pdf\n');
  assert.equal(fs.readFileSync(path.join(runtime, 'notebook-ink-outra', 'index.json'), 'utf8'), 'vizinho\n');
  assert.equal(fs.readFileSync(path.join(runtime, 'opencode-workspaces', 'outra', 'keep.txt'), 'utf8'), 'vizinho\n');
  assert.equal(fs.readFileSync(path.join(home, 'sentinela.txt'), 'utf8'), 'fora\n');
});

test('o log não carrega o caminho do HOME', () => {
  const home = newHome();
  const runtime = runtimeAt(home);
  seedRuntime(runtime);
  writePlugin(pluginsAt(home));
  const logs = [];
  cleanNotebookLeftovers({fs, runtimeDir: runtime, pluginDirs: [pluginsAt(home)], log: (line) => logs.push(line)});
  assert.ok(logs.length >= 4);
  for (const line of logs) assert.equal(line.includes(home), false, `log vazou o HOME: ${line}`);
  assert.ok(logs.some((line) => line.includes('notebook-ink') && line.includes('apagado')));
  assert.ok(logs.some((line) => line.includes('MesaPagina') && line.includes('apagado')));
});

test('apaga a área temporária da instalação e não segue symlink nela', () => {
  const home = newHome();
  const plugins = pluginsAt(home);
  const staging = path.join(path.dirname(plugins), '.mesa-instalacao');
  fs.mkdirSync(path.join(staging, 'reserva-1'), {recursive: true});
  fs.writeFileSync(path.join(staging, 'reserva-1', 'main.lua'), '-- mesa\n');
  fs.writeFileSync(path.join(path.dirname(plugins), 'settings.xml'), 'do usuário\n');
  const result = cleanNotebookLeftovers({fs, runtimeDir: runtimeAt(home), pluginDirs: [plugins]});
  assert.ok(result.removed.includes('.mesa-instalacao junto de plugins'));
  assert.equal(fs.existsSync(staging), false);
  assert.equal(fs.readFileSync(path.join(path.dirname(plugins), 'settings.xml'), 'utf8'), 'do usuário\n');

  const other = newHome();
  const target = path.join(other, 'alvo');
  fs.mkdirSync(target, {recursive: true});
  fs.writeFileSync(path.join(target, 'keep.txt'), 'alheio\n');
  const otherPlugins = pluginsAt(other);
  fs.mkdirSync(path.dirname(otherPlugins), {recursive: true});
  fs.symlinkSync(target, path.join(path.dirname(otherPlugins), '.mesa-instalacao'));
  const linked = cleanNotebookLeftovers({fs, runtimeDir: runtimeAt(other), pluginDirs: [otherPlugins]});
  assert.ok(linked.kept.includes('.mesa-instalacao junto de plugins'));
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'alheio\n');
});

/* O separador é o do SO que roda o teste (CI no Windows), como no código. */
test('pasta de plugins do Xournal++ por SO, como o instalador antigo', () => {
  assert.deepEqual(xournalPluginDirs({platform: 'linux', env: {}, homedir: '/home/u'}), [path.join('/home/u', '.config', 'xournalpp', 'plugins')]);
  assert.deepEqual(xournalPluginDirs({platform: 'darwin', env: {XDG_CONFIG_HOME: '/xdg'}, homedir: '/Users/u'}), [path.join('/xdg', 'xournalpp', 'plugins')]);
  assert.deepEqual(xournalPluginDirs({platform: 'linux', env: {XDG_CONFIG_HOME: 'relativo'}, homedir: '/home/u'}), [path.join('/home/u', '.config', 'xournalpp', 'plugins')]);
  assert.deepEqual(xournalPluginDirs({platform: 'win32', env: {}, homedir: 'C:/u'}), []);
  assert.equal(xournalPluginDirs({platform: 'win32', env: {LOCALAPPDATA: 'C:/u/AppData/Local'}, homedir: 'C:/u'}).length, 1);
});
