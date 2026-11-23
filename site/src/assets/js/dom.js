// O pouco que todos os módulos da página dividem.

/** @param {string} selector @returns {any} */
export const $ = (selector) => document.querySelector(selector);
/** @param {string} selector @returns {any[]} */
export const $$ = (selector) => [...document.querySelectorAll(selector)];
export const svgNS = 'http://www.w3.org/2000/svg';
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Espera `ms`; com movimento reduzido, não espera. @param {number} ms */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduced ? 0 : ms));
/** Minúsculas sem acento, para a busca. `fold('Física')` → `'fisica'` @param {string} text */
export const fold = (text) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
/** Texto do usuário dentro de HTML. @param {string} text */
export const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** Atalhos com ⌘ no Mac e Ctrl nos outros. */
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
