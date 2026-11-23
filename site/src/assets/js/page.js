// O resto da página em volta da demo: aba do topo que segue a seção, recursos que
// dirigem a demo, a seção Instalar e o botão de baixar do sistema de quem visita.
import {$, $$, reduced} from './dom.js';

const RELEASES_PAGE = 'https://github.com/FariaDev/summa/releases/latest';
const OS_NAMES = {mac: 'macOS', win: 'Windows', linux: 'Linux'};

/** O sistema de quem visita, pelo user agent; sem pista, macOS. @param {string} ua @returns {'mac'|'win'|'linux'} */
export function detectOs(ua) {
  if (/Windows/.test(ua)) return 'win';
  if (/Linux/.test(ua) && !/Android/.test(ua)) return 'linux';
  return 'mac';
}

function selectOs(os) {
  for (const t of $$('.os-tabs button')) t.setAttribute('aria-selected', String(t.dataset.os === os));
  for (const p of $$('.os-panel')) p.hidden = p.dataset.os !== os;
}

// O botão do topo aponta para o instalador da última Release que tem um; o build
// grava a lista em #downloads. Sem instalador, vai para a página de Releases.
function initDownload(text) {
  const os = detectOs(navigator.userAgent);
  let downloads = {};
  try { downloads = JSON.parse($('#downloads').textContent); } catch { /* fica o link da página de Releases */ }
  const item = downloads[os];
  const btn = $('#get-btn');
  btn.href = item?.url || RELEASES_PAGE;
  btn.dataset.os = os;
  $('.os-label').textContent = `${text.downloadFor} ${OS_NAMES[os]}`;
  const version = item ? `v${item.version}` : downloads.latest || '';
  const others = Object.keys(OS_NAMES).filter((o) => o !== os).map((o) => `<a href="#instalar" data-os="${o}">${OS_NAMES[o]}</a>`);
  $('.get-meta').innerHTML = [version, ...others].filter(Boolean).join(' · ');
  selectOs(os);
}

function initNav() {
  // Âncoras nativas (com scroll-padding no CSS); o data-os só escolhe a aba de Instalar.
  document.addEventListener('click', (e) => { const a = e.target.closest('a[data-os]'); if (a && a.getAttribute('href') === '#instalar') selectOs(a.dataset.os); });
  for (const t of $$('.os-tabs button')) t.addEventListener('click', () => selectOs(t.dataset.os));
  // A aba do topo segue a seção à vista.
  const links = $$('.tabs a');
  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const a of links) a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
    }
  }, {rootMargin: '-45% 0px -50% 0px'});
  for (const id of ['demo', 'recursos', 'perguntas', 'instalar']) spy.observe($('#' + id));
}

// Os recursos lá embaixo sobem até a demo e mostram o que descrevem.
function initFeatures(demo) {
  for (const b of $$('button.feat')) b.addEventListener('click', () => {
    $('#demo').scrollIntoView({behavior: reduced ? 'auto' : 'smooth'});
    const go = b.dataset.go;
    setTimeout(() => {
      if (demo.busy()) return;
      if (go === 'check') { demo.setMini(false); if (demo.view() !== demo.course()) demo.setTab(demo.course()); demo.conferir(); }
      if (go === 'ref') { demo.setMini(false); demo.setTab(demo.course() === 'livre' ? 'calc1' : demo.course()); demo.highlight(demo.firstMark()); }
      if (go === 'caderno' || go === 'ggb') demo.setTab(go);
      if (go === 'mini') demo.setMini(true);
    }, reduced ? 0 : 450);
  });
}

// Copiar do bloco de código, com o visto do app.
function initCopy(text) {
  for (const btn of $$('.code .icon-btn')) btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.parentElement.textContent.trim()); } catch { /* sem permissão: o texto continua selecionável */ }
    btn.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>';
    btn.setAttribute('aria-label', btn.dataset.copied);
    setTimeout(() => { btn.innerHTML = '<svg class="icon"><use href="#i-copy"/></svg>'; btn.setAttribute('aria-label', text.copy); }, 1500);
  });
}

/**
 * Liga a página em volta da demo.
 * @param {typeof import('./content-pt.js').default.text} text
 * @param {ReturnType<typeof import('./demo.js').createDemo>} demo
 */
export function initPage(text, demo) {
  initDownload(text);
  initNav();
  initFeatures(demo);
  initCopy(text);
}
