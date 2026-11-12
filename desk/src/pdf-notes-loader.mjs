// @ts-check
/* Anotações de página (55 KiB, núcleo incluso) fora da partida (#desempenho).
   Ctrl/Cmd+Shift+N, o botão da barra e o `mesa-study-annotate` da busca são
   capturados cedo; o init do módulo roda no primeiro uso. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * Cria a fachada das anotações.
 * @param {() => Promise<typeof import('./pdf-notes.mjs')>} [importModule]
 * @returns {{init: (options?: object) => void, load: () => Promise<any>, open: (preset?: object) => Promise<any>, close: () => void, current: () => any | null}}
 * @example const notes = createPdfNotesLoader(); notes.init(); await notes.open({page: 2});
 */
export function createPdfNotesLoader(importModule = () => import('./pdf-notes.mjs')) {
  let options = {};
  const lazy = createLazyModule({importModule, prepare: (module) => module.initPdfNotes(options)});
  return {
    init: (next = {}) => { options = {...options, ...next}; },
    load: () => lazy.load(),
    open: async (preset = {}) => {
      const module = await lazy.load();
      return module.openPdfNotes(preset);
    },
    close: () => lazy.current()?.closePdfNotes(),
    current: () => lazy.current(),
  };
}

/* A seleção do leitor feita antes do primeiro uso não se perde: o módulo só
   liga o `selectionchange` quando carrega, então este ouvinte mínimo guarda a
   última seleção não vazia desde a partida e a entrega ao `initPdfNotes`
   (#desempenho). */
/**
 * A seleção atual num `.textLayer`, no formato que `initPdfNotes` guarda.
 * @param {Document} doc
 * @returns {{quote: string, page: number, path: string, name: string}|null}
 * @example readerSelectionSnapshot(document); // {quote:'trecho', page:2, path:'/cursos/a.pdf', name:'a.pdf'}
 */
export function readerSelectionSnapshot(doc) {
  try {
    const selection = doc?.defaultView?.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node?.nodeType === 1 ? /** @type {Element} */ (node) : node?.parentElement;
    const layer = el?.closest?.('.textLayer');
    const panel = layer?.closest?.('.pdf-panel');
    if (!panel) return null;
    const pageEl = /** @type {HTMLElement|null} */ (layer.closest?.('.pdf-page'));
    const select = /** @type {HTMLSelectElement|null} */ (panel.querySelector?.('.pdf-select'));
    const page = Number(pageEl?.dataset?.page) || 0;
    const path = select?.value || '';
    const name = path.split(/[/\\]/).at(-1) || '';
    const quote = String(range.toString() || selection.toString() || '').replace(/\s+/g, ' ').trim();
    if (!quote) return null;
    return {quote, page, path, name};
  } catch {
    return null;
  }
}

function trackReaderSelection(doc) {
  let last = readerSelectionSnapshot(doc);
  doc.addEventListener?.('selectionchange', () => {
    const info = readerSelectionSnapshot(doc);
    if (info) last = info;
  });
  return {get: () => last};
}

const pdfNotes = createPdfNotesLoader();
/**
 * Guarda as opções e liga os gatilhos da partida (atalho, barra e anotação).
 * O carregador pode entrar por parâmetro para o teste não importar o módulo.
 * @param {any} [options] opções do `initPdfNotes`
 * @param {ReturnType<typeof createPdfNotesLoader>} [loader]
 * @returns {{open: (preset?: object) => Promise<any>, close: () => void}}
 * @example mountPdfNotesBoot();
 */
export function mountPdfNotesBoot(options = {}, loader = pdfNotes) {
  const doc = options.document || globalThis.document;
  const {notify = () => {}, ...rest} = options;
  const tracker = trackReaderSelection(doc);
  loader.init({...rest, selection: tracker.get});
  const open = (preset = {}) => loader.open(preset).catch((error) => { notify(error?.message || String(error)); });
  const onKey = (event) => {
    if (loader.current() || event.defaultPrevented) return;
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || String(event.key || '').toLowerCase() !== 'n') return;
    event.preventDefault();
    open({});
  };
  const onClick = (event) => {
    if (loader.current()) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const button = path.find((node) => node?.id === 'study-notes-open' || node?.dataset?.studyAction === 'study-notes');
    if (!button) return;
    event.preventDefault();
    open({});
  };
  const onAnnotate = (event) => {
    if (loader.current() || !event?.detail?.hit) return;
    loader.load().then(() => {
      doc.dispatchEvent(new CustomEvent('mesa-study-annotate', {detail: event.detail}));
    }).catch((error) => notify(error?.message || String(error)));
  };
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('click', onClick);
  doc.addEventListener('mesa-study-annotate', onAnnotate);
  return {open, close: () => loader.close()};
}

/** Abre as anotações, importando o módulo na primeira vez.
 * @param {object} [preset] @returns {Promise<any>} @example await openPdfNotes({page: 3});
 */
export const openPdfNotes = (preset = {}) => pdfNotes.open(preset);
