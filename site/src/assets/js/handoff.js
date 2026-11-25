// No celular e no tablet não há instalador: os botões de baixar viram "Mandar
// para o computador". O compartilhamento do sistema leva o link (AirDrop,
// mensagem, e-mail para si); sem ele, o link vai para a área de transferência.
import {$} from './dom.js';

/**
 * Troca os dois botões de baixar (o do topo e o do começo) pelo envio do link.
 * @param {typeof import('./content-pt.js').default.text} text
 * @example initHandoff(content.text) // o botão do começo passa a dizer "Mandar para o computador"
 */
export function initHandoff(text) {
  const hero = $('#get-btn'), top = $('.top-actions .btn.primary');
  const label = $('.os-label');
  hero.dataset.os = 'mobile';
  label.textContent = text.sendToComputer;
  const meta = $('.get-meta');
  meta.className = 'get-note';
  meta.textContent = text.mobileNote;
  top.lastChild.textContent = text.sendShort;
  for (const btn of [hero, top]) {
    btn.href = '#';
    btn.querySelector('use').setAttribute('href', '#i-send');
    btn.addEventListener('click', (e) => { e.preventDefault(); sendLink(text, label); });
  }
}

async function sendLink(text, label) {
  const url = location.href.split('#')[0];
  if (navigator.share) {
    try { await navigator.share({title: document.title, url}); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); } catch { return; }
  label.textContent = text.linkCopied;
  setTimeout(() => { label.textContent = text.sendToComputer; }, 2500);
}
