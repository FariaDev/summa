import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {applyBrandIcon, brandIconVariant} from '../src/accent-state.mjs';

/* Cor de acento (ticket #9): estado de interface, como o tema. Pelo adaptador
   real do app (o main.cjs usa este módulo): quem nunca escolheu vê grafite, a
   escolha volta na abertura seguinte e valor inválido nunca vira acento. */
const require = createRequire(import.meta.url);
const {deskLayout, saveState} = require('../state-adapter.cjs');

const ACCENTS = ['graphite', 'violet'];
const base = {draft: '', theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: .5};

test('quem nunca escolheu vê grafite', () => {
  assert.equal(deskLayout({}).accent, 'graphite');
  assert.equal(deskLayout(undefined).accent, 'graphite');
  assert.equal(deskLayout({theme: 'dark'}).accent, 'graphite');
});

test('cada um dos dois acentos volta como foi gravado', () => {
  for (const accent of ACCENTS) assert.equal(deskLayout({accent}).accent, accent);
});

test('valor inválido ou de tipo errado volta ao padrão grafite na carga', () => {
  for (const accent of ['roxo', '', 'GRAPHITE', 'graphite ', 0, 1, true, null, {}, ['violet']]) {
    assert.equal(deskLayout({accent}).accent, 'graphite', `carga com ${JSON.stringify(accent)}`);
  }
});

/* Regressão da decisão de 2026-11-12: quem tinha uma cor removida salva no
   estado (blue/green/orange/pink) cai no grafite, sem erro e sem aviso. */
test('estado salvo com uma cor removida vira grafite', () => {
  for (const accent of ['blue', 'green', 'orange', 'pink']) {
    assert.equal(deskLayout({accent}).accent, 'graphite', `carga com ${accent}`);
    assert.equal(saveState({...base, accent}, {...base}).accent, 'graphite', `save com ${accent}`);
  }
});

test('salvar grava a escolha nova', () => {
  for (const accent of ACCENTS) assert.equal(saveState({...base, accent: 'graphite'}, {...base, accent}).accent, accent);
});

test('salvar sem acento, ou com acento inválido, mantém o corrente (como o tema)', () => {
  const current = {...base, accent: 'violet'};
  assert.equal(saveState(current, {...base}).accent, 'violet');
  for (const accent of [null, 'roxo', '', 'VIOLET', 7, true, {}]) {
    assert.equal(saveState(current, {...base, accent}).accent, 'violet', `salvar com ${JSON.stringify(accent)}`);
  }
});

test('o acento não mexe nos outros campos do estado', () => {
  const layout = saveState({...base, accent: 'graphite', theme: 'dark'}, {...base, theme: 'dark', accent: 'violet', chatWidth: 500});
  assert.equal(layout.theme, 'dark');
  assert.equal(layout.chatWidth, 500);
  assert.equal(layout.accent, 'violet');
});


test('desk.json antigo com mascot/appIcon não volta a gravar os campos (#101)', () => {
  const old = {...base, accent: 'graphite', mascot: 'nabla', appIcon: 'm-colorido'};
  const layout = deskLayout(old);
  assert.equal('mascot' in layout, false, 'a carga não devolve mascote');
  assert.equal('appIcon' in layout, false, 'nem ícone');
  const saved = saveState(old, {...base, accent: 'violet', mascot: 'sigma', appIcon: 'm-refinado'});
  assert.equal(saved.accent, 'violet');
  assert.equal('mascot' in saved, false, 'o save ignora o campo antigo');
  assert.equal('appIcon' in saved, false);
});

/* A marca do cabeçalho (#189) é a integral a pincel no PNG do tema × tinta;
   a regra é a mesma de `app-icon-host.cjs#iconVariant`. */
function fakeBrandDoc() {
  const icons = [0, 1].map(() => {
    const attrs = new Map();
    return {setAttribute: (name, value) => attrs.set(name, value), getAttribute: (name) => attrs.get(name) ?? null};
  });
  return {documentElement: {}, querySelectorAll: () => icons, icons};
}

test('applyBrandIcon escolhe o PNG certo nas quatro combinações de tema e tinta', () => {
  const cases = [
    ['light', 'graphite', 'integral-light-graphite-128.png'],
    ['dark', 'graphite', 'integral-dark-graphite-128.png'],
    ['light', 'violet', 'integral-light-violet-128.png'],
    ['dark', 'violet', 'integral-dark-violet-128.png'],
  ];
  for (const [theme, accent, file] of cases) {
    const doc = fakeBrandDoc();
    applyBrandIcon({currentTheme: theme, currentAccent: accent}, doc, () => false);
    assert.equal(doc.icons[0].getAttribute('src'), `assets/app-icon/${file}`, `${theme} ${accent}`);
    assert.equal(doc.icons[1].getAttribute('src'), `assets/app-icon/${file}`, `${theme} ${accent}: todas as marcas`);
  }
});

test('tema auto segue o sistema; acento que não é violeta usa a tinta grafite', () => {
  assert.equal(brandIconVariant('auto', 'violet', () => true), 'dark-violet');
  assert.equal(brandIconVariant('auto', 'violet', () => false), 'light-violet');
  assert.equal(brandIconVariant('system', 'graphite', () => true), 'dark-graphite');
  for (const accent of ['graphite', 'teal']) {
    assert.equal(brandIconVariant('light', accent, () => false), 'light-graphite', accent);
    assert.equal(brandIconVariant('dark', accent, () => false), 'dark-graphite', accent);
  }
});
