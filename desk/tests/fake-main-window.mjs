/* Janela principal e telas de mentira para o modo mini (`mini-mode-host.cjs`):
   o que a `FakeBrowserWindow` não tem — tamanho mínimo, maximizada, tela cheia,
   barra de menu — e telas que emitem `display-removed`. O `setBounds` respeita
   o mínimo como o Electron faz (largura abaixo dele vira o mínimo), então um host
   que encolhe a janela antes de baixar o mínimo falha aqui. Sem Electron. */
import {EventEmitter} from 'node:events';
import {FakeBrowserWindow, FakeScreen} from './fake-webcontents.mjs';

/**
 * @example const win = new FakeMainWindow({bounds: {x: 50, y: 40, width: 1200, height: 800}}); win.setMinimumSize(300, 360);
 */
export class FakeMainWindow extends FakeBrowserWindow {
  /** @param {ConstructorParameters<typeof FakeBrowserWindow>[0] & {maximized?: boolean, fullScreen?: boolean}} [options] */
  constructor(options = {}) {
    super(options);
    this._min = [900, 650];
    this._maximized = options.maximized === true;
    this._fullScreen = options.fullScreen === true;
    this._menuBar = true;
    this._normal = null;
  }
  getMinimumSize() { return [...this._min]; }
  setMinimumSize(width, height) { this._min = [width, height]; }
  setBounds(bounds) {
    super.setBounds({...bounds, width: Math.max(bounds.width, this._min[0]), height: Math.max(bounds.height, this._min[1])});
  }
  getNormalBounds() { return {...(this._normal || this._bounds)}; }
  isMaximized() { return this._maximized; }
  maximize() { this._normal = this.getBounds(); this._maximized = true; }
  unmaximize() {
    this._maximized = false;
    queueMicrotask(() => this.emit('unmaximize'));
  }
  isFullScreen() { return this._fullScreen; }
  setFullScreen(on) {
    this._fullScreen = on === true;
    if (!this._fullScreen) queueMicrotask(() => this.emit('leave-full-screen'));
  }
  isMenuBarVisible() { return this._menuBar; }
  setMenuBarVisibility(visible) { this._menuBar = visible === true; }
}

/** Telas que o teste troca e que emitem `display-removed` / `display-metrics-changed`. */
export class FakeScreenWithEvents extends FakeScreen {
  constructor(displays, primaryId) {
    super(displays, primaryId);
    this.events = new EventEmitter();
  }
  on(event, handler) { this.events.on(event, handler); }
  /** Troca as telas e avisa, como o desconectar de um monitor. */
  replaceDisplays(displays, event = 'display-removed') {
    this._displays = displays;
    this.events.emit(event);
  }
}
