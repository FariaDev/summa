/* Fallback do SVG inline que o sanitizador esvazia (#150): a detecção é
   estrutural e pura o bastante para rodar sem DOM. O caso medido: `<use>`,
   `<image>` e `<style>` somem na guarda; sem eles sobrava um `<svg>` vazio na
   resposta (quadro em branco, sem aviso). O que desenha é a tag na árvore
   renderizada — definição (`<defs>`, `<symbol>`, gradiente, filtro) e `<text>`
   vazio não contam. A janela prova o que o aluno vê (`svg-blank-ui.mjs`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {dropBlankSvg, svgFallbackHtml, svgHasVisibleContent} from '../src/figures/svg-blank.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Árvore mínima no formato que `svgHasVisibleContent` lê do navegador:
   `querySelectorAll('*')` devolve os descendentes em ordem de documento. */
function fakeElement(localName, children = [], {text = '', namespace = SVG_NS} = {}) {
  const node = {localName, namespaceURI: namespace, parentElement: null, textContent: text, children};
  node.querySelectorAll = () => children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
  for (const child of children) child.parentElement = node;
  return node;
}

function fakeSvg(...children) {
  return fakeElement('svg', children);
}

test('SVG sem nada que desenhe cai para código: vazio, só defs/symbol ou só use/image/style', () => {
  assert.equal(svgHasVisibleContent(fakeSvg()), false, 'svg vazio');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('defs', [fakeElement('rect')]))), false, 'defs não desenha');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('symbol', [fakeElement('path')]))), false, 'symbol não desenha');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('use'))), false, 'use sai na guarda');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('image'))), false, 'image sai na guarda');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('style'))), false, 'style sai na guarda');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('text', [], {text: '   '}))), false, 'texto vazio não pinta');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('title', [], {text: 'rótulo'}))), false, 'title é metadado');
});

test('SVG com geometria ou texto visível continua figura', () => {
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('rect'))), true, 'rect');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('g', [fakeElement('circle')]))), true, 'g com círculo');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('text', [], {text: 'oi'}))), true, 'texto com conteúdo');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('text', [fakeElement('tspan', [], {text: 'oi'})]))), true, 'tspan com conteúdo');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('a', [fakeElement('path')]))), true, 'link interno com caminho');
  assert.equal(svgHasVisibleContent(fakeSvg(fakeElement('rect', [], {namespace: 'http://www.w3.org/1999/xhtml'}))), false, 'HTML dentro do SVG não pinta');
});

test('o fallback mostra aviso visível e o SVG original como código, nunca markup cru', () => {
  const html = svgFallbackHtml('<svg viewBox="0 0 10 10"><use href="#a"/></svg>');
  assert.match(html, /class="plot-warning figure-warning"/, 'o aviso usa a moldura de aviso já estilizada');
  assert.match(html, /data-svg-error="blank"/);
  assert.match(html, /data-lang="svg"/, 'o bloco leva a etiqueta SVG');
  assert.match(html, /&lt;/, 'o `<` do SVG aparece escapado');
  assert.match(html, />use</, 'o SVG aparece como texto realçado');
  assert.match(html, />href</, 'o atributo do SVG aparece como texto');
  assert.match(html, /&lt;style&gt;/, 'o aviso escapa os nomes das tags');
  assert.doesNotMatch(html, /<use\b/, 'o SVG não volta como markup vivo');
  assert.match(html, /código|code/, 'o aviso diz que virou código');
});

test('sem DOM a passagem devolve o HTML como veio', () => {
  const html = '<p><svg><use href="#a"/></svg></p>';
  assert.deepEqual(dropBlankSvg(html, null, {}), {html, sources: []});
});
