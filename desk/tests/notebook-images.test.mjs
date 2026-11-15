// @ts-check
/* O PNG da página anexada que vai ao modelo: a imagem cheia da bandeja é a
   primeira escolha; quando só restou a miniatura reduzida (o que o `pending`
   guarda e o reload restaura), a página é renderizada de novo pelo disco antes
   de enviar; se a renderização falhar, a reduzida é o que sobra. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {notebookPageImages} from '../src/notebook-send.mjs';

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
