/* Janela e ipc de mentira para o render de PDF, e um pdf.js que classifica
   página visual sem abrir um PDF de verdade. Nenhum Electron. */

/** @param {{png?: string, ready?: boolean, renderDelayMs?: number, onScript?: (script: string) => void}} [options] */
export function fakePdfWindow({png = '', ready = true, renderDelayMs = 0, onScript = () => {}} = {}) {
  const scripts = [];
  const win = {
    scripts,
    closed: false,
    loadFile() {
      return Promise.resolve();
    },
    webContents: {
      executeJavaScript(script) {
        scripts.push(script);
        onScript(script);
        if (script.includes('mesaRenderPdfPage===')) return Promise.resolve(ready);
        if (renderDelayMs > 0 && script.startsWith('window.mesaRenderPdfPage(')) {
          return new Promise((resolve) => setTimeout(() => resolve(png), renderDelayMs));
        }
        return Promise.resolve(png);
      },
    },
    on() {},
    close() {
      win.closed = true;
    },
  };
  return win;
}

/**
 * ipcMain de mentira: guarda o único `handle` registrado (o canal de bytes do render).
 * @returns {{handle: (channel: string, fn: Function) => void, channel: string, handler: Function|null}}
 */
export function fakeIpc() {
  const ipc = {channel: '', handler: null, handle(channel, fn) { this.channel = channel; this.handler = fn; }};
  return ipc;
}

/**
 * Render de páginas lento, com nome: cada página demora `delayMs` e anota em
 * `started` a ordem em que começou (testes do orçamento do `read`, #60).
 * @param {{delayMs?: number, png?: string, started?: number[]}} [options]
 * @returns {(request: {page: number}) => Promise<string>}
 * @example const render = fakeSlowRender({delayMs: 200, started: []});
 */
export function fakeSlowRender({delayMs = 50, png = 'png-lento', started = []} = {}) {
  return async ({page}) => {
    started.push(page);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return png;
  };
}

/**
 * pdf.js mínimo: `pages` páginas iguais, com a lista de operadores que o teste pede.
 * @param {{text?: string, pages?: number, fnArray?: number[], argsArray?: any[], ops?: Record<string, number>, view?: number[], failDocument?: boolean}} spec
 */
export function fakePdfjs({text = '', pages = 1, fnArray = [], argsArray = [], ops = {}, view = [0, 0, 612, 792], failDocument = false} = {}) {
  return {
    OPS: ops,
    getDocument() {
      const loading = {
        promise: failDocument ? Promise.reject(Error('PDF torto')) : Promise.resolve({
          numPages: pages,
          getPage: async () => ({
            view,
            getViewport: ({scale = 1} = {}) => ({width: (view[2] - view[0]) * scale, height: (view[3] - view[1]) * scale}),
            getTextContent: async () => ({items: text ? [{str: text, hasEOL: false}] : []}),
            getOperatorList: async () => ({fnArray, argsArray}),
          }),
        }),
        destroy: async () => {},
      };
      return loading;
    },
  };
}
