'use strict';

/** Fundo da janela principal e da filha (#157): os mesmos hex que
 * `desk/main.cjs` usa para a principal (`#191919` escuro, `#f7f7f7` claro),
 * exportados num só lugar para a guarda da janela solta sugerir a cor sem
 * flash branco. A principal ainda usa a literal inline (800 linhas, sem
 * tocar); quando ela importar daqui, a duplicação sai sem mudar regra. */
/** @type {{dark: string, light: string}} */
const WINDOW_BACKGROUND_COLORS = {dark: '#191919', light: '#f7f7f7'};

/**
 * Cor de fundo para um tema, como a principal decide (`dark` escuro, resto claro).
 * @param {string | undefined} theme `dark`, `light`, `auto` ou ausente (cai no claro)
 * @returns {string} hex do fundo
 * @example backgroundColorForTheme('dark') // '#191919'
 */
function backgroundColorForTheme(theme) {
  return theme === 'dark' ? WINDOW_BACKGROUND_COLORS.dark : WINDOW_BACKGROUND_COLORS.light;
}

/**
 * Tema inferido de um fundo conhecido (o que a principal definiu na janela).
 * @param {string | undefined} color fundo atual (`getBackgroundColor()` da janela)
 * @returns {'dark' | 'light'}
 * @example themeForBackgroundColor('#191919') // 'dark'
 */
function themeForBackgroundColor(color) {
  return color === WINDOW_BACKGROUND_COLORS.dark ? 'dark' : 'light';
}

module.exports = {WINDOW_BACKGROUND_COLORS, backgroundColorForTheme, themeForBackgroundColor};
