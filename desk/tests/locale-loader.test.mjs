import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocaleLoader} from '../src/locale-loader.mjs';

test('cada catálogo é importado uma vez, só quando pedido, e a promessa é dividida', async () => {
  let imports = 0;
  const loader = createLocaleLoader({
    imports: {
      'pt-BR': async () => ({default: {title: 'Configurações'}}),
      en: async () => {
        imports++;
        return {default: {title: 'Settings'}};
      },
    },
  });
  assert.equal(loader.current('en'), null);
  assert.equal(imports, 0);
  const [first, second] = await Promise.all([loader.load('en'), loader.load('en')]);
  assert.deepEqual(first, {title: 'Settings'});
  assert.equal(first, second);
  assert.equal(await loader.load('en'), first);
  assert.equal(imports, 1);
  assert.equal(loader.current('en'), first);
  assert.deepEqual(loader.languages.sort(), ['en', 'pt-BR']);
});

test('catálogo despido (sem default) também vale', async () => {
  const loader = createLocaleLoader({imports: {en: async () => ({title: 'Settings'})}});
  assert.deepEqual(await loader.load('en'), {title: 'Settings'});
});

test('idioma desconhecido recusa com o valor recebido e o formato esperado', async () => {
  const loader = createLocaleLoader({imports: {}});
  await assert.rejects(() => loader.load('fr'), /idioma "fr" desconhecido; esperado "pt-BR" ou "en"/);
  assert.equal(loader.current('fr'), null);
});

test('falha no import não fica memoizada: o próximo pedido tenta de novo', async () => {
  let imports = 0;
  const loader = createLocaleLoader({
    imports: {
      en: async () => {
        imports++;
        if (imports === 1) throw Error('sem catálogo');
        return {default: {title: 'Settings'}};
      },
    },
  });
  await assert.rejects(() => loader.load('en'), /sem catálogo/);
  assert.deepEqual(await loader.load('en'), {title: 'Settings'});
  assert.equal(imports, 2);
});
