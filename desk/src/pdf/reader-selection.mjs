// @ts-check
/* A seleção de texto de um leitor de PDF, lida de um lugar só: o ouvinte da
   partida (`pdf-notes-loader.mjs`) e as Notas do material (`pdf-notes.mjs`)
   decodificavam o mesmo range cada um na sua cópia (handoff da 1.4.0, seção 6). */

/**
 * A seleção atual num `.textLayer` de um `.pdf-panel`: o trecho com espaços
 * normalizados, a página e o PDF do leitor. Fora de um leitor, vazia ou se o
 * DOM recusar a leitura, devolve `null`.
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
    if (!layer || !panel) return null;
    const pageEl = /** @type {HTMLElement|null} */ (layer.closest?.('.pdf-page'));
    const select = /** @type {HTMLSelectElement|null} */ (panel.querySelector?.('.pdf-select'));
    const page = Number(pageEl?.dataset?.page) || 0;
    const path = select?.value || '';
    const name = path.split(/[/\\]/).at(-1) || '';
    /* `Selection.toString()` devolve vazio quando o foco está num campo do
     * diálogo; a seleção real está no range. */
    const quote = String(range.toString() || selection.toString() || '').replace(/\s+/g, ' ').trim();
    if (!quote) return null;
    return {quote, page, path, name};
  } catch {
    return null;
  }
}
