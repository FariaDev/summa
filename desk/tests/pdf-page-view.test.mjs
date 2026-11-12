/* Opções visuais do `ler_pdf` (#114) e as marcas do tutor (#113): validação,
   contradição com `imagem: "nao"`, o PNG forçado mesmo em página de texto e o
   caminho de acesso inalterado. O PDF sintético existe só aqui. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tinyPdf} from './helpers.mjs';
import {fakePdfjs} from './fake-pdf-render.mjs';
import {normalizePageView} from '../pdf-page-view.cjs';
import {pdfTool, readPdfPages} from '../src/extensions/mesa-mcp/pdf-tool.mjs';

const require = createRequire(import.meta.url);
const {createPdfPageReader, MAX_IMAGE_CHARS} = require('../pdf-page-text.cjs');
const {resolveTutorPdf} = require('../pdf-read-path.cjs');
const {createActivityBridge} = require('../activity-bridge.cjs');

function withPdf(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-view-'));
  const file = path.join(dir, 'Apostila torta.pdf');
  fs.writeFileSync(file, tinyPdf(['Limites', 'sen x sobre x']));
  return Promise.resolve(fn(file)).catch((error) => { throw error; }).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
}

function textReader(renders = []) {
  return createPdfPageReader({
    loadPdfjs: async () => fakePdfjs({text: 'Limites', fnArray: [1], ops: {showText: 1}}),
    readFile: () => Buffer.from('%PDF'),
    renderPage: async (request) => { renders.push(request); return 'png-transformado'; },
  });
}

test('as opções visuais normalizam giro, recorte e ampliação', () => {
  assert.deepEqual(normalizePageView({}), {girar: 0, recorte: null, ampliar: 1, marcas: [], visual: false});
  assert.deepEqual(normalizePageView({girar: 90}), {girar: 90, recorte: null, ampliar: 1, marcas: [], visual: true});
  assert.deepEqual(normalizePageView({girar: 180, ampliar: 2.5}), {girar: 180, recorte: null, ampliar: 2.5, marcas: [], visual: true});
  assert.deepEqual(normalizePageView({recorte: {x: 0, y: 0, largura: 0.5, altura: 0.25}}), {
    girar: 0,
    recorte: {x: 0, y: 0, largura: 0.5, altura: 0.25},
    ampliar: 1,
    marcas: [],
    visual: true,
  });
  assert.equal(normalizePageView({imagem: 'nao'}).visual, false);
  assert.equal(normalizePageView({imagem: 'auto', girar: 270}).visual, true);
});

test('as marcas normalizam por forma e usam o quadro da página depois do giro', () => {
  const marcas = [
    {forma: 'circulo', x: 0.1, y: 0.1, largura: 0.2, altura: 0.2},
    {forma: 'seta', x: 0.5, y: 0.5, largura: 0.2, altura: 0.2},
    {forma: 'destaque', x: 0, y: 0, largura: 0.1, altura: 0.1},
  ];
  assert.deepEqual(normalizePageView({girar: 90, marcas}), {girar: 90, recorte: null, ampliar: 1, marcas, visual: true});
});

test('marca inválida devolve o recebido e o formato, e a lista respeita o teto', () => {
  const base = {x: 0.1, y: 0.1, largura: 0.2, altura: 0.2};
  const lista = (count) => Array.from({length: count}, () => ({forma: 'circulo', ...base}));
  assert.throws(() => normalizePageView({marcas: 'circulo'}), /marcas inválido: recebido "circulo"; esperado lista de 1 a 8 marcas/);
  assert.throws(() => normalizePageView({marcas: []}), /marcas inválido: recebido array\(0\); esperado lista de 1 a 8 marcas/);
  assert.throws(() => normalizePageView({marcas: lista(9)}), /marcas inválido: recebido array\(9\); esperado lista de até 8 marcas/);
  assert.throws(() => normalizePageView({marcas: [{forma: 'linha', ...base}]}), /marcas\[0\]\.forma inválido: recebido "linha"; esperado circulo, seta ou destaque/);
  assert.throws(() => normalizePageView({marcas: ['circulo']}), /marcas\[0\] inválido: recebido "circulo"; esperado \{forma, x, y, largura, altura\}/);
  assert.throws(() => normalizePageView({marcas: [{forma: 'circulo', ...base, x: -0.1}]}), /marcas\[0\]\.x inválido: recebido -0\.1; esperado número de 0 a 1/);
  assert.throws(() => normalizePageView({marcas: [{forma: 'circulo', ...base, largura: 0}]}), /marcas\[0\]\.largura inválido: recebido 0; esperado número maior que 0 e até 1/);
  assert.throws(() => normalizePageView({marcas: [{forma: 'circulo', ...base, x: 0.9}]}), /marcas\[0\] \(x \+ largura\) inválido: recebido 1\.1; esperado até 1/);
  assert.throws(() => normalizePageView({marcas: [{forma: 'circulo', ...base, y: 0.9}]}), /marcas\[0\] \(y \+ altura\) inválido: recebido 1\.1; esperado até 1/);
});

test('valor inválido devolve o recebido e o formato esperado', () => {
  assert.throws(() => normalizePageView({girar: 45}), /girar inválido: recebido 45; esperado 90, 180 ou 270/);
  assert.throws(() => normalizePageView({girar: 0}), /girar inválido: recebido 0; esperado 90, 180 ou 270/);
  assert.throws(() => normalizePageView({ampliar: 5}), /ampliar inválido: recebido 5; esperado número de 1 a 3/);
  assert.throws(() => normalizePageView({ampliar: 'muito'}), /ampliar inválido: recebido "muito"; esperado número de 1 a 3/);
  assert.throws(() => normalizePageView({recorte: 'meio'}), /recorte inválido: recebido "meio"; esperado \{x, y, largura, altura\}/);
  assert.throws(() => normalizePageView({recorte: {x: -0.1, y: 0, largura: 0.5, altura: 0.5}}), /recorte\.x inválido: recebido -0\.1; esperado número de 0 a 1/);
  assert.throws(() => normalizePageView({recorte: {x: 0, y: 0, largura: 0, altura: 0.5}}), /recorte\.largura inválido: recebido 0; esperado número maior que 0 e até 1/);
  assert.throws(() => normalizePageView({recorte: {x: 0.7, y: 0, largura: 0.5, altura: 0.5}}), /recorte \(x \+ largura\) inválido: recebido 1\.2; esperado até 1/);
});

test('opção visual junto de imagem: nao é contradição; auto pede o PNG até numa página de texto', async () => {
  const renders = [];
  const reader = textReader(renders);
  const marcas = [{forma: 'destaque', x: 0.1, y: 0.1, largura: 0.2, altura: 0.2}];
  const transformed = await reader.read({
    file: '/c/Aula.pdf', first: 1, imagem: 'auto', girar: 90, recorte: {x: 0.25, y: 0.25, largura: 0.5, altura: 0.5}, ampliar: 2, marcas,
  });
  assert.equal(transformed.pages[0].kind, 'text');
  assert.equal(transformed.pages[0].image, 'png-transformado');
  assert.deepEqual(renders[0], {file: '/c/Aula.pdf', page: 1, girar: 90, recorte: {x: 0.25, y: 0.25, largura: 0.5, altura: 0.5}, ampliar: 2, marcas});

  await assert.rejects(
    () => textReader().read({file: '/c/Aula.pdf', first: 1, imagem: 'nao', girar: 90}),
    /imagem "nao" não combina com girar, recorte, ampliar ou marcas/,
  );
  await assert.rejects(
    () => textReader().read({file: '/c/Aula.pdf', first: 1, imagem: 'nao', recorte: {x: 0, y: 0, largura: 0.5, altura: 0.5}}),
    /imagem "nao" não combina/,
  );
  await assert.rejects(
    () => textReader().read({file: '/c/Aula.pdf', first: 1, imagem: 'nao', marcas}),
    /imagem "nao" não combina/,
  );
  await assert.rejects(() => textReader().read({file: '/c/Aula.pdf', first: 1, ampliar: 4}), /ampliar inválido: recebido 4/);
});

test('PNG acima do teto vira aviso de texto, não falha calada', async () => {
  const reader = createPdfPageReader({
    loadPdfjs: async () => fakePdfjs({text: 'Limites', fnArray: [1], ops: {showText: 1}}),
    readFile: () => Buffer.from('%PDF'),
    renderPage: async () => 'x'.repeat(MAX_IMAGE_CHARS + 1),
  });
  const result = await reader.read({file: '/c/Aula.pdf', first: 1, imagem: 'sim', ampliar: 3});
  assert.equal(result.pages[0].image, undefined);
  assert.match(result.pages[0].imageError, new RegExp(`teto é ${MAX_IMAGE_CHARS}`));
});

test('o PDF original fica intacto depois de girar, recortar e ampliar', () => withPdf(async (file) => {
  const before = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const result = await textReader().read({file, first: 1, girar: 270, recorte: {x: 0, y: 0, largura: 0.5, altura: 0.5}, ampliar: 3});
  const after = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(result.pages[0].image, 'png-transformado');
  assert.equal(after, before, 'o arquivo original não muda');
}));

test('as opções não abrem caminho novo: fora da biblioteca continua recusado', () => withPdf(async (file) => {
  const reader = textReader();
  const allowed = new Set([file]);
  const bridge = createActivityBridge({
    publish: async () => { throw Error('não publica'); },
    pdfPage: (raw) => reader.read({
      file: resolveTutorPdf(raw.path, allowed), first: raw.first, last: raw.last, imagem: raw.imagem, girar: raw.girar, recorte: raw.recorte, ampliar: raw.ampliar, marcas: raw.marcas,
    }),
  });
  await bridge.start();
  try {
    const tool = pdfTool({grant: bridge.grant({conversationId: 'opencode-view', generation: 1}, {engine: 'opencode'})});
    const ok = await tool.call({caminho: file, pagina: 1, girar: 90, recorte: {x: 0, y: 0, largura: 0.5, altura: 0.5}, ampliar: 2});
    assert.equal(ok.isError, undefined);
    const outside = await tool.call({caminho: '/etc/hosts', pagina: 1, girar: 90, recorte: {x: 0, y: 0, largura: 0.5, altura: 0.5}, ampliar: 2});
    assert.equal(outside.isError, true);
    assert.match(outside.content[0].text, /PDF recusado: recebi "\/etc\/hosts"/);
    assert.equal(outside.content[0].text.includes(path.basename(file)), false, 'a recusa não lista outros PDFs da biblioteca');
  } finally {
    await bridge.close();
  }
}));

test('readPdfPages leva as opções visuais e as marcas à rota /pdf-page', async () => {
  let body = null;
  const grant = {url: 'http://127.0.0.1:9/activity', token: 't'};
  const marcas = [{forma: 'circulo', x: 0.1, y: 0.2, largura: 0.3, altura: 0.4}];
  const result = await readPdfPages(grant, {
    caminho: '/c/Aula.pdf', pagina: 2, ate: 3, imagem: 'auto', girar: 180, recorte: {x: 0.1, y: 0.2, largura: 0.3, altura: 0.4}, ampliar: 2, marcas,
  }, {
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({read: true, file: 'Aula.pdf', total: 3, pages: []}), {status: 200});
    },
  });
  assert.equal(result.read, true);
  assert.deepEqual(body, {
    path: '/c/Aula.pdf', first: 2, last: 3, imagem: 'auto', girar: 180, recorte: {x: 0.1, y: 0.2, largura: 0.3, altura: 0.4}, ampliar: 2, marcas,
  });
});

test('erro de valor inválido chega ao tutor pela ferramenta com o valor e o formato', () => withPdf(async (file) => {
  const reader = textReader();
  const allowed = new Set([file]);
  const bridge = createActivityBridge({
    publish: async () => { throw Error('não publica'); },
    pdfPage: (raw) => reader.read({
      file: resolveTutorPdf(raw.path, allowed), first: raw.first, last: raw.last, imagem: raw.imagem, girar: raw.girar, recorte: raw.recorte, ampliar: raw.ampliar, marcas: raw.marcas,
    }),
  });
  await bridge.start();
  try {
    const tool = pdfTool({grant: bridge.grant({conversationId: 'opencode-view', generation: 1}, {engine: 'opencode'})});
    const out = await tool.call({caminho: file, pagina: 1, girar: 45});
    assert.equal(out.isError, true);
    assert.match(out.content[0].text, /HTTP 400/);
    assert.match(out.content[0].text, /girar inválido: recebido 45; esperado 90, 180 ou 270/);
    assert.equal(out.content[0].text.includes(file), false, 'o erro não repete o caminho pessoal');

    const badMark = await tool.call({caminho: file, pagina: 1, marcas: [{forma: 'linha', x: 0.1, y: 0.1, largura: 0.2, altura: 0.2}]});
    assert.equal(badMark.isError, true);
    assert.match(badMark.content[0].text, /HTTP 400/);
    assert.match(badMark.content[0].text, /marcas\[0\]\.forma inválido: recebido "linha"; esperado circulo, seta ou destaque/);
    assert.equal(badMark.content[0].text.includes(file), false, 'o erro da marca também não repete o caminho pessoal');
  } finally {
    await bridge.close();
  }
}));
