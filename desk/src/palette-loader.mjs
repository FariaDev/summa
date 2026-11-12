import {createLazyModule} from './lazy-module.mjs';

/**
 * Mantém a paleta fora do boot até abrir; fechar antes disso não importa nada.
 * @param {{importModule?: () => Promise<typeof import('./command-palette.mjs')>, options: object}} options
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
