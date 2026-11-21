// @ts-check
/* O pdf.js é o maior módulo do renderer (~860 KiB) e só é necessário quando um
   material abre. O import estático no `pdf.mjs` fazia o navegador avaliar tudo
   isso antes do primeiro desenho da janela, para uma tela que ainda não tinha
   página nenhuma. O carregador guarda UMA promessa: dois leitores abrindo
   juntos não avaliam o módulo duas vezes (#desempenho). */

const WORKER_URL = new URL('../../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

/**
 * URLs dos dados de pdf.js relativos à página que os carrega.
 * @param {string} base URL base do documento (document.baseURI)
 * @returns {{standardFontDataUrl: string, cMapUrl: string, wasmUrl: string}}
 * @example pdfjsDataUrls('http://localhost:5173/') // URLs sob /node_modules/pdfjs-dist/
 */
export function pdfjsDataUrls(base) {
  const dir = (name) => new URL(`node_modules/pdfjs-dist/${name}/`, base).href;
  return {standardFontDataUrl: dir('standard_fonts'), cMapUrl: dir('cmaps'), wasmUrl: dir('wasm')};
}

/**
 * Cria um carregador de pdf.js com import injetável (teste) e uma promessa só.
 * `loadPdfjs()` devolve o mesmo módulo nas chamadas seguintes; uma falha libera
 * a próxima tentativa.
 * @param {{load?: () => Promise<any>}} [options]
 * @returns {() => Promise<any>}
 * @example const loadPdfjs = createPdfjsLoader();
 * const pdfjs = await loadPdfjs();
 */
export function createPdfjsLoader({load = () => import('../../node_modules/pdfjs-dist/build/pdf.mjs')} = {}) {
  /** @type {Promise<any> | null} */
  let pending = null;
  return function loadPdfjs() {
    if (pending) return pending;
    pending = Promise.resolve()
      .then(load)
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
        return pdfjs;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
    return pending;
  };
}

/** O carregador da janela: um pdf.js por renderer, avaliado no primeiro PDF. */
export const loadPdfjs = createPdfjsLoader();
