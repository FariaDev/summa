import test from 'node:test';
import assert from 'node:assert/strict';
import {createPdfjsLoader,pdfjsDataUrls} from '../src/pdf/pdfjs-loader.mjs';

test('pdfjsDataUrls resolve as pastas com barra final na base do documento', () => {
  for (const base of ['file:///x/desk/index.html', 'http://localhost:5173/']) {
    const urls = pdfjsDataUrls(base);
    for (const url of Object.values(urls)) {
      assert.ok(url.endsWith('/'), `${base}: ${url}`);
      assert.ok(new URL(url).pathname.includes('/node_modules/pdfjs-dist/'), `${base}: ${url}`);
    }
  }
});

test('loadPdfjs avalia o módulo uma vez, mesmo com dois PDFs abrindo juntos', async () => {
  let calls = 0;
  const fake = {GlobalWorkerOptions: {workerSrc: ''}};
  const loadPdfjs = createPdfjsLoader({load: async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return fake;
  }});
  const [first, second] = await Promise.all([loadPdfjs(), loadPdfjs()]);
  assert.equal(calls, 1);
  assert.equal(first, fake);
  assert.equal(second, fake);
  assert.match(fake.GlobalWorkerOptions.workerSrc, /pdf\.worker\.mjs$/);
});

test('falha no import libera a próxima tentativa', async () => {
  let calls = 0;
  const fake = {GlobalWorkerOptions: {workerSrc: ''}};
  const loadPdfjs = createPdfjsLoader({load: async () => {
    calls++;
    if (calls === 1) throw Error('sem disco');
    return fake;
  }});
  await assert.rejects(loadPdfjs(), /sem disco/);
  assert.equal(await loadPdfjs(), fake);
  assert.equal(calls, 2);
});

test('o carregador padrão devolve o mesmo pdf.js em chamadas repetidas', async () => {
  const {loadPdfjs} = await import('../src/pdf/pdfjs-loader.mjs');
  const first = await loadPdfjs();
  assert.equal(await loadPdfjs(), first);
  assert.match(first.GlobalWorkerOptions.workerSrc, /pdf\.worker\.mjs$/);
});
