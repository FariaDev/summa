import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSetup, goToStep} from '../src/setup-flow.mjs';
import fs from 'node:fs';
import {SCENE_MODES, SCENE_TONES, SCENE_SVG, SCENE_BOX, sceneOf, sceneTabOf, scenePdfLabel, ringFor} from '../src/setup-scene.mjs';

/* #101: a cena da opção I (docs/design/marca/movimento.html). A integral se
   desenha e encolhe; a Mesa em miniatura acende uma região por vez; o tutor
   sem motor, instalando ou com falha fica com contorno fraco e estável. */
const at = (id, extra = {}) => ({...goToStep(initialSetup('setup'), id), ...extra});
const found = {claudeFound: true, visibleEngines: ['claude', 'opencode']};
const none = {claudeFound: false, opencodeFound: false, visibleEngines: ['claude', 'opencode']};

test('cada passo e quadro destaca a região da cena nova', () => {
  assert.deepEqual(sceneOf(initialSetup('setup')), {mode: 'welcome', region: '', tone: 'idle'});
  assert.deepEqual([0, 1, 2, 3].map((frame) => sceneOf(at('tour', {frame}))), [
    {mode: 'app', region: 'readers', tone: 'idle'},
    {mode: 'app', region: 'writer', tone: 'idle'},
    {mode: 'app', region: 'tutor', tone: 'idle'},
    {mode: 'app', region: 'top', tone: 'idle'},
  ]);
  assert.deepEqual(sceneOf(at('name')), {mode: 'app', region: 'top', tone: 'idle'});
  assert.deepEqual(sceneOf(at('folder')), {mode: 'app', region: 'readers', tone: 'waiting'});
  assert.deepEqual(sceneOf(at('folder', {alert: true})), {mode: 'app', region: 'readers', tone: 'dragging'});
  assert.deepEqual(sceneOf(at('folder', {folder: '/pdfs', pdfCount: 3})), {mode: 'app', region: 'readers', tone: 'found'});
  assert.deepEqual(sceneOf(at('ready')), {mode: 'ready', region: '', tone: 'idle'});
});

test('tutor: ligando pulsa, ligado fica estável, sem motor é fraco', () => {
  assert.equal(sceneOf(at('tutor'), found, {state: 'idle'}).tone, 'connecting');
  assert.equal(sceneOf(at('tutor', {online: true}), found, {state: 'idle'}).tone, 'online');
  assert.equal(sceneOf(at('tutor'), none, {state: 'idle'}).tone, 'no-engine');
  assert.equal(sceneOf(at('tutor'), none, {state: 'installing'}).tone, 'installing');
  assert.equal(sceneOf(at('tutor'), none, {state: 'error'}).tone, 'error');
  assert.equal(sceneOf(at('tutor'), none, {state: 'done'}).tone, 'connecting', 'instalou: já pode ligar');
});

test('a aba da miniatura espelha o nome, o vazio e o cursor', () => {
  assert.deepEqual(sceneTabOf(initialSetup('setup'), 'Nova matéria'), {text: 'Nova matéria', muted: true, caret: false});
  assert.deepEqual(sceneTabOf(at('tour', {frame: 2}), 'Nova matéria'), {text: 'Nova matéria', muted: true, caret: false});
  assert.deepEqual(sceneTabOf(at('name'), 'Nova matéria'), {text: 'Nova matéria', muted: true, caret: true});
  assert.deepEqual(sceneTabOf(at('name', {name: 'Cál'}), 'Nova matéria'), {text: 'Cál', muted: false, caret: true});
  assert.deepEqual(sceneTabOf(at('folder', {name: 'Cálculo I'}), 'Nova matéria'), {text: 'Cálculo I', muted: false, caret: false});
  assert.equal(scenePdfLabel('Formulario.pdf'), 'Formulario.pdf');
  assert.equal(scenePdfLabel('Um nome de PDF bem comprido.pdf'), 'Um nome de PDF …');
});

test('o contorno fica dois pixels fora da região', () => {
  assert.deepEqual(ringFor('readers'), {x: 4, y: 28, w: 208, h: 270});
  assert.deepEqual(ringFor('top'), {x: 0, y: 0, w: 330, h: 28});
  assert.deepEqual(ringFor('writer'), {x: 338, y: 0, w: 182, h: 300});
  assert.deepEqual(ringFor(''), {x: 0, y: 0, w: 520, h: 300});
  assert.deepEqual(SCENE_BOX.all, [2, 2, 516, 296]);
});

test('a cena e o CSS cobrem todos os estados, sem luminária', () => {
  const css = fs.readFileSync(new URL('../src/first-run.css', import.meta.url), 'utf8');
  for (const mode of SCENE_MODES) assert.ok(css.includes(`[data-scene="${mode}"]`), `${mode}: estado da cena no CSS`);
  for (const tone of SCENE_TONES.filter((tone) => tone !== 'idle' && tone !== 'waiting' && tone !== 'found' && tone !== 'online')) {
    assert.ok(css.includes(`[data-tone="${tone}"]`), `${tone}: contorno no CSS`);
  }
  assert.ok(SCENE_SVG.includes('brand-spine'), 'a integral usa a máscara da linha central');
  for (const region of ['top', 'readers', 'tutor', 'writer']) assert.ok(SCENE_SVG.includes(`data-region="${region}"`), `${region}: região da miniatura`);
  assert.ok(SCENE_SVG.includes('data-scene-tab'), 'a aba da miniatura');
  assert.ok(SCENE_SVG.includes('data-pdf="0"'), 'as páginas dos PDFs');
  assert.match(css, /\.setup-scene\{[^}]*--scene-ink:var\(--fg\)/, 'grafite usa a tinta do tema');
  assert.match(css, /:root\[data-accent="violet"\] \.setup-scene\{--scene-ink:var\(--acc-violet-text\)\}/, 'violeta usa a tinta aprovada');
  assert.doesNotMatch(SCENE_SVG, /sl-pool|sl-beam-shape|mascote|personagem/i, 'sem luminária nem personagens');
});

test('movimento reduzido mostra o estado final, sem desenho nem piscada', () => {
  const css = fs.readFileSync(new URL('../src/first-run.css', import.meta.url), 'utf8');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion:reduce)'));
  assert.match(reduced, /\.setup-scene \.brand-spine\{animation:none!important/);
  assert.match(reduced, /\.setup-scene \.caret\{animation:none!important/);
  assert.match(reduced, /\.setup-scene \.mini-region,/);
  assert.match(reduced, /\.setup-scene\[data-leaving\] \.layer\.brand\{transform:none\}/);
});
