/* A troca de idioma com o catálogo sob demanda (#desempenho): duas chamadas
   para o mesmo idioma durante a carga não podem disparar dois LANGUAGE_EVENT,
   e a última troca pedida vence quando uma carga antiga chega atrasada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLanguageSwitch} from '../src/ui-text.mjs';

function deferredImport() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {promise, resolve};
}

test('duas trocas para o mesmo idioma durante a carga aplicam uma vez', async () => {
  const gate = deferredImport();
  const applied = [];
  const switchTo = createLanguageSwitch({
    isLoaded: () => false,
    loadCatalog: () => gate.promise,
    apply: (language) => applied.push(language),
  });
  const first = switchTo.set('en');
  const second = switchTo.set('en');
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(applied, ['en'], 'só a última chamada pendente aplica');
});

test('en pendente e logo pt-BR já carregado fica em pt-BR', async () => {
  const gate = deferredImport();
  const applied = [];
  const loaded = new Set(['pt-BR']);
  const switchTo = createLanguageSwitch({
    isLoaded: (language) => loaded.has(language),
    loadCatalog: () => gate.promise,
    apply: (language) => applied.push(language),
  });
  const pending = switchTo.set('en');
  switchTo.set('pt-BR');
  gate.resolve();
  await pending;
  assert.deepEqual(applied, ['pt-BR'], 'a carga de en que chega depois não desfaz a troca');
});

/* A cena real do renderer: o catálogo de `en` ainda não está na memória (no
   Node os catálogos entram síncronos, então a instância nova é importada sem o
   `process.getBuiltinModule`), e duas chamadas durante a carga contam evento. */
async function rendererUiText(tag) {
  const events = [];
  globalThis.window = {
    desk: {initialLanguage: 'pt-BR'},
    dispatchEvent: (event) => events.push(event),
  };
  globalThis.document = {documentElement: {lang: ''}, querySelectorAll: () => []};
  const original = process.getBuiltinModule;
  process.getBuiltinModule = undefined;
  try {
    const module = await import(`../src/ui-text.mjs?${tag}`);
    return {module, events};
  } finally {
    process.getBuiltinModule = original;
  }
}

test('setUiLanguage("en") duas vezes durante a carga dispara um evento', async () => {
  const {module, events} = await rendererUiText('pending-en');
  await module.uiTextReady;
  const first = module.setUiLanguage('en');
  const second = module.setUiLanguage('en');
  await Promise.all([first, second]);
  const languageEvents = events.filter((event) => event.type === module.LANGUAGE_EVENT);
  assert.equal(languageEvents.length, 1, 'um evento só para as duas chamadas');
  assert.equal(globalThis.document.documentElement.lang, 'en');
});

test('setUiLanguage("en") e logo "pt-BR" fica em pt-BR com um evento', async () => {
  const {module, events} = await rendererUiText('pending-back');
  await module.uiTextReady;
  const pending = module.setUiLanguage('en');
  const back = module.setUiLanguage('pt-BR');
  await Promise.all([pending, back]);
  const languageEvents = events.filter((event) => event.type === module.LANGUAGE_EVENT);
  assert.equal(languageEvents.length, 1, 'só a troca que venceu aplica');
  assert.equal(globalThis.document.documentElement.lang, 'pt-BR');
});
