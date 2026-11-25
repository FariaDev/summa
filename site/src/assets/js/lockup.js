// Os cartões da marca do topo: com mouse, o CSS abre no hover; no toque (sem hover), o clique abre
// e fecha. Esc e qualquer outro clique (inclusive no cartão, que no celular cobre o texto de baixo)
// fecham, e só um cartão fica aberto por vez.
import {$$} from './dom.js';

/** Liga os botões `.egg` da marca aos cartões que descrevem. `initLockup()` */
export function initLockup() {
  const eggs = $$('.lockup .egg');
  const close = (except) => { for (const b of eggs) if (b !== except) b.setAttribute('aria-expanded', 'false'); };
  for (const b of eggs) b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    close(b);
    b.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.lockup .egg')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
