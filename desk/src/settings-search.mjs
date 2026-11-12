// @ts-check
/* Busca das Configurações (Carbon r2): filtra as seções da lateral e as linhas
   da seção aberta. A comparação é sem acento e sem caixa, como a do Guia. A
   seção que casa pelo título/descrição entra inteira; senão só as linhas que
   casam ficam à vista, e o host troca para a primeira seção com resultado. */
import {text} from './ui-text.mjs';

/* Linhas que a busca esconde/ mostra sozinhas. Blocos dinâmicos (matérias,
   leitores, provedores e modelos) são unidades: casar um item mostra o bloco. */
export const SETTINGS_ROW_SELECTOR = [
  '#settings-sec-materias .cfg-course',
  '#settings-sec-leitores #cfg-layout .cfg-layout-readers',
  '#settings-sec-leitores #cfg-layout .cfg-layout-panel',
  '#settings-sec-leitores #cfg-layout > .cfg-layout-preview',
  '#settings-sec-leitores #layout-presets-open',
  '#settings-sec-mesa > .set-group > label',
  '#settings-sec-avisos > .set-group > label',
  '#settings-sec-avisos > label',
  '#settings-sec-avisos #accent-mode',
  '#settings-sec-avisos #notify-mode',
  '#settings-sec-pastas > .set-group > label',
  '#settings-sec-pastas .cfg-conferir',
  '#settings-sec-pastas #cfg-opencode-providers',
  '#settings-sec-pastas #cfg-free-models',
].join(',');

const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const sectionsOf = (body) => [...body.querySelectorAll(':scope > [data-sec]')];
const rowsOf = (section) => [...section.querySelectorAll(SETTINGS_ROW_SELECTOR)];

/**
 * O texto que identifica uma seção: o rótulo da lateral, o título e a descrição.
 * @param {HTMLElement} section
 * @returns {string}
 * @example sectionOwnText(document.querySelector('#settings-sec-mesa'))
 */
function sectionOwnText(section) {
  const id = section.dataset.sec;
  const nav = document.querySelector(`#settings-tabs [data-sec="${id}"]`);
  const title = section.querySelector('.set-head h3');
  return [nav?.textContent, title?.textContent].map(text).join(' ');
}

/**
 * A seção casa pelo próprio texto ou por alguma linha.
 * @param {HTMLElement} section
 * @param {string} query
 * @returns {boolean}
 * @example settingsSectionMatches(section, 'mesa') // true quando o nome ou uma linha fala de mesa
 */
export function settingsSectionMatches(section, query) {
  const folded = fold(query);
  if (!folded) return true;
  if (fold(sectionOwnText(section)).includes(folded)) return true;
  return rowsOf(section).some((row) => fold(row.textContent).includes(folded));
}

/**
 * Aplica o filtro numa seção e devolve se algo ficou à vista.
 * @param {HTMLElement} section
 * @param {string} query
 * @returns {boolean}
 * @example filterSettingsSection(section, 'calculadora')
 */
export function filterSettingsSection(section, query) {
  const folded = fold(query);
  const own = !folded || fold(sectionOwnText(section)).includes(folded);
  const rows = rowsOf(section);
  for (const row of rows) {
    row.classList.toggle('settings-filtered', !own && !fold(row.textContent).includes(folded));
  }
  for (const group of [...section.querySelectorAll('.set-group')].reverse()) {
    /* O grupo de acento é ele próprio uma linha; quem o esconde é o laço de
       linhas acima, não a conta de descendentes. */
    if (group.id === 'accent-mode') continue;
    const groupOwn = own || fold(group.querySelector(':scope > .set-group-label')?.textContent).includes(folded);
    if (groupOwn) for (const row of group.querySelectorAll(SETTINGS_ROW_SELECTOR)) row.classList.remove('settings-filtered');
    const visible = groupOwn || [...group.querySelectorAll(SETTINGS_ROW_SELECTOR)].some((row) => !row.classList.contains('settings-filtered'));
    group.classList.toggle('settings-filtered', !visible);
  }
  for (const note of section.querySelectorAll('.fine')) {
    const previous = note.previousElementSibling;
    const hiddenPrevious = previous && (previous.classList.contains('settings-filtered') || previous.closest('.settings-filtered'));
    note.classList.toggle('settings-filtered', !own && !!hiddenPrevious && !fold(note.textContent).includes(folded));
  }
  for (const box of section.querySelectorAll('#cfg-courses, #cfg-layout')) {
    const visible = [...box.querySelectorAll(SETTINGS_ROW_SELECTOR)].some((row) => !row.classList.contains('settings-filtered'));
    box.classList.toggle('settings-filtered', !visible);
  }
  for (const link of section.querySelectorAll('.set-link')) {
    link.classList.toggle('settings-filtered', !own && !fold(link.textContent).includes(folded));
  }
  return own || rows.some((row) => !row.classList.contains('settings-filtered'));
}

/**
 * Tira o filtro de uma seção.
 * @param {HTMLElement} section
 * @example clearSettingsFilter(section)
 */
export function clearSettingsFilter(section) {
  for (const el of section.querySelectorAll('.settings-filtered')) el.classList.remove('settings-filtered');
}

/**
 * Todas as seções que casam com a busca, na ordem da lateral.
 * @param {HTMLElement} body
 * @param {string} query
 * @returns {string[]} ids das seções
 * @example matchingSettingsSections(body, 'pasta') // ['pastas']
 */
export function matchingSettingsSections(body, query) {
  return sectionsOf(body).filter((section) => settingsSectionMatches(section, query)).map((section) => section.dataset.sec);
}
