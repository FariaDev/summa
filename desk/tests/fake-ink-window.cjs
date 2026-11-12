/* Janela falsa da tinta (#159): janela escondida sem Electron, com a sessão
   que guarda o handler de `onBeforeRequest` e a janela que pode travar no
   carregamento. Nome no arquivo inteiro: é o stand-in da janela real de
   `ink-convert-host.cjs`, não um stub inline. */
function createFakeInkSession() {
  const session = {
    beforeRequest: null,
    permissionHandler: null,
    setPermissionRequestHandler: (fn) => { session.permissionHandler = fn; },
    setPermissionCheckHandler: (fn) => { session.permissionCheckHandler = fn; },
    webRequest: {
      onBeforeRequest: (fn) => { session.beforeRequest = fn; },
    },
  };
  return session;
}

/* Imagem física como o `capturePage` devolve: o DPR multiplica o rect; o PNG
   carrega o tamanho para o teste conferir a normalização do host. */
function fakeInkImage(width, height) {
  return {
    isEmpty: () => width <= 0 || height <= 0,
    getSize: () => ({width, height}),
    resize: ({width: nextWidth, height: nextHeight}) => fakeInkImage(nextWidth, nextHeight),
    toPNG: () => Buffer.from(`fake-ink-${width}x${height}`),
  };
}

function createFakeInkWindow({hangLoad = false, scaleFactor = 1} = {}) {
  const session = createFakeInkSession();
  const state = {destroyed: false, loadedUrls: [], captures: []};
  const win = {
    webContents: {
      session,
      setWindowOpenHandler: () => {},
      on: () => {},
      capturePage: async (rect) => {
        const image = fakeInkImage(Math.round((rect?.width || 0) * scaleFactor), Math.round((rect?.height || 0) * scaleFactor));
        state.captures.push(image);
        return image;
      },
    },
    loadURL: async (url) => {
      state.loadedUrls.push(url);
      if (hangLoad) return new Promise(() => {});
      return undefined;
    },
    isDestroyed: () => state.destroyed,
    destroy: () => { state.destroyed = true; },
  };
  return {win, session, state};
}

function createFakeInkWindowFactory(options) {
  const created = [];
  const createWindow = () => {
    const fake = createFakeInkWindow(options);
    created.push(fake);
    return fake.win;
  };
  return {createWindow, created};
}

module.exports = {createFakeInkWindow, createFakeInkSession, createFakeInkWindowFactory};
