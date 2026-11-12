// @ts-check
/* Idioma da interface no renderer (#41): o `t()` único da janela, o texto
   estático do index.html (`data-i18n` / `data-i18n-attr`) e a troca na hora.
   Os catálogos são `desk/src/locales/*.json`; o corpo de `t()` e `text()` mora em
   `i18n.mjs`, que não depende do DOM. */
import {createI18n, isLanguage, FALLBACK_LANGUAGE} from './i18n.mjs';
import {createLocaleLoader} from './locale-loader.mjs';

export const LANGUAGE_EVENT = 'desk-language';

/* O main resolve o idioma antes de abrir a janela e o preload o entrega: o
   catálogo ATIVO entra antes do primeiro desenho; o outro fica fora da partida
   e é importado na troca (#desempenho). No Node (testes e hosts CJS, onde
   `process.getBuiltinModule` existe) os dois catálogos são lidos de forma
   síncrona, o mesmo comportamento de antes. No renderer, `uiTextReady` é a
   promessa que o `main.mjs` espera antes de pintar texto — sem top-level await
   aqui, que quebraria o `require()` dos hosts CJS. */
const locales = createLocaleLoader();
/** @type {Partial<Record<'pt-BR' | 'en', Record<string, string>>>} */
const catalogs = {};
const requested = globalThis.window?.desk?.initialLanguage;
const initialLanguage = /** @type {'pt-BR' | 'en'} */ (isLanguage(requested) ? requested : FALLBACK_LANGUAGE);

/** Lê um catálogo do disco quando o processo é Node (testes e hosts CJS).
 * @param {'pt-BR' | 'en'} language
 * @returns {Record<string, string> | null} */
function readNodeCatalog(language) {
  const process = /** @type {{getBuiltinModule?: (name: string) => any}} */ (globalThis.process);
  const fs = process?.getBuiltinModule?.('node:fs');
  if (!fs) return null;
  try {
    return JSON.parse(fs.readFileSync(new URL(`./locales/${language}.json`, import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}

if (globalThis.process?.getBuiltinModule) {
  for (const language of locales.languages) catalogs[language] = readNodeCatalog(language);
}

/* No renderer só o idioma ativo é importado; o `main.mjs` espera esta promessa
   antes de `setUiLanguage`, então a primeira pintura não vê chave crua. */
export const uiTextReady = catalogs[initialLanguage]
  ? Promise.resolve()
  : locales.load(initialLanguage).then((catalog) => {
    catalogs[initialLanguage] = catalog;
  });

const i18n = createI18n({catalogs, language: initialLanguage});

/** Garante o catálogo antes de trocar para o idioma; a promessa é compartilhada.
 * @param {'pt-BR' | 'en'} language
 * @returns {Promise<Record<string, string>>} */
async function ensureCatalog(language) {
  const loaded = catalogs[language];
  if (loaded) return loaded;
  const catalog = await locales.load(language);
  catalogs[language] = catalog;
  return catalog;
}

/** @param {string} key @param {Record<string, string | number>} [args] */
export const t = (key, args) => i18n.t(key, args);
/** Mensagem dos núcleos Bend → texto no idioma atual. @param {string} value */
export const text = (value) => i18n.text(value);
export const currentLanguage = () => i18n.getLanguage();

/** Formata números e datas no idioma da interface, nunca no do sistema.
 * @param {number} value @param {Intl.NumberFormatOptions} [options] */
export const formatNumber = (value, options) => new Intl.NumberFormat(i18n.getLanguage(), options).format(value);
/** @param {Date | number} value @param {Intl.DateTimeFormatOptions} [options] */
export const formatDate = (value, options) => new Intl.DateTimeFormat(i18n.getLanguage(), options).format(value);

/**
 * Frase que vai ao MODELO (não à tela): segue o idioma do tutor, que pode diferir do da interface.
 * @param {string} key @param {Record<string, string | number>} [args]
 * @returns {Promise<string>}
 */
export async function tutorText(key, args) {
  const chosen = await globalThis.window?.desk?.languageGet?.();
  const requested = chosen && isLanguage(chosen.tutor) ? chosen.tutor : chosen?.ui;
  const language = /** @type {'pt-BR' | 'en'} */ (isLanguage(requested) ? requested : i18n.getLanguage());
  await ensureCatalog(language);
  return createI18n({catalogs, language}).t(key, args);
}

/** @type {Array<(changed: Element[]) => void>} */
const afterStaticText = [];
/** Registra o que roda depois de o texto estático ser reescrito (ex.: ⌘ → Ctrl fora do Mac), com os elementos tocados.
 * @param {(changed: Element[]) => void} listener */
export const onStaticTextApplied = (listener) => { afterStaticText.push(listener); };

/**
 * Traduz o texto estático de um trecho do DOM.
 * `data-i18n="chave"` troca o texto; `data-i18n-html="chave"` troca o conteúdo por marcação do catálogo
 * (só <strong>, <kbd>, <code>, <em>: a frase vem de `src/locales/`, nunca do aluno);
 * `data-i18n-attr="title=chave;aria-label=outra"` troca atributos.
 * @param {ParentNode} [root]
 */
export function applyStaticText(root = document) {
  /** @type {Element[]} */
  const changed = [];
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(/** @type {string} */ (el.getAttribute('data-i18n')));
    changed.push(el);
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(/** @type {string} */ (el.getAttribute('data-i18n-html')));
    changed.push(el);
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of String(el.getAttribute('data-i18n-attr')).split(';')) {
      const [attr, key] = pair.split('=').map((part) => part.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
    changed.push(el);
  }
  for (const listener of afterStaticText) listener(changed);
}

/** Aplica o idioma já com o catálogo na mão: `<html lang>`, texto estático e o evento.
 * @param {'pt-BR' | 'en'} next */
function applyLanguage(next) {
  i18n.setLanguage(next);
  document.documentElement.lang = next;
  applyStaticText(document);
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, {detail: {language: next}}));
}

/**
 * Controla a troca de idioma quando o catálogo pode estar carregando: só a
 * ÚLTIMA chamada pendente aplica (duas trocas para o mesmo idioma disparam um
 * evento só, e uma carga antiga que chega atrasada não desfaz a troca nova).
 * @param {{isLoaded: (language: 'pt-BR' | 'en') => boolean, loadCatalog: (language: 'pt-BR' | 'en') => Promise<unknown>, apply: (language: 'pt-BR' | 'en') => void}} deps
 * @returns {{set: (language: 'pt-BR' | 'en') => void | Promise<void>}}
 * @example
 * const switcher = createLanguageSwitch({isLoaded, loadCatalog, apply});
 * await switcher.set('en'); // aplica uma vez, quando o catálogo chega
 */
export function createLanguageSwitch({isLoaded, loadCatalog, apply}) {
  let request = 0;
  let wanted = '';
  return {
    set(language) {
      wanted = language;
      const current = ++request;
      if (isLoaded(language)) {
        apply(language);
        return;
      }
      return loadCatalog(language).then(() => {
        if (current === request && wanted === language) apply(language);
      });
    },
  };
}

const languageSwitch = createLanguageSwitch({
  isLoaded: (language) => !!catalogs[language],
  loadCatalog: (language) => ensureCatalog(language),
  apply: (language) => applyLanguage(language),
});

/**
 * Troca o idioma da interface: `<html lang>`, texto estático e o evento que
 * faz as telas dinâmicas se refazerem.
 * O catálogo do idioma novo entra sob demanda (#desempenho): a troca vale na
 * hora se ele já estava na memória; senão a promessa devolvida resolve depois
 * da pintura. O idioma anterior segue na tela até lá, sem chave crua.
 * @param {string} language "pt-BR" ou "en"
 * @returns {void | Promise<void>} promessa só quando o catálogo ainda não estava carregado.
 * @example setUiLanguage('en') // a janela inteira passa para inglês na hora
 */
export function setUiLanguage(language) {
  const next = /** @type {'pt-BR' | 'en'} */ (isLanguage(language) ? language : FALLBACK_LANGUAGE);
  return languageSwitch.set(next);
}
