// @ts-check
/* Fake nomeado de `webContents` e `BrowserWindow` para o guarda da janela
   lateral solto (#157). Sem Electron: só anota handlers e emite eventos como
   o Chromium faria, para o teste dirigir cada transição na mão. JSDoc marca
   cada método; os exemplos mostram o uso no teste do host. */
import {EventEmitter} from 'node:events';

/**
 * `webContents` falso: guarda o handler de `window.open` e emite os eventos
 * que o host escuta (`did-create-window`, navegação e redirecionamento).
 * @example const wc = new FakeWebContents(); wc.setWindowOpenHandler(d => ({action:'deny'})); wc.emit('will-navigate', evt, 'https://x');
 */
export class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    /** @type {((details: any) => any) | null} */
    this.windowOpenHandler = null;
  }
  /**
   * Registra o handler de `window.open`, como o Electron faz.
   * @param {(details: any) => any} fn
   * @returns {void}
   * @example wc.setWindowOpenHandler(() => ({action: 'deny'}));
   */
  setWindowOpenHandler(fn) {
    this.windowOpenHandler = fn;
  }
  /**
   * Chama o handler registrado com os detalhes dados (ou nega, como o Electron
   * faria sem handler, para o teste não passar por engano).
   * @param {any} details
   * @returns {any}
   * @example wc.handleWindowOpen({url: 'about:blank', frameName: 'mesa-sidechat'})
   */
  handleWindowOpen(details) {
    if (typeof this.windowOpenHandler === 'function') return this.windowOpenHandler(details);
    return {action: 'deny'};
  }
}

/**
 * `BrowserWindow` falso: `webContents` falso, fundo configurável (o tema que
 * a janela principal usa) e `close()` que marca como destruída e emite `closed`.
 * A fatia 2 (#157) guarda limites e o "por cima" para o host persistir: `getBounds`
 * lê, `setBounds` grava e emite `move`/`resize` como o arrasto faria.
 * @example const win = new FakeBrowserWindow({backgroundColor: '#191919'}); win.getBackgroundColor() // '#191919'
 */
export class FakeBrowserWindow extends EventEmitter {
  /**
   * @param {{backgroundColor?: string, bounds?: {x: number, y: number, width: number, height: number}, alwaysOnTop?: boolean}} [options]
   */
  constructor(options = {}) {
    super();
    this.webContents = new FakeWebContents();
    this._backgroundColor = options.backgroundColor || '#f7f7f7';
    this._bounds = options.bounds ? {...options.bounds} : {x: 0, y: 0, width: 400, height: 800};
    this._alwaysOnTop = options.alwaysOnTop === true;
    this.destroyed = false;
    this.closeCalls = 0;
  }
  /**
   * Limites atuais, como `BrowserWindow.getBounds()` do Electron.
   * @returns {{x: number, y: number, width: number, height: number}}
   * @example win.getBounds() // {x: 0, y: 0, width: 400, height: 800}
   */
  getBounds() {
    return {...this._bounds};
  }
  /**
   * Grava os limites e emite `move`/`resize`, como o arrasto do Electron.
   * @param {{x: number, y: number, width: number, height: number}} bounds
   * @returns {void}
   * @example win.setBounds({x: 50, y: 60, width: 420, height: 900});
   */
  setBounds(bounds) {
    const next = {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height};
    const moved = next.x !== this._bounds.x || next.y !== this._bounds.y;
    const resized = next.width !== this._bounds.width || next.height !== this._bounds.height;
    this._bounds = next;
    if (moved) this.emit('move');
    if (resized) this.emit('resize');
  }
  /**
   * Liga ou desliga o "por cima", como `BrowserWindow.setAlwaysOnTop()`.
   * @param {boolean} on
   * @returns {void}
   * @example win.setAlwaysOnTop(true); win.isAlwaysOnTop() // true
   */
  setAlwaysOnTop(on) {
    this._alwaysOnTop = on === true;
  }
  /**
   * Verdade quando a janela está por cima.
   * @returns {boolean}
   * @example win.isAlwaysOnTop() // false
   */
  isAlwaysOnTop() {
    return this._alwaysOnTop;
  }
  /**
   * Fundo atual, como `BrowserWindow.getBackgroundColor()` do Electron.
   * @returns {string}
   * @example win.getBackgroundColor() // '#f7f7f7'
   */
  getBackgroundColor() {
    return this._backgroundColor;
  }
  /**
   * Troca o fundo, como `BrowserWindow.setBackgroundColor()` faria ao salvar.
   * @param {string} color
   * @returns {void}
   * @example win.setBackgroundColor('#191919');
   */
  setBackgroundColor(color) {
    this._backgroundColor = color;
  }
  /**
   * Verdade quando a janela foi destruída (após `close()`).
   * @returns {boolean}
   * @example win.isDestroyed() // false
   */
  isDestroyed() {
    return this.destroyed;
  }
  /**
   * Fecha (marca destruída e emite `closed` e `close` com uma chamada só).
   * @returns {void}
   * @example win.close(); win.isDestroyed() // true
   */
  close() {
    this.closeCalls += 1;
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit('close');
    this.emit('closed');
  }
}

/**
 * `screen` falso: as telas que o teste fixa, com primária nomeada. `getDisplayMatching`
 * devolve a tela onde a Mesa está (limites que sobrepõem), como o Electron faria.
 * @example const screen = new FakeScreen([{id: 1, bounds: {x: 0, y: 0, width: 1920, height: 1040}, workArea: {x: 0, y: 0, width: 1920, height: 1000}}], 1);
 */
export class FakeScreen {
  /**
   * @param {Array<{id: number, bounds: any, workArea: any, internal?: boolean}>} displays
   * @param {number} primaryId
   */
  constructor(displays, primaryId) {
    this._displays = displays;
    this._primaryId = primaryId;
  }
  /**
   * Todas as telas fixadas no teste.
   * @returns {any[]}
   * @example screen.getAllDisplays() // [{id: 1, ...}]
   */
  getAllDisplays() {
    return this._displays;
  }
  /**
   * A tela principal fixada no teste.
   * @returns {any}
   * @example screen.getPrimaryDisplay().id // 1
   */
  getPrimaryDisplay() {
    return this._displays.find((d) => d.id === this._primaryId) || this._displays[0];
  }
  /**
   * A tela onde os limites dados estão (sobreposição); sem ela, a principal.
   * @param {{x: number, y: number, width: number, height: number}} rect
   * @returns {any}
   * @example screen.getDisplayMatching({x: 2000, y: 50, width: 1200, height: 800}).id // 2
   */
  getDisplayMatching(rect) {
    const overlaps = (a, b) => a && b && a.x < b.x + b.width && a.x + (a.width || 0) > b.x && a.y < b.y + b.height && a.y + (a.height || 0) > b.y;
    return this._displays.find((d) => overlaps(rect, d.workArea) || overlaps(rect, d.bounds)) || this.getPrimaryDisplay();
  }
}

/**
 * Totais do fake para asserções: janelas criadas e fechadas, sem expor eventos.
 * @param {FakeBrowserWindow[]} wins
 * @returns {{created: number, closed: number}}
 * @example fakeWindowCounts([win, child]) // {created: 2, closed: 1}
 */
export function fakeWindowCounts(wins) {
  return {created: wins.length, closed: wins.filter((w) => w.isDestroyed()).length};
}
