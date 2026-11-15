// @ts-check
import {MAX_NOTEBOOKS} from './notebook-facts.mjs';

/* O PNG da página anexada que vai ao modelo como imagem, pelo mesmo caminho
   das outras imagens (o `promptImages` do tutor e o `images` do lateral). A
   bandeja guarda a imagem em resolução cheia enquanto a sessão vive; depois de
   recarregar só resta a miniatura reduzida a 240 px, então a página é
   renderizada de novo pelo `readNotebook` do main (o mesmo do `ler_caderno`)
   antes de enviar. Se essa renderização falhar, a reduzida é o que sobra. */

/**
 * Renderiza a página pelo main (`readNotebook`, via IPC) e devolve o PNG em
 * data URL; vazio quando a página não pode ser lida agora.
 * @param {{caminho: string, pagina: number}} item
 * @returns {Promise<string>}
 * @example await readNotebookPagePng({caminho: '/c/a.xopp', pagina: 2}) // 'data:image/png;base64,iVBOR'
 */
export async function readNotebookPagePng(item) {
  const desk = globalThis.window?.desk;
  if (!desk?.readNotebookPage || typeof item?.caminho !== 'string' || !item.caminho) return '';
  const result = await desk.readNotebookPage({caminho: item.caminho, pagina: item.pagina});
  const image = typeof result?.image === 'string' ? result.image : '';
  return image ? `data:image/png;base64,${image}` : '';
}

/**
 * As imagens das páginas anexadas, na ordem dos cadernos, para irem ao motor
 * como qualquer outra imagem. Usa a imagem cheia da bandeja (`find`); se só
 * houver a miniatura reduzida (`full: false`, o que vem do disco após
 * recarregar), re-renderiza com `readPage` e cai na reduzida se falhar.
 * @param {Array<{caminho: string, pagina: number, nome: string}>} notebooks
 * @param {{find?: (item: {caminho: string, pagina: number}) => {thumb?: string, full?: boolean} | null,
 *   readPage?: ((item: {caminho: string, pagina: number}) => Promise<string>) | null}} [deps]
 * @returns {Promise<Array<{dataUrl: string}>>}
 * @example await notebookPageImages([{caminho: '/c/a.xopp', pagina: 2, nome: 'A'}], {find, readPage})
 */
export async function notebookPageImages(notebooks, {find = () => null, readPage = readNotebookPagePng} = {}) {
  const out = [];
  for (const item of (Array.isArray(notebooks) ? notebooks : []).slice(0, MAX_NOTEBOOKS)) {
    const card = find(item) || null;
    if (card?.thumb && card.full === true) {
      out.push({dataUrl: card.thumb});
      continue;
    }
    let dataUrl = '';
    if (typeof readPage === 'function') {
      try { dataUrl = await readPage(item) || ''; } catch { dataUrl = ''; }
    }
    if (!dataUrl && card?.thumb) dataUrl = card.thumb;
    if (dataUrl) out.push({dataUrl});
  }
  return out;
}
