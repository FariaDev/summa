// Tema e acento do site. Sem escolha, o tema segue o sistema; a escolha fica em
// localStorage 'summa-site' e volta pelo script inline do <head>, antes da pintura.
import {$, $$} from './dom.js';

const STORE = 'summa-site';
const root = document.documentElement;
const systemDark = matchMedia('(prefers-color-scheme: dark)');
let labels = {themeToLight: '', themeToDark: ''};

/** O tema que está na tela: o escolhido, ou o do sistema. @returns {'light'|'dark'} */
export const effectiveTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');
/** @returns {'graphite'|'violet'} */
const effectiveAccent = () => root.dataset.accent || 'graphite';

/**
 * Aplica e guarda uma preferência, e atualiza os botões que a mostram.
 * @param {'theme'|'accent'} key @param {string} value
 * @example setPref('theme', 'dark')
 */
export function setPref(key, value) {
  root.dataset[key] = value;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    localStorage.setItem(STORE, JSON.stringify({...saved, [key]: value}));
  } catch { /* sem localStorage (modo privado), a escolha vale só nesta visita */ }
  syncPrefButtons();
}

/** Alterna claro e escuro a partir do que está na tela. */
export const toggleTheme = () => setPref('theme', effectiveTheme() === 'dark' ? 'light' : 'dark');

function syncPrefButtons() {
  const now = {theme: effectiveTheme(), accent: effectiveAccent()};
  for (const seg of $$('.seg[data-k]')) {
    for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === now[seg.dataset.k]));
  }
  $('#theme-btn').setAttribute('aria-label', now.theme === 'dark' ? labels.themeToLight : labels.themeToDark);
}

/**
 * Liga o botão de tema do topo e os segmentos das Configurações da demo.
 * @param {{themeToLight: string, themeToDark: string}} text
 */
export function initPrefs(text) {
  labels = text;
  $('#theme-btn').addEventListener('click', toggleTheme);
  for (const seg of $$('.seg[data-k]')) {
    seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPref(seg.dataset.k, b.dataset.v); });
  }
  systemDark.addEventListener('change', syncPrefButtons);
  syncPrefButtons();
}
