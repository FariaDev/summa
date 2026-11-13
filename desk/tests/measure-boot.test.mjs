import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {measureBoot} from '../scripts/measure-boot.mjs';

const DESK = path.resolve(import.meta.dirname, '..');
const MiB = 1024 * 1024;

test('a partida do renderer não carrega o pdf.js antes do primeiro PDF', () => {
  const report = measureBoot({root: DESK});
  assert.ok(report.modules > 100, `grafo pequeno demais: ${report.modules} módulos`);
  assert.equal(report.missing.length, 0, `imports sem arquivo: ${report.missing.join(', ')}`);
  /* Sem `\` do Windows: as checagens "fora da partida" comparam com `/` (CI do PR #162). */
  assert.ok([...report.moduleFiles, ...report.dynamic.map((row) => row.file)].every((file) => !file.includes('\\')),
    'caminho do relatório com separador do sistema: use `/`');
  assert.ok(!report.moduleFiles.includes('node_modules/pdfjs-dist/build/pdf.mjs'),
    'o pdf.js (860 KiB) voltou para o caminho de partida: use src/pdfjs-loader.mjs');
});

test('o núcleo das Configurações (133 KiB) só entra quando o diálogo abre', () => {
  const report = measureBoot({root: DESK});
  assert.ok(!report.moduleFiles.includes('src/generated/settingsview.core.js'),
    'o settingsview.core.js voltou para o caminho de partida: use src/lazy-module.mjs');
});

test('o núcleo da primeira abertura (125 KiB) só entra quando a tela vale', () => {
  const report = measureBoot({root: DESK});
  assert.ok(!report.moduleFiles.includes('src/generated/firstrun.core.js'),
    'o firstrun.core.js voltou para o caminho de partida: use src/first-run-boot.mjs');
  assert.ok(!report.moduleFiles.includes('src/first-run.mjs'),
    'a tela da primeira abertura voltou para o caminho de partida: use src/first-run-boot.mjs');
});

test('o painel de Estatísticas só entra quando é aberto', () => {
  const report = measureBoot({root: DESK});
  assert.ok(!report.moduleFiles.includes('src/study-stats.mjs'),
    'o study-stats.mjs voltou para o caminho de partida');
  assert.ok(!report.moduleFiles.includes('src/generated/studystats.core.js'),
    'o studystats.core.js voltou para o caminho de partida: use src/lazy-module.mjs');
});

test('navegação, avisos, paleta e provedores OpenCode ficam fora do grafo estático', () => {
  const report = measureBoot({root: DESK});
  const dynamicFiles = report.dynamic.map((row) => row.file);
  for (const file of [
    'src/nav.mjs',
    'src/generated/pdfnav.core.js',
    'src/generated/updatenotice.core.js',
    'src/command-palette.mjs',
    'src/opencode-providers.mjs',
  ]) {
    assert.ok(!report.moduleFiles.includes(file), `${file} voltou ao caminho de partida`);
  }
  for (const file of ['src/nav.mjs', 'src/generated/updatenotice.core.js', 'src/command-palette.mjs', 'src/opencode-providers.mjs']) {
    assert.ok(dynamicFiles.includes(file), `${file} não está acessível pelo carregamento dinâmico`);
  }
});

test('só o idioma ativo da interface entra na partida; o outro vem sob demanda', () => {
  const report = measureBoot({root: DESK});
  for (const file of ['src/locales/pt-BR.json', 'src/locales/en.json']) {
    assert.ok(!report.moduleFiles.includes(file),
      `${file} voltou ao caminho de partida: use src/locale-loader.mjs`);
  }
  assert.ok(report.moduleFiles.includes('src/locale-loader.mjs'),
    'o carregador de locale saiu da partida: o idioma ativo não entraria antes do primeiro desenho');
});

test('a aba Livre e o Caderno de revisão ficam fora do grafo estático', () => {
  const report = measureBoot({root: DESK});
  const dynamicFiles = report.dynamic.map((row) => row.file);
  for (const file of [
    'src/free-study.mjs',
    'src/free-models.mjs',
    'src/review.mjs',
    'src/generated/review.core.js',
    'src/materials/template.mjs',
  ]) {
    assert.ok(!report.moduleFiles.includes(file), `${file} voltou ao caminho de partida`);
  }
  for (const file of ['src/free-study.mjs', 'src/free-models.mjs', 'src/review.mjs']) {
    assert.ok(dynamicFiles.includes(file), `${file} não está acessível pelo carregamento dinâmico`);
  }
});


test('KaTeX, diálogos de primeiro uso e atalhos ficam fora da partida (PR-4)', () => {
  const report = measureBoot({root: DESK});
  const dynamicFiles = report.dynamic.map((row) => row.file);
  for (const file of [
    'node_modules/katex/dist/katex.mjs',
    'src/sidechat.mjs',
    'src/generated/sidechat.core.js',
    'src/guide.mjs',
    'src/generated/guideview.core.js',
    'src/study-search.mjs',
    'src/generated/studysearch.core.js',
    'src/pdf-notes.mjs',
    'src/generated/studyannotations.core.js',
    'src/backup-panel.mjs',
    'src/conversation-library.mjs',
    'src/generated/chatlibraryview.core.js',
    'src/triage.mjs',
    'src/activity.mjs',
    'src/generated/claudeversion.core.js',
    'src/generated/shortcutview.core.js',
  ]) {
    assert.ok(!report.moduleFiles.includes(file), `${file} voltou ao caminho de partida`);
  }
  for (const file of [
    'node_modules/katex/dist/katex.mjs',
    'src/sidechat.mjs',
    'src/guide.mjs',
    'src/study-search.mjs',
    'src/pdf-notes.mjs',
    'src/backup-panel.mjs',
    'src/conversation-library.mjs',
    'src/triage.mjs',
    'src/activity.mjs',
    'src/tutor-reason.mjs',
    'src/generated/shortcutview.core.js',
  ]) {
    assert.ok(dynamicFiles.includes(file), `${file} não está acessível pelo carregamento dinâmico`);
  }
});

test('o painel de Backup e Compartilhar só entra quando é aberto', () => {
  const report = measureBoot({root: DESK});
  assert.ok(!report.moduleFiles.includes('src/backup-panel.mjs'),
    'o backup-panel.mjs voltou para o caminho de partida: use src/backup-panel-loader.mjs');
  assert.ok(report.dynamic.some((entry) => entry.file === 'src/backup-panel.mjs'),
    'o painel sumiu em vez de ir para o import dinâmico: use src/backup-panel-loader.mjs');
});
test('o payload de partida fica abaixo do teto e o CSS é medido', () => {
  const report = measureBoot({root: DESK});
  assert.ok(report.html.styleBytes > 0, 'nenhuma folha de estilo medida');
  assert.ok(report.bytes < 4 * MiB, `partida do renderer com ${report.bytes} bytes (teto 4 MiB)`);
});
