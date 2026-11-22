// @ts-check
import {createLazyModule} from './lazy-module.mjs';
/**
 * Monta a fachada de boot da paleta: `window.mesaPalette` e o ⌘K existem desde
 * o começo, mas o módulo da paleta só carrega no primeiro uso. O listener do
 * módulo nasce no import; até lá, este handler cobre o primeiro ⌘K.
 * @param {{loader: {open: () => Promise<boolean>, close: () => boolean, current: () => any | null}, window: Window, document: Document, toast: (message: string) => void}} deps
 * @returns {{open: () => Promise<boolean>, close: () => boolean, unbind: () => void}}
 * @example const palette = mountPalette({loader, window, document, toast}); await palette.open();
 */
export function mountPalette({loader, window: win, document: doc, toast}) {
  const open = () => loader.open().catch((error) => {toast(error.message); return false;});
  const close = () => loader.close();
  win.mesaPalette = {open, close};
  const onKey = (event) => {
    if (event.defaultPrevented || event.isComposing || loader.current()) return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat) return;
    if (String(event.key || '').toLowerCase() !== 'k') return;
    if (doc.querySelector('dialog[open]')) return;
    event.preventDefault();
    open();
  };
  win.addEventListener('keydown', onKey);
  return {open, close, unbind: () => win.removeEventListener('keydown', onKey)};
}

/**
 * Mantém a paleta fora do boot até abrir; fechar antes disso não importa nada.
 * @param {{importModule?: () => Promise<typeof import('./command-palette.mjs')>, options: Record<string, any>}} options
 * @returns {{open: () => Promise<boolean>, close: () => boolean, current: () => any | null}}
 * @example const palette = createPaletteLoader({options}); await palette.open();
 */
export function createPaletteLoader({importModule = () => import('./command-palette.mjs'), options}) {
  const lazy = createLazyModule({
    importModule,
    prepare: (module) => module.initCommandPalette(options),
  });
  return {
    open: async () => (await lazy.load()).openCommandPalette(),
    close: () => lazy.current()?.closeCommandPalette() ?? false,
    current: () => lazy.current(),
  };
}
