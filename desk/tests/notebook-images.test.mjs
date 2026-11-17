// @ts-check
/* O PNG da página anexada que vai ao modelo: a imagem cheia da bandeja é a
   primeira escolha; quando só restou a miniatura reduzida (o que o `pending`
   guarda e o reload restaura), a página é renderizada de novo pelo disco antes
   de enviar; se a renderização falhar, a reduzida é o que sobra. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {notebookPageImages, cropPagePng, pngPixelSize, recorteRect} from '../src/notebook-send.mjs';

const PAGE = {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'};
const FULL = 'data:image/png;base64,FULL';
const SMALL = 'data:image/png;base64,SMALL';
const FRESH = 'data:image/png;base64,FRESH';

test('a imagem cheia da bandeja vai como está, sem renderizar de novo', async () => {
  const reads = [];
  const images = await notebookPageImages([PAGE], {
    find: () => ({thumb: FULL, full: true}),
    readPage: async () => { reads.push('leu'); return FRESH; },
  });
  assert.deepEqual(images, [{dataUrl: FULL}]);
  assert.deepEqual(reads, [], 'a resolução cheia não paga a renderização do disco');
});

test('depois de recarregar só resta a reduzida: renderiza de novo antes de enviar', async () => {
  const reads = [];
  const images = await notebookPageImages([PAGE], {
    find: () => ({thumb: SMALL, full: false}),
    readPage: async (item) => { reads.push(item); return FRESH; },
  });
  assert.deepEqual(images, [{dataUrl: FRESH}], 'o modelo recebe a página cheia, não a miniatura de 240 px');
  assert.deepEqual(reads, [PAGE]);
});

test('renderização que falha cai na miniatura reduzida; sem nenhuma das duas, a página não vira imagem', async () => {
  const fallback = await notebookPageImages([PAGE], {
    find: () => ({thumb: SMALL, full: false}),
    readPage: async () => { throw Error('xournalpp falhou'); },
  });
  assert.deepEqual(fallback, [{dataUrl: SMALL}]);
  const none = await notebookPageImages([PAGE], {
    find: () => null,
    readPage: async () => { throw Error('sem arquivo'); },
  });
  assert.deepEqual(none, []);
});

test('uma imagem por caderno, na ordem da bandeja e até o teto', async () => {
  const pages = Array.from({length: 5}, (_, at) => ({caminho: `/c/${at}.xopp`, pagina: 1, nome: `N${at}`}));
  const images = await notebookPageImages(pages, {
    find: (item) => ({thumb: `data:image/png;base64,${item.nome}`, full: true}),
  });
  assert.deepEqual(images.map((item) => item.dataUrl), ['data:image/png;base64,N0', 'data:image/png;base64,N1', 'data:image/png;base64,N2', 'data:image/png;base64,N3']);
});

const EXCERPT = {x: 0, y: 286, largura: 595, altura: 555};
const CROPPED = 'data:image/png;base64,CROPPED';
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
/* Só o cabeçalho de um PNG (assinatura + IHDR com a largura e a altura): o que `pngPixelSize` lê. */
const pngHeader = (width, height) => `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), u32(13), Buffer.from('IHDR'), u32(width), u32(height)]).toString('base64')}`;

test('depois de recarregar, a página re-renderizada é cortada pelo recorte do cartão', async () => {
  const crops = [];
  const images = await notebookPageImages([{...PAGE, recorte: EXCERPT}], {
    find: () => ({thumb: SMALL, full: false}),
    readPage: async () => FRESH,
    crop: async (dataUrl, recorte) => { crops.push({dataUrl, recorte}); return CROPPED; },
  });
  assert.deepEqual(images, [{dataUrl: CROPPED}], 'o modelo recebe só o trecho');
  assert.deepEqual(crops, [{dataUrl: FRESH, recorte: EXCERPT}]);
});

test('se o corte falha, vai a miniatura reduzida (que já é o trecho), nunca a página inteira', async () => {
  const failing = async () => { throw Error('canvas'); };
  const thumb = await notebookPageImages([{...PAGE, recorte: EXCERPT}], {find: () => ({thumb: SMALL, full: false}), readPage: async () => FRESH, crop: failing});
  assert.deepEqual(thumb, [{dataUrl: SMALL}]);
  const blank = await notebookPageImages([{...PAGE, recorte: EXCERPT}], {find: () => ({thumb: SMALL, full: false}), readPage: async () => FRESH, crop: async () => ''});
  assert.deepEqual(blank, [{dataUrl: SMALL}]);
  const nothing = await notebookPageImages([{...PAGE, recorte: EXCERPT}], {find: () => null, readPage: async () => FRESH, crop: failing});
  assert.deepEqual(nothing, [], 'sem miniatura e com o corte falho, a página não entra inteira');
});

test('com recorte e sem a renderização, a reduzida é o trecho; a bandeja cheia não passa pelo corte', async () => {
  const crops = [];
  const crop = async () => { crops.push(1); return CROPPED; };
  assert.deepEqual(await notebookPageImages([{...PAGE, recorte: EXCERPT}], {find: () => ({thumb: SMALL, full: false}), readPage: async () => { throw Error('sem arquivo'); }, crop}), [{dataUrl: SMALL}]);
  assert.deepEqual(await notebookPageImages([{...PAGE, recorte: EXCERPT}], {find: () => ({thumb: FULL, full: true}), readPage: async () => FRESH, crop}), [{dataUrl: FULL}]);
  assert.deepEqual(crops, [], 'o corte só roda na página renderizada do disco');
});

test('sem recorte no cartão, a página re-renderizada vai inteira e o corte não roda', async () => {
  const crops = [];
  const images = await notebookPageImages([PAGE], {find: () => ({thumb: SMALL, full: false}), readPage: async () => FRESH, crop: async () => { crops.push(1); return CROPPED; }});
  assert.deepEqual(images, [{dataUrl: FRESH}]);
  assert.deepEqual(crops, []);
});

test('o tamanho do PNG sai do cabeçalho IHDR; o que não é PNG não tem tamanho', () => {
  assert.deepEqual(pngPixelSize(pngHeader(992, 1403)), {width: 992, height: 1403});
  assert.deepEqual(pngPixelSize('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC'), {width: 1, height: 1});
  assert.equal(pngPixelSize('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'), null);
  assert.equal(pngPixelSize(`data:image/png;base64,${'A'.repeat(32)}`), null, 'sem a assinatura não é PNG');
  assert.equal(pngPixelSize(FULL), null, 'base64 curto demais');
  assert.equal(pngPixelSize(undefined), null);
});

test('o trecho em pontos vira pixels a 120 DPI, preso à imagem; fora dela não há corte', () => {
  const size = {width: 992, height: 1403};
  assert.deepEqual(recorteRect(EXCERPT, size), {sx: 0, sy: 477, sw: 992, sh: 925});
  assert.deepEqual(recorteRect({x: 0, y: 800, largura: 595, altura: 555}, size), {sx: 0, sy: 1333, sw: 992, sh: 70}, 'o que passa do fim da página some');
  assert.equal(recorteRect({x: 1000, y: 0, largura: 10, altura: 10}, size), null);
});

test('o corte sem PNG válido ou com trecho fora da página devolve vazio, sem tocar o canvas', async () => {
  assert.equal(await cropPagePng('data:image/png;base64,AAAA', EXCERPT), '');
  assert.equal(await cropPagePng(pngHeader(992, 1403), {x: 1000, y: 0, largura: 10, altura: 10}), '');
});
