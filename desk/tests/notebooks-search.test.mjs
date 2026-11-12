import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {NOTEBOOK_MAX_XML_BYTES} from '../src/notebook-xopp.mjs';
import {ptMatches, ptText} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createNotebookSearch, registerNotebookSearchHost} = require('../notebooks-search-host.cjs');

/* Busca no texto digitado dos cadernos (#158, passo 1, grátis): o índice
   junta as caixas `<text>` e o LaTeX (`<teximage text=...>`) de cada página
   dos `.xopp` só da biblioteca, sem nenhum modelo. Sem diferenciar caixa e
   acento; cache em memória por caminho+mtime+tamanho; gzip com teto de 32 MB
   assíncrono; XML com DOCTYPE/ENTITY é ignorado; fora da biblioteca não
   aparece; limite de resultados. Nenhuma rede, nenhum modelo. */

function xmlPaginas(pages) {
  const body = pages.map((texts) => {
    const boxes = texts.map((text, index) => `<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="${100 + index * 40}.00">${text}</text>`).join('\n');
    return `<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n${boxes}\n</layer>\n</page>`;
  }).join('\n');
  return `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n${body}\n</xournal>\n`;
}

function writeXopp(dir, xml, name = 'aula.xopp') {
  const file = path.join(dir, name);
  fs.writeFileSync(file, zlib.gzipSync(xml));
  return file;
}

function createFakeIpcMain() {
  const handlers = new Map();
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, payload) => handlers.get(channel)({}, payload),
  };
}

function setupSearch({listNotebooks, readFile, stat, gunzip} = {}) {
  const deps = {listNotebooks};
  if (readFile) deps.readFile = readFile;
  if (stat) deps.stat = stat;
  if (gunzip) deps.gunzip = gunzip;
  return createNotebookSearch(deps);
}

test('acha texto e LaTeX por página, com caderno, matéria e trecho', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-'));
  try {
    const xml = `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Limites laterais</text>\n<teximage text="x^2 + y^2" left="100" top="150" right="220" bottom="180">iVBORw0KG=</teximage>\n</layer>\n</page>\n<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Derivadas</text>\n</layer>\n</page>\n</xournal>\n`;
    const file = writeXopp(dir, xml);
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file, materia: 'Cálculo'}]});
    const hits = await search.searchNotebooks('cálculo');
    assert.deepEqual(hits, []);
    const latex = await search.searchNotebooks('x^2');
    assert.equal(latex.length, 1);
    assert.equal(latex[0].caminho, file);
    assert.equal(latex[0].nomeExibido, 'aula.xopp');
    assert.equal(latex[0].materia, 'Cálculo');
    assert.equal(latex[0].pagina, 1);
    assert.match(latex[0].trecho, /x\^2 \+ y\^2/);
    const text = await search.searchNotebooks('derivadas');
    assert.equal(text.length, 1);
    assert.equal(text[0].pagina, 2);
    assert.match(text[0].trecho, /Derivadas/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('sem diferenciar caixa e acento, nos dois sentidos', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-'));
  try {
    const file = writeXopp(dir, xmlPaginas([['Equação do primeiro grau'], ['equacao do segundo grau']]), 'equacoes.xopp');
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'equacoes.xopp', path: file, materia: 'Cálculo'}]});
    const semAcento = await search.searchNotebooks('EQUACAO');
    assert.equal(semAcento.length, 2);
    assert.deepEqual(semAcento.map((hit) => hit.pagina), [1, 2]);
    const comAcento = await search.searchNotebooks('equação do SEGUNDO');
    assert.equal(comAcento.length, 1);
    assert.equal(comAcento[0].pagina, 2);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('cache por mtime: sem mudar o arquivo não lê de novo; mudou o mtime, lê de novo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-cache-'));
  try {
    const file = writeXopp(dir, xmlPaginas([['primeira versão']]));
    let reads = 0;
    const readFile = async (target, ...args) => {
      reads += 1;
      return fs.promises.readFile(target, ...args);
    };
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file, materia: 'Cálculo'}], readFile});
    assert.equal((await search.searchNotebooks('versão')).length, 1);
    assert.equal(reads, 1);
    assert.equal((await search.searchNotebooks('versão')).length, 1);
    assert.equal(reads, 1, 'o segundo pedido saiu do cache');
    fs.writeFileSync(file, zlib.gzipSync(xmlPaginas([['segunda versão']])));
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(file, future, future);
    assert.equal((await search.searchNotebooks('segunda')).length, 1);
    assert.equal(reads, 2, 'mtime novo invalida o cache');
    assert.equal((await search.searchNotebooks('primeira')).length, 0);
    assert.equal(reads, 2, 'e o resultado novo fica no cache');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('gzip gigante acima do teto de 32 MB é ignorado sem travar a busca', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-bomba-'));
  try {
    const bomba = path.join(dir, 'bomba.xopp');
    /* Mínimo que cruza o teto (um byte a mais) e nível 1: o inflate para no
       teto de qualquer jeito, e o teste fica barato (#182). */
    fs.writeFileSync(bomba, zlib.gzipSync(Buffer.alloc(NOTEBOOK_MAX_XML_BYTES + 4096, 0), {level: 1}));
    const bom = writeXopp(dir, xmlPaginas([['ágil como um gato']]), 'bom.xopp');
    const search = setupSearch({
      listNotebooks: () => [
        {courseId: 'calc', name: 'bomba.xopp', path: bomba, materia: 'Cálculo'},
        {courseId: 'calc', name: 'bom.xopp', path: bom, materia: 'Cálculo'},
      ],
    });
    const cpuBefore = process.cpuUsage();
    const hits = await search.searchNotebooks('gato');
    const cpu = process.cpuUsage(cpuBefore);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].nomeExibido, 'bom.xopp');
    /* Carga da máquina multiplica o relógio (medido 9,9 s a load 45 com esta
       bomba), não o trabalho: o teto de 32 MiB gasta ~0,4 s de CPU em
       qualquer carga. O limite de 5 s pega trabalho desmedido (parse da bomba
       inteira, laço sem teto), não a fila do escalonador (#182). */
    const cpuMs = (cpu.user + cpu.system) / 1000;
    assert.ok(cpuMs < 5000, `a bomba é ignorada sem trabalho desmedido (${cpuMs.toFixed(0)} ms de CPU)`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('XML com DOCTYPE/ENTITY é ignorado e não derruba os outros', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-doctype-'));
  try {
    const xmlMau = `<?xml version="1.0" standalone="no"?>\n<!DOCTYPE xournal [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<xournal version="4">\n<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">segredo do xxe</text>\n</layer>\n</page>\n</xournal>\n`;
    const mau = writeXopp(dir, xmlMau, 'mau.xopp');
    const bom = writeXopp(dir, xmlPaginas([['treino de prova']]), 'treino.xopp');
    const search = setupSearch({
      listNotebooks: () => [
        {courseId: 'calc', name: 'mau.xopp', path: mau, materia: 'Cálculo'},
        {courseId: 'calc', name: 'treino.xopp', path: bom, materia: 'Cálculo'},
      ],
    });
    assert.deepEqual(await search.searchNotebooks('xxe'), [], 'o conteúdo com DOCTYPE não entra no índice');
    const hits = await search.searchNotebooks('prova');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].nomeExibido, 'treino.xopp');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('caderno fora da biblioteca não aparece no resultado', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-fora-'));
  try {
    const dentro = writeXopp(dir, xmlPaginas([['termo buscado aqui']]), 'dentro.xopp');
    const fora = writeXopp(dir, xmlPaginas([['termo buscado aqui']]), 'fora.xopp');
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'dentro.xopp', path: dentro, materia: 'Cálculo'}]});
    const hits = await search.searchNotebooks('buscado');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].caminho, dentro);
    assert.equal(hits[0].caminho === fora, false);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('limite de resultados e consulta inválida sem caminho pessoal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-limite-'));
  try {
    const items = [];
    for (let index = 0; index < 8; index += 1) {
      const file = writeXopp(dir, xmlPaginas([[`alvo ${index} um`, `alvo ${index} dois`, `alvo ${index} três`]]), `c${index}.xopp`);
      items.push({courseId: 'calc', name: `c${index}.xopp`, path: file, materia: 'Cálculo'});
    }
    const search = setupSearch({listNotebooks: () => items});
    const hits = await search.searchNotebooks('alvo');
    assert.ok(hits.length > 0, 'acha os alvos');
    assert.ok(hits.length <= 50, `no máximo 50 resultados (veio ${hits.length})`);
    assert.equal(hits.length, 8, 'uma página com vários trechos vira um resultado só');
    assert.deepEqual(await search.searchNotebooks('   '), [], 'consulta vazia não busca nada');
    await assert.rejects(() => search.searchNotebooks(42), (error) => {
      assert.ok(ptMatches(/recebido/)(error), `o erro diz o recebido e o esperado (${ptText(String(error?.message || error))})`);
      assert.ok(!String(error?.message || error).includes(dir), 'o erro não traz caminho pessoal');
      assert.ok(!ptText(String(error?.message || error)).includes(dir), 'nem decodificado');
      return true;
    });
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('IPC notebooks-search devolve o mesmo formato pelo canal do preload', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-ipc-'));
  try {
    const file = writeXopp(dir, xmlPaginas([['integral dupla']]), 'integral.xopp');
    const ipcMain = createFakeIpcMain();
    registerNotebookSearchHost({
      ipcMain,
      courses: () => [{id: 'calc', name: 'Cálculo', path: dir}],
      listNotebooks: () => [{courseId: 'calc', name: 'integral.xopp', path: file, materia: 'Cálculo'}],
    });
    const hits = await ipcMain.invoke('notebooks-search', 'INTEGRAL');
    assert.equal(hits.length, 1);
    assert.deepEqual(Object.keys(hits[0]).sort(), ['caminho', 'materia', 'nomeExibido', 'origem', 'pagina', 'trecho']);
    assert.equal(hits[0].origem, 'texto');
    assert.equal(hits[0].pagina, 1);
    assert.match(hits[0].trecho, /integral/);
    await assert.rejects(() => ipcMain.invoke('notebooks-search', {query: 'x'}), (error) => {
      assert.ok(!String(error.message).includes(dir), 'o erro do IPC não traz caminho pessoal');
      return true;
    });
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* --- Regressões da revisão #158 (065ab272): corrida, bloqueio, trecho,
   leitura sem teto, UX e cache. Cada teste abaixo falhava antes do fix. --- */

/* Achado 3a (trecho deslocado com várias caixas / espaços): o achado era
   calculado no texto bruto e o recorte no texto colapsado; com espaços
   duplos antes do alvo, o recorte antigo saía "…" vazio. */
test('regressão #3a: várias caixas com espaços duplos não deslocam o trecho', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-shift-'));
  try {
    const primeira = Array(50).fill('a').join('  ');
    const file = writeXopp(dir, xmlPaginas([[primeira, 'segunda caixa aqui', 'alvo final aqui']]), 'shift.xopp');
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'shift.xopp', path: file, materia: 'Cálculo'}]});
    const hits = await search.searchNotebooks('alvo');
    assert.equal(hits.length, 1);
    assert.match(hits[0].trecho, /alvo final aqui/, `o trecho contém o alvo (veio ${JSON.stringify(hits[0].trecho)})`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Achado 3b (emoji / pares substitutos): o mapa contava code points, o
   recorte contava code units; 50 emojis antes do alvo deslocavam tudo e
   o trecho vinha sem o alvo e com surrogate quebrado. */
test('regressão #3b: emoji antes do termo não desloca nem parte o par', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-emoji-'));
  try {
    const texto = '😀'.repeat(50) + ' alvo aqui';
    const file = writeXopp(dir, xmlPaginas([[texto]]), 'emoji.xopp');
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'emoji.xopp', path: file, materia: 'Cálculo'}]});
    const hits = await search.searchNotebooks('alvo');
    assert.equal(hits.length, 1);
    assert.match(hits[0].trecho, /alvo aqui/, `o trecho contém o alvo (veio ${JSON.stringify(hits[0].trecho)})`);
    const naoQuebrado = !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(hits[0].trecho) && !/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(hits[0].trecho);
    assert.ok(naoQuebrado, 'sem surrogate solto no trecho');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Achado 3c (bordas): o recorte cortava palavra no meio. */
test('regressão #3c: o trecho não corta palavra na borda', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-borda-'));
  try {
    const texto = 'palavraLongissimaOutraPalavraSegundaPalavraTerceiraPalavraQuartaPalavraQuinta alvo aqui';
    const file = writeXopp(dir, xmlPaginas([[texto]]), 'borda.xopp');
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'borda.xopp', path: file, materia: 'Cálculo'}]});
    const hits = await search.searchNotebooks('alvo');
    assert.equal(hits.length, 1);
    assert.match(hits[0].trecho, /alvo aqui/);
    assert.ok(!hits[0].trecho.startsWith('…lavra'), `não começa no meio da palavra (veio ${JSON.stringify(hits[0].trecho.slice(0, 20))})`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Achado 4: o tamanho entra pelo stat antes do readFile; acima de 32 MB
   comprimidos recusa sem ler. */
test('regressão #4: recusa pelo stat antes do readFile (teto comprimido)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-size-'));
  try {
    const file = writeXopp(dir, xmlPaginas([['alvo certo']]), 'size.xopp');
    let readCalls = 0;
    const readFile = async (...args) => {
      readCalls += 1;
      return fs.promises.readFile(...args);
    };
    const stat = async (target) => {
      const real = await fs.promises.stat(target);
      return {mtimeMs: real.mtimeMs, size: 40 * 1024 * 1024, ctimeMs: real.ctimeMs};
    };
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'size.xopp', path: file, materia: 'Cálculo'}], readFile, stat});
    const hits = await search.searchNotebooks('alvo');
    assert.deepEqual(hits, [], 'acima do teto não entra no índice');
    assert.equal(readCalls, 0, 'readFile não é chamado antes do stat dizer o tamanho');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Achado 6: mtime+size sozinhos não veem save no mesmo ms. */
test('regressão #6: cache inclui ctimeMs além de mtime+size', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-ctime-'));
  try {
    const file = writeXopp(dir, xmlPaginas([['primeira versão']]), 'ctime.xopp');
    let reads = 0;
    let fakeCtime = 1000;
    const readFile = async (...args) => {
      reads += 1;
      return fs.promises.readFile(...args);
    };
    const stat = async (target) => {
      const real = await fs.promises.stat(target);
      return {mtimeMs: real.mtimeMs, size: real.size, ctimeMs: fakeCtime};
    };
    const search = setupSearch({listNotebooks: () => [{courseId: 'calc', name: 'ctime.xopp', path: file, materia: 'Cálculo'}], readFile, stat});
    assert.equal((await search.searchNotebooks('versão')).length, 1);
    assert.equal(reads, 1);
    fakeCtime = 2000;
    assert.equal((await search.searchNotebooks('versão')).length, 1);
    assert.equal(reads, 2, 'ctime novo invalida o cache mesmo com mtime+size iguais');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Achado 2a: cada busca re-varria a biblioteca. */
test('regressão #2a: busca reutiliza a lista em cache', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-listcache-'));
  try {
    const file = writeXopp(dir, xmlPaginas([['alvo aqui']]), 'alvo.xopp');
    let listCalls = 0;
    const search = setupSearch({
      listNotebooks: () => {
        listCalls += 1;
        return [{courseId: 'calc', name: 'alvo.xopp', path: file, materia: 'Cálculo'}];
      },
    });
    await search.searchNotebooks('alvo');
    await search.searchNotebooks('alvo');
    await search.searchNotebooks('alvo');
    assert.equal(listCalls, 1, `a lista é lida 1 vez para 3 buscas (veio ${listCalls})`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Achado 2b: o laço não cedia e não abandonava busca velha. */
test('regressão #2b: o laço cede entre cadernos com setImmediate', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-yield-'));
  try {
    const items = [];
    for (let index = 0; index < 5; index += 1) {
      const file = writeXopp(dir, xmlPaginas([[`alvo arquivo ${index}`]]), `c${index}.xopp`);
      items.push({courseId: 'calc', name: `c${index}.xopp`, path: file, materia: 'Cálculo'});
    }
    let immediates = 0;
    const realSetImmediate = globalThis.setImmediate;
    globalThis.setImmediate = (callback, ...args) => {
      immediates += 1;
      return realSetImmediate(callback, ...args);
    };
    try {
      const search = setupSearch({listNotebooks: () => items});
      const hits = await search.searchNotebooks('alvo');
      assert.equal(hits.length, 5);
      assert.ok(immediates >= 4, `esperado >=4 setImmediate entre 5 arquivos (veio ${immediates})`);
    } finally {
      globalThis.setImmediate = realSetImmediate;
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Achado 2c: busca nova abandona a varredura da antiga (geração no host). */
test('regressão #2c: busca nova abandona a varredura da antiga', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-busca-gener-'));
  try {
    const items = [];
    for (let index = 0; index < 20; index += 1) {
      const file = writeXopp(dir, xmlPaginas([[`termo${index} pagina`]]), `g${index}.xopp`);
      items.push({courseId: 'calc', name: `g${index}.xopp`, path: file, materia: 'Cálculo'});
    }
    const readFile = async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return fs.promises.readFile(...args);
    };
    const search = setupSearch({listNotebooks: () => items, readFile});
    const antiga = search.searchNotebooks('termo19');
    await new Promise((resolve) => setTimeout(resolve, 45));
    const nova = search.searchNotebooks('termo0');
    const [hitsAntiga, hitsNova] = await Promise.all([antiga, nova]);
    assert.deepEqual(hitsAntiga, [], 'a busca antiga abandona antes de chegar ao último arquivo');
    assert.equal(hitsNova.length, 1, 'a nova termina');
    assert.equal(hitsNova[0].nomeExibido, 'g0.xopp');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* Regressões de UI da revisão #158: o comportamento (corrida de duas
   buscas, mapa reutilizado com "Buscando…" em role=status, destaque em
   <mark> sem virar HTML e foco no campo ao abrir) é medido na janela real
   (notebooks-search-ui.mjs, com IPC falso e atrasos controlados), porque
   ler o código-fonte como texto não prova comportamento nenhum. Aqui
   ficam só as garantias que não dependem de janela: locales e tokens. */

/* Achado 5c: locales e CSS com tokens que existem no style.css. */
test('regressão #5c: locales ≤80 e cada var(--x) das regras novas existe no style.css', () => {
  const pt = JSON.parse(fs.readFileSync(new URL('../src/locales/pt-BR.json', import.meta.url), 'utf8'));
  const en = JSON.parse(fs.readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'));
  const chaves = ['notebooks.searchLoading', 'notebooks.searchCount.one', 'notebooks.searchCount.other', 'notebooks.searchEmpty'];
  for (const key of chaves) {
    assert.equal(typeof pt[key], 'string', `${key} existe no pt-BR`);
    assert.equal(typeof en[key], 'string', `${key} existe no en`);
    assert.ok([...pt[key]].length <= 80, `${key} (pt) passa de 80: ${JSON.stringify(pt[key])}`);
    assert.ok([...en[key]].length <= 80, `${key} (en) passa de 80: ${JSON.stringify(en[key])}`);
  }
  const css = fs.readFileSync(new URL('../src/conversations-dividers.css', import.meta.url), 'utf8');
  const styleCss = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const rules = css.match(/\.notebooks-(search|excerpt)[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0, `há regras novas da busca no CSS (veio ${rules.length})`);
  assert.ok(rules.some((rule) => rule.includes('mark')), 'há regra do mark no trecho');
  assert.ok(rules.some((rule) => rule.includes('notebooks-search-status')), 'há regra do status');
  for (const rule of rules) {
    assert.doesNotMatch(rule, /#[0-9a-fA-F]{3,8}/, `sem cor fixa na regra (${rule.slice(0, 60)})`);
    for (const match of rule.matchAll(/var\((--[\w-]+)\)/g)) {
      const token = match[1];
      assert.match(styleCss, new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*:`), `${token} existe no style.css`);
    }
  }
});

/* Achado N10 da rodada 2: o indicador de "Buscando…" reusa os pontos da
   instalação do plugin e não anima com prefers-reduced-motion. */
test('regressão #158 N10: os pontos de "Buscando…" respeitam prefers-reduced-motion', () => {
  const css = fs.readFileSync(new URL('../src/conversations-dividers.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.notebooks-search-status \.ts-dots span\{animation:none\}\}/, 'há regra de movimento reduzido para os pontos do status da busca (N10)');
});
