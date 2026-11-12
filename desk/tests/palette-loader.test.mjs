import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaletteLoader} from '../src/palette-loader.mjs';

test('a fachada da paleta adia a importação e fechar sem carga é inofensivo', async () => {
  let imports = 0;
  let initialized = 0;
  let opened = 0;
  let closed = 0;
  const palette = createPaletteLoader({
    options: {actions: () => []},
    importModule: async () => {
      imports++;
      return {
        initCommandPalette: () => { initialized++; },
        openCommandPalette: () => { opened++; return true; },
        closeCommandPalette: () => { closed++; return true; },
      };
    },
  });
  assert.equal(palette.close(), false);
  assert.equal(imports, 0);
  assert.equal(await palette.open(), true);
  assert.equal(await palette.open(), true);
  assert.equal(palette.close(), true);
  assert.deepEqual({imports, initialized, opened, closed}, {imports: 1, initialized: 1, opened: 2, closed: 1});
});
