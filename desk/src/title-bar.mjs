// @ts-check
/* Barra de título própria no Windows e no Linux (title-bar-host.cjs): a faixa
   do topo arrasta a janela, abre espaço para os botões do sistema à direita e
   ganha o botão ≡ com o menu inteiro. Os botões do sistema seguem a cor e a
   altura da faixa à vista: abas, primeira abertura ou modo mini. */
import {icon} from '../icons.mjs';

/** Faixas que ficam no topo, da mais específica para a geral. */
const TOP_BARS = [
  {selector: '#mini-head', when: body => body.classList.contains('mini-mode')},
  {selector: '.setup-bar', when: body => body.hasAttribute('data-first-run')},
  {selector: 'body>header', when: () => true},
];
/* Largura dos três botões do Windows; vale até o `windowControlsOverlay` dizer a real. */
const FALLBACK_RESERVE = 138;

/**
 * Converte `rgb(r, g, b)` ou `rgba(...)` do `getComputedStyle` em `#rrggbb`.
 * @param {string} value
 * @returns {string|null}
 * @example cssColorToHex('rgb(247, 247, 247)'); // '#f7f7f7'
 */
export function cssColorToHex(value) {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(String(value).trim());
  if (!match || match[4] === '0') return null;
  return `#${match.slice(1, 4).map(part => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A faixa do topo à vista agora.
 * @param {Document} doc
 * @returns {HTMLElement|null}
 * @example topBarOf(document); // <header> fora do mini e da primeira abertura
 */
export function topBarOf(doc) {
  for (const bar of TOP_BARS) {
    if (!bar.when(doc.body)) continue;
    const el = /** @type {HTMLElement|null} */ (doc.querySelector(bar.selector));
    if (el && el.offsetHeight > 0) return el;
  }
  return null;
}

/**
 * Cor, cor dos botões e altura para o `setTitleBarOverlay`, lidas da faixa.
 * @param {HTMLElement} bar
 * @param {(el: Element) => CSSStyleDeclaration} styleOf
 * @returns {{color: string, symbolColor: string, height: number}|null}
 * @example overlayOf(header, getComputedStyle); // {color:'#f7f7f7', symbolColor:'#1f1f1f', height:44}
 */
export function overlayOf(bar, styleOf) {
  const style = styleOf(bar);
  const color = cssColorToHex(style.backgroundColor);
  const symbolColor = cssColorToHex(style.color);
  if (!color || !symbolColor) return null;
  /* `clientHeight` deixa de fora a borda de baixo: com a altura inteira os botões cobriam a linha. */
  return {color, symbolColor, height: Math.round(bar.clientHeight)};
}

/** Quanto da direita os botões do sistema ocupam, em px. */
function controlsReserve(win) {
  const overlay = win.navigator?.windowControlsOverlay;
  const rect = overlay?.visible ? overlay.getTitlebarAreaRect?.() : null;
  if (!rect || !rect.width) return FALLBACK_RESERVE;
  return Math.max(0, Math.round(win.innerWidth - (rect.x + rect.width)));
}

/**
 * Liga a barra de título própria quando o main diz que ela vale.
 * @param {{doc: Document, desk: {titleBarMode?: string, titleBarOverlay: Function, titleBarMenu: Function}, label: () => string, languageEvent: string}} deps
 * @returns {{sync: () => void}|null}
 * @example initTitleBar({doc:document, desk:window.desk, label:()=>t('chrome.appMenu'), languageEvent:LANGUAGE_EVENT});
 */
export function initTitleBar({doc, desk, label, languageEvent}) {
  if (desk.titleBarMode !== 'overlay') return null;
  const win = /** @type {any} */ (doc.defaultView);
  doc.body.classList.add('custom-titlebar');
  const menuButton = addMenuButton(doc, desk, label);
  watchLoneAlt(win, () => { if (menuButton.offsetParent) openMenu(menuButton, desk); });
  win.addEventListener(languageEvent, () => paintMenuLabel(menuButton, label));
  let last = '';
  let queued = false;
  const sync = () => {
    queued = false;
    doc.documentElement.style.setProperty('--titlebar-reserve', `${controlsReserve(win)}px`);
    const bar = topBarOf(doc);
    const overlay = bar && overlayOf(bar, el => win.getComputedStyle(el));
    const key = JSON.stringify(overlay);
    if (!overlay || key === last) return;
    last = key;
    desk.titleBarOverlay(overlay).catch(() => { last = ''; });
  };
  const queue = () => { if (!queued) { queued = true; win.requestAnimationFrame(sync); } };
  const watch = new win.MutationObserver(queue);
  watch.observe(doc.documentElement, {attributes: true, attributeFilter: ['data-theme', 'data-accent']});
  watch.observe(doc.body, {attributes: true, attributeFilter: ['class', 'data-first-run']});
  win.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', queue);
  win.navigator?.windowControlsOverlay?.addEventListener?.('geometrychange', queue);
  win.addEventListener('resize', queue);
  queue();
  return {sync};
}

function addMenuButton(doc, desk, label) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.id = 'app-menu-button';
  button.className = 'nav-trigger';
  button.innerHTML = icon('menu');
  paintMenuLabel(button, label);
  button.addEventListener('click', () => openMenu(button, desk));
  doc.querySelector('header .header-nav')?.prepend(button);
  return button;
}

function openMenu(button, desk) {
  const rect = button.getBoundingClientRect();
  desk.titleBarMenu({x: rect.left, y: rect.bottom});
}

/**
 * Chama `open` quando o Alt é apertado e solto sozinho, como a barra de menu do
 * Windows fazia. Sem a moldura do sistema não há barra para o Alt mostrar
 * (visto na VM Windows 11, teste da 1.4.1). Outra tecla ou clique no meio
 * desarma: Alt+Shift, Alt+F4 e o AltGr não abrem o menu.
 * @param {Window} win
 * @param {() => void} open
 * @returns {void}
 * @example watchLoneAlt(window, () => openMenu(button, desk));
 */
export function watchLoneAlt(win, open) {
  let armed = false;
  win.addEventListener('keydown', event => {
    if (event.key !== 'Alt') { armed = false; return; }
    if (!event.repeat) armed = !event.ctrlKey && !event.shiftKey && !event.metaKey;
  }, true);
  win.addEventListener('keyup', event => {
    if (event.key !== 'Alt') return;
    const lone = armed;
    armed = false;
    if (lone) open();
  }, true);
  win.addEventListener('mousedown', () => { armed = false; }, true);
  win.addEventListener('blur', () => { armed = false; });
}

function paintMenuLabel(button, label) {
  const text = label();
  button.title = text;
  button.setAttribute('aria-label', text);
}
