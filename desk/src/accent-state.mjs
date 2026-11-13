// @ts-check
/* Cor de acento (#9): estado de interface, como o tema. O nome do acento é o
   que o `desk.json` grava (núcleo `core/accent.bend`). Este módulo também
   aplica a marca do cabeçalho, que segue o tema e o acento (#189). */

/** Os acentos na ordem das opções; grafite é o padrão. */
export const ACCENTS = /** @type {const} */ ([['graphite', 'Grafite'], ['violet', 'Violeta']]);

const PREFERS_DARK = '(prefers-color-scheme: dark)';

/**
 * A variante da marca pela combinação de tema e acento, com a mesma regra de
 * `desk/app-icon-host.cjs#iconVariant`: tema 'auto'/'system' segue o sistema e
 * qualquer acento que não seja 'violet' usa a tinta grafite.
 * @param {string} theme 'light' | 'dark' | 'auto' | 'system'
 * @param {string} accent id do acento ('graphite', 'violet')
 * @param {() => boolean} [systemDark] sistema em tema escuro
 * @returns {'light-graphite'|'dark-graphite'|'light-violet'|'dark-violet'}
 * @example brandIconVariant('auto','violet',()=>true) // 'dark-violet'
 */
export function brandIconVariant(theme, accent, systemDark = () => false) {
  const dark = theme === 'dark' || ((theme === 'auto' || theme === 'system') && systemDark());
  return `${dark ? 'dark' : 'light'}-${accent === 'violet' ? 'violet' : 'graphite'}`;
}

/**
 * Atualiza a marca do cabeçalho para o tema e o acento correntes.
 * @param {any} S estado da Mesa
 * @param {Document} [doc]
 * @param {() => boolean} [systemDark] sistema em tema escuro (testes)
 * @example applyBrandIcon(S)
 */
export function applyBrandIcon(S, doc = document, systemDark = () => !!doc.defaultView?.matchMedia?.(PREFERS_DARK).matches) {
  const src = `assets/app-icon/integral-${brandIconVariant(S.currentTheme, S.currentAccent, systemDark)}-128.png`;
  for (const brand of doc.querySelectorAll('.brand-icon')) brand.setAttribute('src', src);
}

/* O tema muda por `applyTheme` (state.mjs), sem passar pelo acento; este
   observador refaz a marca quando `data-theme` muda. Em 'auto' o sistema
   também pode mudar sozinho: o listener do matchMedia cobre. */
const watchedDocs = new WeakSet();
function watchBrandIcon(S, doc) {
  if (!doc.documentElement || watchedDocs.has(doc)) return;
  watchedDocs.add(doc);
  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => applyBrandIcon(S, doc)).observe(doc.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  }
  doc.defaultView?.matchMedia?.(PREFERS_DARK).addEventListener?.('change', () => applyBrandIcon(S, doc));
}

/**
 * Aplica e marca a cor de acento.
 * @param {any} S
 * @param {unknown} value
 * @param {Document} [doc]
 */
export function applyAccentState(S, value, doc = document) {
  S.currentAccent = ACCENTS.some(([id]) => id === value) ? value : 'graphite';
  if (S.currentAccent === 'graphite') delete doc.documentElement.dataset.accent;
  else doc.documentElement.dataset.accent = S.currentAccent;
  for (const option of doc.querySelectorAll('.accent-option[data-accent]')) {
    const on = option.getAttribute('data-accent') === S.currentAccent;
    option.setAttribute('aria-checked', String(on));
    /** @type {HTMLElement} */ (option).tabIndex = on ? 0 : -1;
  }
  watchBrandIcon(S, doc);
  applyBrandIcon(S, doc);
}
