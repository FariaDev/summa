import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fileSubresourceBlocked, isPathUnderRoot, staticAppEntries, fileGuardOptions} from '../file-guard.cjs';
import {fileSubresourceBlocked as runtimeReexport} from '../activity-runtime.cjs';

/* `file:///app/desk/…` não é URL de arquivo válida no Windows (não tem letra
   de unidade): o `fileURLToPath` lança e a guarda nega com `url-ilegivel`.
   Montar a URL com `pathToFileURL` mantém a mesma asserção nos dois sistemas
   (#165); os caminhos passam por `path.resolve` pelo mesmo motivo. */
const APP = path.resolve('/app/desk');
const opt = (over = {}) => ({appRoot: APP, ...over});
const fileUrl = (...segments) => pathToFileURL(path.join(...segments)).href;

test('file: estático passa; fora do app cancela', () => {
  assert.equal(fileSubresourceBlocked(opt({url: fileUrl(APP, 'src', 'x.mjs'), resourceType: 'image'})).cancel, false);
  assert.equal(fileSubresourceBlocked(opt({url: fileUrl(APP, 'renderer.mjs'), resourceType: 'script'})).cancel, false);
  assert.equal(fileSubresourceBlocked(opt({url: fileUrl(APP, 'index.html'), resourceType: 'image'})).cancel, false);
  assert.equal(fileSubresourceBlocked(opt({url: fileUrl(path.resolve('/tmp'), 'x.png'), resourceType: 'image'})).cancel, true);
  assert.equal(fileSubresourceBlocked(opt({url: 'https://exemplo.com/x.png', resourceType: 'image'})).cancel, false);
});

test('raiz do app sem estático cancela: negar por padrão', () => {
  const denied = fileSubresourceBlocked(opt({url: fileUrl(APP, 'qualquer.cjs'), resourceType: 'script'}));
  assert.equal(denied.cancel, true);
  assert.equal(denied.reason, 'fora-dos-estaticos');
  const outside = fileSubresourceBlocked(opt({url: fileUrl(path.resolve('/outro'), 'x.png'), resourceType: 'image'}));
  assert.equal(outside.cancel, true);
  assert.equal(outside.reason, 'fora-do-app');
});

test('runtime da instância nega mesmo sob a raiz do app', () => {
  const runtimeRoot = path.join(APP, '.runtime');
  const under = fileSubresourceBlocked(opt({url: fileUrl(runtimeRoot, 'shot.png'), resourceType: 'image', runtimeRoot}));
  assert.equal(under.cancel, true);
  assert.equal(under.reason, 'runtime');
  const customRoot = path.resolve('/dados/mesa');
  const custom = fileSubresourceBlocked(opt({url: fileUrl(customRoot, 'desk.json'), resourceType: 'fetch', runtimeRoot: customRoot}));
  assert.equal(custom.cancel, true);
  assert.equal(custom.reason, 'runtime');
});

test('dado do aluno fora do runtime também nega', () => {
  const courseRoot = path.resolve('/cursos/calculo');
  const pdf = fileSubresourceBlocked(opt({url: fileUrl(courseRoot, 'aula.pdf'), resourceType: 'object', dataRoots: [courseRoot]}));
  assert.equal(pdf.cancel, true);
  assert.equal(pdf.reason, 'dados');
});

test('esquema sem caixa cancela igual na função pura', () => {
  for (const scheme of ['FILE:', 'File:', 'fIlE:']) {
    const blocked = fileSubresourceBlocked(opt({url: `${scheme}///etc/passwd`, resourceType: 'image'}));
    assert.equal(blocked.cancel, true, `${scheme} passou`);
  }
});

test('symlink resolvido quando existe: elo dentro, alvo fora, nega', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-fileguard-'));
  const link = path.join(dir, 'liga');
  fs.symlinkSync('/etc', link);
  try {
    const blocked = fileSubresourceBlocked({url: `file://${link}/passwd`, resourceType: 'image', appRoot: dir});
    assert.equal(blocked.cancel, true, 'symlink para fora passou');
  } finally {
    fs.unlinkSync(link);
    fs.rmdirSync(dir);
  }
});

test('sem prefixo solto: /app-evil não é /app', () => {
  assert.equal(isPathUnderRoot('/app-evil/x.png', '/app'), false);
  assert.equal(isPathUnderRoot('/app/x.png', '/app'), true);
  assert.equal(isPathUnderRoot('/app', '/app'), true);
});

test('asar do empacotado: estático passa, o resto cancela', () => {
  const appRoot = path.resolve('/a/app.asar/desk');
  assert.equal(fileSubresourceBlocked({url: fileUrl(appRoot, 'src', 'x.mjs'), resourceType: 'script', appRoot}).cancel, false);
  assert.equal(fileSubresourceBlocked({url: fileUrl(appRoot, 'renderer.mjs'), resourceType: 'script', appRoot}).cancel, false);
  assert.equal(fileSubresourceBlocked({url: fileUrl(appRoot, 'evil', 'x.png'), resourceType: 'image', appRoot}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: fileUrl(path.resolve('/a/outro'), 'x.png'), resourceType: 'image', appRoot}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: fileUrl(path.resolve('/a/app.asar.unpacked/modulo'), 'index.js'), resourceType: 'script', appRoot}).cancel, true);
});

test('macOS: arquivo fora da raiz cancela', () => {
  const appRoot = path.resolve('/Applications/Mesa.app/Contents/Resources/app.asar/desk');
  assert.equal(fileSubresourceBlocked({url: fileUrl(path.resolve('/Users/aluno'), 'segredo.png'), resourceType: 'image', appRoot}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: fileUrl(appRoot, 'src', 'x.mjs'), resourceType: 'script', appRoot}).cancel, false);
});

test('Windows: compara sem caixa e com barra invertida', () => {
  assert.equal(isPathUnderRoot('C:\\App\\desk\\x.png', 'c:\\app\\desk'), true);
  assert.equal(isPathUnderRoot('C:\\App-evil\\x.png', 'C:\\App'), false);
  assert.equal(fileSubresourceBlocked({url: 'file:///C:/tmp/x.png', resourceType: 'image', appRoot: 'C:\\App\\desk'}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: 'file:///C:/App/desk/src/x.mjs', resourceType: 'script', appRoot: 'C:\\App\\desk'}).cancel, false);
});

test('documento principal segue; sem raiz falha fechada', () => {
  assert.equal(fileSubresourceBlocked({url: 'file:///tmp/x.png', resourceType: 'mainFrame', appRoot: '/app'}).cancel, false);
  assert.equal(fileSubresourceBlocked({url: 'file:///tmp/x.png', resourceType: 'image', appRoot: null}).cancel, true);
});

test('estáticos do app: pastas e soltos da raiz', () => {
  const entries = staticAppEntries(APP);
  assert.deepEqual(entries.dirs, [path.join(APP, 'src'), path.join(APP, 'assets'), path.join(APP, 'node_modules')]);
  assert.ok(entries.files.includes(path.join(APP, 'index.html')));
  assert.ok(entries.files.includes(path.join(APP, 'preload.cjs')));
});

test('runtime reexporta a guarda; a fábrica lê o vivo', () => {
  assert.equal(runtimeReexport, fileSubresourceBlocked);
  const runtimeRoot = path.resolve('/tmp/rt');
  const vaultPath = path.resolve('/cofre');
  const coursePath = path.resolve('/cursos/a');
  const options = fileGuardOptions({appRoot: APP, runtimeRoot, live: {config: {vaultPath}, courses: [{path: coursePath}, {path: ''}]}});
  assert.equal(options.appRoot, APP);
  assert.equal(options.runtimeRoot, runtimeRoot);
  assert.deepEqual(options.dataRoots(), [vaultPath, coursePath]);
  const decided = fileSubresourceBlocked({url: fileUrl(coursePath, 'aula.pdf'), resourceType: 'object', ...options});
  assert.equal(decided.cancel, true);
  assert.equal(decided.reason, 'dados');
});
