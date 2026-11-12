/* Catálogo do idioma sob demanda (#desempenho). A partida importa só o idioma
   resolvido pelo preload; o outro catálogo fica fora do grafo estático e entra
   no primeiro uso (troca de idioma ou texto do tutor em outro idioma). Cada
   catálogo é lido uma vez; duas trocas simultâneas dividem a mesma promessa. */
import {isLanguage} from './i18n.mjs';

/** @typedef {Record<string, string>} Catalog */

const LOCALE_IMPORTS = {
  'pt-BR': () => import('./locales/pt-BR.json', {with: {type: 'json'}}),
  en: () => import('./locales/en.json', {with: {type: 'json'}}),
};

/**
 * Carrega catálogos de idioma sob demanda e os memoiza.
 * `languages` lista os idiomas que o carregador entende.
 * @param {{imports?: Record<string, () => Promise<{default?: Catalog} | Catalog>>}} [options]
 * @returns {{load: (language: string) => Promise<Catalog>, current: (language: string) => Catalog | null, languages: Array<'pt-BR' | 'en'>}}
 * @example
 * const locales = createLocaleLoader();
 * assert.equal(locales.current('en'), null);
 * const en = await locales.load('en'); // en.json entra só agora
 */
export function createLocaleLoader({imports = LOCALE_IMPORTS} = {}) {
  /** @type {Map<string, Catalog>} */
  const catalogs = new Map();
  /** @type {Map<string, Promise<Catalog>>} */
  const pending = new Map();

  /** @param {string} language */
  function load(language) {
    if (!isLanguage(language)) {
      return Promise.reject(new Error(`locale-loader: idioma ${JSON.stringify(language)} desconhecido; esperado ${JSON.stringify('pt-BR')} ou ${JSON.stringify('en')}`));
    }
    const loaded = catalogs.get(language);
    if (loaded) return Promise.resolve(loaded);
    const started = pending.get(language);
    if (started) return started;
    const promise = Promise.resolve()
      .then(() => imports[language]())
      .then((module) => {
        const catalog = /** @type {Catalog} */ (module?.default ?? module);
        catalogs.set(language, catalog);
        return catalog;
      })
      .finally(() => pending.delete(language));
    pending.set(language, promise);
    return promise;
  }

  return {
    load,
    current: (language) => catalogs.get(language) ?? null,
    languages: /** @type {Array<'pt-BR' | 'en'>} */ (Object.keys(imports)),
  };
}
