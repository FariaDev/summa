import {createLazyModule} from './lazy-module.mjs';

/**
 * Cria uma fachada que busca a navegação só quando uma ação do leitor a usa.
 * @param {() => Promise<typeof import('./nav.mjs')>} importModule
 * @returns {{openRef: (...args: Parameters<typeof import('./nav.mjs').openRef>) => Promise<boolean>, navBack: (...args: Parameters<typeof import('./nav.mjs').navBack>) => Promise<void>, toggleNav: (...args: Parameters<typeof import('./nav.mjs').toggleNav>) => Promise<void>}}
 * @example const nav = createNavLoader(() => import('./nav.mjs')); await nav.openRef('Limites.pdf', 2);
 */
export function createNavLoader(importModule = () => import('./nav.mjs')) {
  const lazy = createLazyModule({importModule});
  return {
    openRef: async (...args) => (await lazy.load()).openRef(...args),
    navBack: async (...args) => (await lazy.load()).navBack(...args),
    toggleNav: async (...args) => (await lazy.load()).toggleNav(...args),
  };
}

const nav = createNavLoader();
/** Abre uma referência (PDF/material) pela navegação, importando `nav.mjs` no primeiro uso.
 * @param {...any} args nome, página e caminho (contrato do `openRef` de `nav.mjs`)
 * @returns {Promise<boolean>} `true` se a referência abriu
 * @example await openRef('Limites.pdf', 2, '/curso/Limites.pdf');
 */
export const openRef = (...args) => nav.openRef(...args);
/** Volta no histórico de navegação do leitor.
 * @param {...any} args painel que pediu a volta
 * @returns {Promise<void>}
 * @example await navBack('painel');
 */
export const navBack = (...args) => nav.navBack(...args);
/** Alterna a navegação do leitor.
 * @param {...any} args painel que pediu a alternância
 * @returns {Promise<void>}
 * @example await toggleNav('painel');
 */
export const toggleNav = (...args) => nav.toggleNav(...args);

/* O toast mora no `state.mjs` (que depende do DOM): o import só acontece no
   caminho de erro, fora da partida e fora dos testes de nó. */
async function citationFailure(message) {
  try {
    const {toast} = await import('./state.mjs');
    toast(message);
  } catch {}
}

/**
 * Liga o clique delegado nas citações (`button.pdf-ref`) ao `openRef`. Fica no
 * loader (estático) porque o `nav.mjs` só carrega no primeiro uso; sem isto, a
 * primeira citação clicada não teria quem a abrisse.
 * @param {Document} doc
 * @param {(...args: any[]) => any} [open]
 * @param {(message: string) => void} [notify] aviso da falha de importação
 * @returns {() => void} remove o listener
 * @example const unbind = bindCitationLinks(document);
 */
export function bindCitationLinks(doc, open = openRef, notify = citationFailure) {
  const onClick = (event) => {
    const ref = event.target?.closest?.('button.pdf-ref');
    if (!ref) return;
    event.preventDefault();
    const result = open(ref.dataset.name || '', Number(ref.dataset.page) || 1, ref.dataset.path || '');
    if (result && typeof result.catch === 'function') result.catch((error) => notify(error?.message || String(error)));
  };
  doc.addEventListener('click', onClick);
  return () => doc.removeEventListener('click', onClick);
}

if (typeof document !== 'undefined') bindCitationLinks(document);
