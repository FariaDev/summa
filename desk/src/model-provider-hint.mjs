// @ts-check
/* A dica de um provedor só e a ação de entrar em outro (#128), sob demanda: a
   partida do renderer está no teto de 4 MiB (`tests/measure-boot.test.mjs`),
   então este módulo só entra quando o seletor de modelo abre (padrão do
   commit b40904f0). A classificação é pura e tem teste em
   `tests/model-picker.test.mjs`. */

import {t} from './ui-text.mjs';
import {providerName} from './model-picker.mjs';

/** @typedef {import('./model-picker.mjs').CatalogModel} CatalogModel */

/**
 * Diz se o catálogo só tem modelos grátis: a dica diz "grátis" em vez de
 * anunciar o Zen (#93). `onlyFreeCatalog([{free:{is:true}}])` → `true`
 * @param {CatalogModel[]} catalog
 * @returns {boolean}
 */
export function onlyFreeCatalog(catalog) {
  return catalog.length > 0 && catalog.every((model) => model.free?.is === true);
}

/**
 * O provedor único do catálogo, quando não há busca: a troca entre provedores
 * do OpenCode já é a própria lista; com um provedor só, o seletor oferece
 * entrar em outro. Dois ou mais provedores são a troca visível; catálogo vazio
 * é a espera do tutor. `connectProviderOffer([{provider: 'opencode'}])` → `'opencode'`
 * @param {CatalogModel[]} catalog
 * @param {string} [query]
 * @returns {string} o id do provedor, ou `''` quando não há oferta
 */
export function connectProviderOffer(catalog, query = '') {
  if (String(query ?? '').trim()) return '';
  const providers = new Set();
  for (const model of Array.isArray(catalog) ? catalog : []) {
    const provider = typeof model?.provider === 'string' ? model.provider : '';
    if (!provider) continue;
    providers.add(provider);
    if (providers.size > 1) return '';
  }
  return providers.size === 1 ? [...providers][0] : '';
}

/**
 * Cria o texto e o botão dentro do aviso do seletor e devolve o atualizador.
 * O botão fecha o popover e abre Configurações → Pastas e programas, onde a
 * conta entra no OpenCode; o catálogo relê `/api/model` e a troca aparece na
 * lista.
 * @param {HTMLElement} empty o `#model-empty`
 * @returns {{update: (catalog: CatalogModel[], query?: string) => void}}
 * @example mountProviderHint(document.querySelector('#model-empty'));
 */
export function mountProviderHint(empty) {
  const hint = document.createElement('span');
  hint.className = 'model-empty-text';
  const connect = document.createElement('button');
  connect.type = 'button';
  connect.id = 'model-connect-provider';
  connect.className = 'model-connect';
  connect.hidden = true;
  connect.addEventListener('click', () => {
    /* Fecha o seletor pelo mesmo gatilho e abre a entrada por provedor, onde
       a conta entra no OpenCode (#43). */
    (/** @type {HTMLElement | null} */ (document.querySelector('#model-indicator')))?.click();
    window.dispatchEvent(new CustomEvent('desk-open-settings', {detail: {section: 'pastas'}}));
  });
  return {
    update(catalog, query = '') {
      const offer = connectProviderOffer(catalog, query);
      if (hint.parentNode !== empty) empty.replaceChildren(hint, document.createTextNode(' '), connect);
      hint.textContent = offer ? t(onlyFreeCatalog(catalog) ? 'modelPicker.onlyFree' : 'modelPicker.oneProvider', {provider: providerName(offer)}) : '';
      connect.hidden = !offer;
      if (offer) connect.textContent = t('opencodeProviders.title');
      empty.hidden = !offer;
    },
  };
}
