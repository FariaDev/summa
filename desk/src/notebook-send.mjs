// @ts-check
import {MAX_NOTEBOOKS, notebookRecorte} from './notebook-facts.mjs';

/* O PNG da página anexada que vai ao modelo como imagem, pelo mesmo caminho
   das outras imagens (o `promptImages` do tutor e o `images` do lateral). A
   bandeja guarda a imagem em resolução cheia enquanto a sessão vive; depois de
   recarregar só resta a miniatura reduzida a 240 px, então a página é
   renderizada de novo pelo `readNotebook` do main (o mesmo do `ler_caderno`)
   antes de enviar. Se essa renderização falhar, a reduzida é o que sobra.
   Um cartão com `recorte` (o Ambitus mandou só o trecho) leva só o trecho: a
   página renderizada é cortada por ele. Se o corte falhar, a reduzida é o que
   sobra, e ela já é o trecho; a página inteira nunca vai no lugar dele. */

/* O mesmo DPI do `ler_caderno` (`NOTEBOOK_DPI` em src/extensions/mesa-mcp/notebook-tool.mjs):
   o recorte vem em pontos e a página renderizada tem pixels = pontos × 120/72. */
const RENDER_DPI = 120;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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
 * O tamanho do PNG pelo cabeçalho IHDR, sem decodificar; null quando não é um
 * PNG em data URL.
 * @param {unknown} dataUrl
 * @returns {{width: number, height: number}|null}
 * @example pngPixelSize('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC') // {width: 1, height: 1}
 */
export function pngPixelSize(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]{32})/.exec(String(dataUrl ?? ''));
  if (!match) return null;
  const bytes = Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0));
  const signatureOk = PNG_SIGNATURE.every((byte, at) => bytes[at] === byte);
  if (!signatureOk || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer);
  return {width: view.getUint32(16), height: view.getUint32(20)};
}

/**
 * O retângulo do trecho em pixels da página renderizada (pontos × 120/72),
 * preso à imagem; null quando não sobra nada dentro dela.
 * @param {{x: number, y: number, largura: number, altura: number}} recorte
 * @param {{width: number, height: number}} size
 * @returns {{sx: number, sy: number, sw: number, sh: number}|null}
 * @example recorteRect({x: 0, y: 286, largura: 595, altura: 555}, {width: 992, height: 1403}) // {sx: 0, sy: 477, sw: 992, sh: 925}
 */
export function recorteRect(recorte, {width, height}) {
  const scale = RENDER_DPI / 72;
  const sx = Math.min(Math.max(Math.round(recorte.x * scale), 0), width);
  const sy = Math.min(Math.max(Math.round(recorte.y * scale), 0), height);
  const sw = Math.min(Math.round(recorte.largura * scale), width - sx);
  const sh = Math.min(Math.round(recorte.altura * scale), height - sy);
  return sw > 0 && sh > 0 ? {sx, sy, sw, sh} : null;
}

/**
 * Corta a página renderizada pelo trecho, num canvas do próprio navegador (sem
 * dependência nova). Devolve o trecho em data URL, ou '' quando não dá para cortar.
 * @param {string} dataUrl a página inteira, PNG em data URL
 * @param {{x: number, y: number, largura: number, altura: number}} recorte
 * @returns {Promise<string>}
 * @example await cropPagePng(pageDataUrl, {x: 0, y: 286, largura: 595, altura: 555})
 */
export async function cropPagePng(dataUrl, recorte) {
  const size = pngPixelSize(dataUrl);
  const rect = size && recorteRect(recorte, size);
  if (!rect) return '';
  const image = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = reject;
    node.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = rect.sw;
  canvas.height = rect.sh;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh);
  return canvas.toDataURL('image/png');
}

/** O corte que falha não derruba o envio: vira '' e a reduzida entra no lugar. */
async function cropSafely(dataUrl, recorte, crop) {
  try { return (await crop(dataUrl, recorte)) || ''; } catch { return ''; }
}

/**
 * A imagem de uma página que veio do disco (sem a cheia da bandeja): a página
 * renderizada de novo; se o cartão é um trecho, cortada por ele, e se nada disso
 * der, a miniatura reduzida (que já é o trecho, quando há recorte).
 * @param {{caminho: string, pagina: number, recorte?: Record<string, any>}} item
 * @param {{thumb?: string} | null} card
 * @param {{readPage: ((item: {caminho: string, pagina: number}) => Promise<string>) | null, crop: typeof cropPagePng}} deps
 * @returns {Promise<string>}
 */
async function reloadedPageImage(item, card, {readPage, crop}) {
  let dataUrl = '';
  if (typeof readPage === 'function') {
    try { dataUrl = (await readPage(item)) || ''; } catch { dataUrl = ''; }
  }
  const recorte = notebookRecorte(item.recorte);
  if (!recorte) return dataUrl || card?.thumb || '';
  const excerpt = dataUrl ? await cropSafely(dataUrl, recorte, crop) : '';
  return excerpt || card?.thumb || '';
}

/**
 * As imagens das páginas anexadas, na ordem dos cadernos, para irem ao motor
 * como qualquer outra imagem. Usa a imagem cheia da bandeja (`find`); se só
 * houver a miniatura reduzida (`full: false`, o que vem do disco após
 * recarregar), re-renderiza com `readPage` e cai na reduzida se falhar. Com
 * `recorte` no cartão, a renderização é cortada por ele (`crop`).
 * @param {Array<{caminho: string, pagina: number, nome: string, recorte?: Record<string, any>}>} notebooks
 * @param {{find?: (item: {caminho: string, pagina: number}) => {thumb?: string, full?: boolean} | null,
 *   readPage?: ((item: {caminho: string, pagina: number}) => Promise<string>) | null,
 *   crop?: (dataUrl: string, recorte: {x: number, y: number, largura: number, altura: number}) => Promise<string>}} [deps]
 * @returns {Promise<Array<{dataUrl: string}>>}
 * @example await notebookPageImages([{caminho: '/c/a.xopp', pagina: 2, nome: 'A'}], {find, readPage})
 */
export async function notebookPageImages(notebooks, {find = () => null, readPage = readNotebookPagePng, crop = cropPagePng} = {}) {
  const out = [];
  for (const item of (Array.isArray(notebooks) ? notebooks : []).slice(0, MAX_NOTEBOOKS)) {
    const card = find(item) || null;
    if (card?.thumb && card.full === true) {
      out.push({dataUrl: card.thumb});
      continue;
    }
    const dataUrl = await reloadedPageImage(item, card, {readPage, crop});
    if (dataUrl) out.push({dataUrl});
  }
  return out;
}
