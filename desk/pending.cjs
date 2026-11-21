// @ts-check
'use strict';

/* Fila e bandeja que sobrevivem ao fechamento (Mesa): `runtime/pending.json`.
   Fronteira com o núcleo Bend (`core/pending.bend` → `src/generated/pending.core.js`
   e `core/attachments.bend` → `src/generated/attachments.core.js`).

   O host resolve os fatos (texto, contagem de imagens, bytes do arquivo) e o
   núcleo decide o que entra, o que é cortado e o que é recusado. Aqui ficam o
   arquivo, a leitura tolerante e o teto de disco:

   - o arquivo é chaveado pelo caminho da conversa (o mesmo `session` do main):
     trocar de conversa não mistura filas, e fechar o app não perde nenhuma;
   - a FILA entra primeiro (é o que ainda não foi aceito pelo Pi); a bandeja
     entra com o que sobrar — um anexo grande nunca encolhe a fila;
   - nada é apagado por leitura: arquivo torto vira o que dá para aproveitar e o
     próximo save regrava; a poda só tira a conversa cujo arquivo não existe
     mais (e que não é a corrente);
   - escrita atômica (`tmp` + rename) e sem repetir o que já está no disco.

   Puro o bastante para testar sozinho: recebe `runtime`/`session` e não fala
   com IPC, DOM nem relógio. */

const fs = require('node:fs');
const path = require('node:path');
const pendingCore = require('./src/generated/pending.core.js').default;
const attachCore = require('./src/generated/attachments.core.js').default;
const {normalizePdfFacts} = require('./src/chat-pdf.mjs');
const {notebookRecorte, notebookCardKey} = require('./src/notebook-facts.mjs');
const {toNat, wholeNat} = require('./src/bend-nat.mjs');
const {MAX_DRAFT} = require('./state-adapter.cjs');

const FILENAME = 'pending.json';
/* Tetos do núcleo: `maxStoredBytes` é o arquivo inteiro; `maxDraftChars` do
   attachments é o data URL guardado (16 MB); `MAX_DRAFT` (state) é o teto do
   texto, o mesmo que o `pi-prompt` recusa. */
const MAX_STORED_BYTES = Number(pendingCore.maxStoredBytes());
const MAX_DATA_URL = attachCore.maxDraftChars();
const MAX_REFS = Number(pendingCore.maxRefs());
const MAX_EXERCISE = 240;
const MAX_APP = 120;
const MAX_ID = 80;
const MAX_PATH = 4096;
const MAX_NOTEBOOKS = 4;
const MAX_NOTEBOOK_NAME = 200;
const MAX_NOTEBOOK_THUMB = 1200000;
const IMAGE_DATA_URL = /^data:([^;]*);base64,([A-Za-z0-9+/=]+)$/;
const NOTEBOOK_PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const NIL = {$: 'Nil'};

const fileOf = (runtime) => path.join(runtime, FILENAME);
const {isPlainObject} = require('./plain-object.cjs');
const coreList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));

/* ---------- normalização (os fatos vêm daqui, a decisão do núcleo) ---------- */

/* Proveniência da captura do Xournal++: horário e exercício do momento. É o que
   permite o main avisar que uma captura antiga não é do exercício de agora —
   valores estranhos simplesmente não entram. */
function provenance(raw) {
  const out = {};
  const capturedAt = Number(raw?.capturedAt);
  if (Number.isFinite(capturedAt) && capturedAt > 0) out.capturedAt = capturedAt;
  const exercise = typeof raw?.exercise === 'string' ? raw.exercise.trim().slice(0, MAX_EXERCISE) : '';
  if (exercise) out.exercise = exercise;
  /* Programa da captura (Conferir com outros programas): só o nome, aparado e cortado. */
  const app = typeof raw?.app === 'string' ? raw.app.trim().slice(0, MAX_APP) : '';
  if (app) out.app = app;
  return out;
}

/* Caderno da bandeja do tutor: nome e página para a tela, caminho para o
   `ler_caderno` e a miniatura (já reduzida pelo renderer). Sem o arquivo no
   disco o cartão é descartado em silêncio, como o restore pede. */
function notebookFact(raw) {
  if (!isPlainObject(raw)) return null;
  const caminho = typeof raw.caminho === 'string' ? raw.caminho.trim() : '';
  if (!caminho || caminho.length > MAX_PATH) return null;
  try { if (!fs.statSync(caminho).isFile()) return null; } catch { return null; }
  const page = Math.trunc(Number(raw.pagina));
  if (!Number.isFinite(page) || page < 1) return null;
  const name = (typeof raw.nome === 'string' ? raw.nome.replace(/\s+/g, ' ').trim() : '').slice(0, MAX_NOTEBOOK_NAME)
    || path.basename(caminho).replace(/\.xopp$/i, '');
  const thumb = typeof raw.thumb === 'string' && NOTEBOOK_PNG.test(raw.thumb) && raw.thumb.length <= MAX_NOTEBOOK_THUMB ? raw.thumb : '';
  /* O trecho (`recorte`) do Ambitus volta junto; o disco antigo, sem ele, carrega como página inteira. */
  const recorte = notebookRecorte(raw.recorte);
  return {caminho, pagina: Math.min(page, 100000), nome: name, ...(thumb ? {thumb} : {}), ...(recorte ? {recorte} : {})};
}

function normalizeNotebooks(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_NOTEBOOKS) break;
    const fact = notebookFact(item);
    /* Dois trechos da mesma página são dois cartões (`notebookCardKey`). */
    if (!fact || out.some((other) => notebookCardKey(other) === notebookCardKey(fact))) continue;
    out.push(fact);
  }
  return out;
}

function normalizeRefs(raw) {
  const out = [];
  for (const ref of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_REFS) break;
    if (!isPlainObject(ref) || typeof ref.path !== 'string' || !ref.path) continue;
    const page = Number(pendingCore.pageOf(wholeNat(ref.page)));
    out.push({path: ref.path.slice(0, MAX_PATH), page});
  }
  return out;
}

/* Imagem guardada: `{dataUrl, mimeType, name, capturedAt, exercise}` — a mesma
   forma da bandeja do composer. Um data URL solto (arquivo editado à mão, versão
   antiga) também é aceito: o mime sai do próprio data URL. O resto o núcleo
   recusa. */
function imageFact(raw) {
  const source = typeof raw === 'string' ? {dataUrl: raw} : raw;
  const dataUrl = typeof source?.dataUrl === 'string' ? source.dataUrl : '';
  const declared = typeof source?.mimeType === 'string' ? source.mimeType : (typeof source?.mime === 'string' ? source.mime : '');
  const match = IMAGE_DATA_URL.exec(dataUrl);
  return {$: 'ImageIn', dataUrl, mime: declared || (match ? match[1] : ''), name: String(source?.name ?? ''), valid: !!match, overRaw: dataUrl.length > MAX_DATA_URL};
}

/* Imagens guardadas: tetos, tipo e forma saem do `core/attachments.bend` (os
   mesmos da bandeja que existia na Conversa). Os que passam mantêm a proveniência. */
function normalizeImages(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = attachCore.normalizeAttachments(coreList(list.map(imageFact)), NIL);
  const kept = coreArray(attachCore.attachImages(out));
  /* O rascunho do núcleo é tudo-ou-nada: `Ok` só com a lista inteira aceita e
     cortada pelo `maxImages()` (do fim) — então `at` ainda aponta para a entrada
     crua correspondente e é dela que sai a proveniência. */
  return kept.map((image, at) => ({
    dataUrl: image.dataUrl,
    mimeType: (() => {
      const match = IMAGE_DATA_URL.exec(image.dataUrl);
      return match ? match[1] : String(list[at]?.mimeType ?? '');
    })(),
    name: image.name,
    ...provenance(list[at]),
  }));
}

/* Ferramentas pedidas com `@` (#53): só ids curtos, sem repetir e até o teto de
   chips; a conferência de quem existe é do `pi-prompt` ao enviar. */
function normalizeMentions(raw) {
  const out = [];
  for (const id of Array.isArray(raw) ? raw : []) {
    if (typeof id !== 'string' || !/^[a-z]{1,24}$/.test(id) || out.includes(id)) continue;
    if (out.length >= 3) break;
    out.push(id);
  }
  return out;
}

function normalizeItem(raw, index) {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, MAX_ID) : `fila-${index}`;
  const text = pendingCore.cutText(String(raw.text ?? ''), toNat(MAX_DRAFT));
  const refs = normalizeRefs(raw.refs);
  const images = normalizeImages(raw.images);
  /* PDF é referência (caminho/nome/páginas), não bytes: conta como anexo para a
     mensagem só de PDF não virar item vazio na fila. */
  const pdfs = normalizePdfFacts(raw.pdfs);
  const notebooks = normalizeNotebooks(raw.notebooks);
  if (!pendingCore.keepItem(text, toNat(images.length + pdfs.length + notebooks.length))) return null;
  const mentions = normalizeMentions(raw.mentions);
  return {
    id, text, refs, images, pdfs,
    ...(notebooks.length ? {notebooks} : {}),
    ...(mentions.length ? {mentions} : {}),
  };
}

function normalizeItems(raw) {
  const out = [];
  for (const [index, item] of (Array.isArray(raw) ? raw : []).entries()) {
    if (!pendingCore.keepAt(toNat(out.length))) break; // teto: os primeiros ficam
    const value = normalizeItem(item, index);
    if (value) out.push(value);
  }
  return out;
}

function normalizeEntry(value) {
  const source = isPlainObject(value) ? value : {};
  return {items: normalizeItems(source.items), attachments: normalizeImages(source.attachments), pdfs: normalizePdfFacts(source.pdfs), notebooks: normalizeNotebooks(source.notebooks), held: source.held === true};
}

/* ---------- arquivo ---------- */

/* Leitura tolerante: sem arquivo, JSON torto, chave estranha ou arquivo maior
   que o teto viram "nada guardado" — e o próximo save regrava o que sobrou. */
function readStore(runtime) {
  let text;
  try {
    const file = fileOf(runtime);
    if (fs.statSync(file).size > MAX_STORED_BYTES) return {};
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return {};
  }
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key || key === '__proto__' || !isPlainObject(value)) continue;
    const entry = normalizeEntry(value);
    if (entry.items.length || entry.attachments.length || entry.pdfs.length || entry.notebooks.length) out[key] = entry;
  }
  return out;
}

let lastPayload = null;
function writeStore(runtime, store) {
  const payload = JSON.stringify(store);
  if (payload === lastPayload) return;
  const file = fileOf(runtime);
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, payload);
  fs.renameSync(tmp, file);
  lastPayload = payload;
}

/* Poda: só a conversa corrente e as que ainda existem no disco. */
function pruneStore(store, session) {
  for (const key of Object.keys(store)) {
    if (key === session) continue;
    if (!fs.existsSync(key)) delete store[key];
  }
}

const fits = (entry) => !pendingCore.overStored(bytes(entry));

/* A fila entra primeiro e é o que fica: ela só é cortada do FIM quando sozinha
   não cabe (o começo é o que está mais perto de ser enviado). A bandeja que já
   estava guardada perde as últimas imagens até caber — nunca encolhe a fila. */
function fitQueue(items, attachments, pdfs, notebooks) {
  const kept = items.slice();
  let dropped = 0;
  while (kept.length && !fits({items: kept, attachments: [], pdfs: []})) {
    kept.pop();
    dropped++;
  }
  /* PDFs são referências pequenas: entram antes das imagens da bandeja. */
  const refs = (Array.isArray(pdfs) ? pdfs : []).slice();
  let pdfsDropped = false;
  while (refs.length && !fits({items: kept, attachments: [], pdfs: refs})) {
    refs.pop();
    pdfsDropped = true;
  }
  /* Cadernos são fatos pequenos (a miniatura já vem reduzida): entram antes
     das imagens, que são o que não cabe primeiro. */
  const books = (Array.isArray(notebooks) ? notebooks : []).slice();
  let notebooksDropped = false;
  while (books.length && !fits({items: kept, attachments: [], pdfs: refs, notebooks: books})) {
    books.pop();
    notebooksDropped = true;
  }
  const tray = attachments.slice();
  let trayDropped = false;
  while (tray.length && !fits({items: kept, attachments: tray, pdfs: refs, notebooks: books})) {
    tray.pop();
    trayDropped = true;
  }
  return {items: kept, attachments: tray, pdfs: refs, notebooks: books, dropped, trayDropped, pdfsDropped, notebooksDropped};
}

/* A bandeja não encolhe a fila: um anexo maior perde as últimas imagens até
   caber (e o que não caiu continua na sessão). */
function fitTray(items, images, pdfs, notebooks) {
  const tray = images.slice();
  const refs = (Array.isArray(pdfs) ? pdfs : []).slice();
  const books = (Array.isArray(notebooks) ? notebooks : []).slice();
  let trayDropped = false, notebooksDropped = false;
  while (books.length && !fits({items, attachments: [], pdfs: refs, notebooks: books})) {
    books.pop();
    notebooksDropped = true;
  }
  while (tray.length && !fits({items, attachments: tray, pdfs: refs, notebooks: books})) {
    tray.pop();
    trayDropped = true;
  }
  return {items, attachments: tray, pdfs: refs, notebooks: books, dropped: 0, trayDropped, pdfsDropped: false, notebooksDropped};
}

/* Sessões gravadas por esta execução: o que veio de outra execução é
   "recuperado" e nunca sai sozinho (a decisão é do núcleo, `heldOnLoad`). */
const touched = new Set();

/* Grava a entrada da conversa. `held` só muda quando vem de quem sabe (a fila);
   um save de bandeja preserva a guarda que já estava no arquivo. */
function commit(runtime, session, fitted, held) {
  const store = readStore(runtime);
  const previous = store[session];
  const entry = {items: fitted.items, attachments: fitted.attachments, pdfs: fitted.pdfs, notebooks: fitted.notebooks || [], held: typeof held === 'boolean' ? held : !!previous?.held};
  if (entry.items.length || entry.attachments.length || entry.pdfs.length || entry.notebooks.length) store[session] = entry;
  else delete store[session];
  pruneStore(store, session);
  writeStore(runtime, store);
  touched.add(session);
  return {items: entry.items, attachments: entry.attachments, pdfs: entry.pdfs, notebooks: entry.notebooks, held: entry.held, dropped: fitted.dropped, trayDropped: fitted.trayDropped, pdfsDropped: fitted.pdfsDropped, notebooksDropped: fitted.notebooksDropped === true};
}

/* O que está guardado para uma conversa (o renderer hidrata no boot e a cada
   troca de conversa). Nunca escreve. `live` diz se a gravação é desta execução. */
function readPending(runtime, session) {
  const entry = readStore(runtime)[session];
  const notebooks = entry?.notebooks || [];
  return {
    items: entry ? entry.items : [],
    attachments: entry ? entry.attachments : [],
    pdfs: entry ? entry.pdfs : [],
    ...(notebooks.length ? {notebooks} : {}),
    held: !!entry?.held,
    live: touched.has(session),
  };
}

/* Save da fila (a cada mudança: enfileirar, remover, editar, enviar). */
function saveQueue(runtime, session, items, held) {
  const current = readPending(runtime, session);
  return commit(runtime, session, fitQueue(normalizeItems(items), current.attachments, current.pdfs, current.notebooks || []), held);
}

/* Save da bandeja do composer (anexar, remover, limpar). */
function saveTray(runtime, session, images, pdfs, notebooks) {
  const current = readPending(runtime, session);
  return commit(runtime, session, fitTray(current.items, normalizeImages(images), normalizePdfFacts(pdfs), normalizeNotebooks(notebooks)));
}

module.exports = {readPending, saveQueue, saveTray, FILENAME, MAX_STORED_BYTES, MAX_NOTEBOOKS};
