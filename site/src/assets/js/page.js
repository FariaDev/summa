// O resto da página em volta da demo: aba do topo que segue a seção, recursos que
// dirigem a demo, as abas de Instalar e Conectar e o botão de baixar do sistema de quem visita.
import {$, $$, reduced} from './dom.js';
import {OS_NAMES, detectOs} from './os.js';
import {initHandoff} from './handoff.js';

const RELEASES_PAGE = 'https://github.com/FariaDev/summa/releases/latest';
// As notas da versão que o botão baixa, ao lado do número dela.
const RELEASE_TAG = 'https://github.com/FariaDev/summa/releases/tag/';

// Instalar e Conectar: a aba e o painel com o mesmo data-tab, dentro da seção.
// Tabindex itinerante: só a aba escolhida entra no Tab; as setas andam entre elas.
function selectTab(section, key) {
  for (const t of $$(`#${section} [role=tab]`)) {
    const on = t.dataset.tab === key;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  for (const p of $$(`#${section} [role=tabpanel]`)) p.hidden = p.dataset.tab !== key;
}
const selectOs = (os) => selectTab('instalar', os);

const TAB_STEP = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};

// Seta, Home e End trocam de aba e levam o foco junto (padrão de abas do WAI-ARIA).
function moveTab(section, e) {
  const tabs = $$(`#${section} [role=tab]`);
  const at = tabs.indexOf(e.target);
  if (at < 0) return;
  let next;
  if (e.key in TAB_STEP) next = (at + TAB_STEP[e.key] + tabs.length) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = tabs.length - 1;
  else return;
  e.preventDefault();
  selectTab(section, tabs[next].dataset.tab);
  tabs[next].focus();
}

// Liga cada aba ao seu painel por id, para o leitor de tela anunciar o par.
function initTabs(section) {
  for (const t of $$(`#${section} [role=tab]`)) {
    const panel = $(`#${section} [role=tabpanel][data-tab="${t.dataset.tab}"]`);
    t.id = `${section}-tab-${t.dataset.tab}`;
    panel.id = `${section}-panel-${t.dataset.tab}`;
    t.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', t.id);
    t.addEventListener('click', () => selectTab(section, t.dataset.tab));
  }
  $(`#${section} [role=tablist]`).addEventListener('keydown', (e) => moveTab(section, e));
  const current = $(`#${section} [role=tab][aria-selected=true]`) || $(`#${section} [role=tab]`);
  selectTab(section, current.dataset.tab);
}

// O botão do topo aponta para o instalador da última Release que tem um; o build
// grava a lista em #downloads. Sem instalador, vai para a página de Releases.
function initDownload(text) {
  const os = detectOs(navigator.userAgent, navigator.maxTouchPoints);
  if (os === 'mobile') { initHandoff(text); return; }
  let downloads = {};
  try { downloads = JSON.parse($('#downloads').textContent); } catch { /* fica o link da página de Releases */ }
  const item = downloads[os];
  const btn = $('#get-btn');
  btn.href = item?.url || RELEASES_PAGE;
  btn.dataset.os = os;
  $('.os-label').textContent = `${text.downloadFor} ${OS_NAMES[os]}`;
  const version = item ? `v${item.version}` : downloads.latest || '';
  const notes = version && `<a href="${RELEASE_TAG}${version}" class="whats-new">${text.whatsNew}</a>`;
  const others = Object.keys(OS_NAMES).filter((o) => o !== os).map((o) => `<a href="#instalar" data-os="${o}">${OS_NAMES[o]}</a>`);
  $('.get-meta').innerHTML = [version, notes, ...others].filter(Boolean).join(' · ');
  selectOs(os);
}

function initNav() {
  // Âncoras nativas (com scroll-padding no CSS); o data-os só escolhe a aba de Instalar.
  document.addEventListener('click', (e) => { const a = e.target.closest('a[data-os]'); if (a && a.getAttribute('href') === '#instalar') selectOs(a.dataset.os); });
  for (const section of ['instalar', 'conectar']) initTabs(section);
  // A aba do topo segue a seção à vista: a última cujo topo passou do primeiro terço da tela.
  // Uma faixa fixa no meio perdia seção curta (Instalar acaba antes dela) e a última, que nunca
  // sobe até lá; por isso, no fim da página, a ativa é a última.
  const links = $$('.tabs a');
  const ids = ['demo', 'recursos', 'perguntas', 'instalar', 'conectar'];
  const mark = () => {
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    const passed = ids.filter((id) => $('#' + id).getBoundingClientRect().top <= innerHeight / 3);
    const id = atEnd ? ids.at(-1) : passed.at(-1) || ids[0];
    for (const a of links) a.classList.toggle('active', a.getAttribute('href') === '#' + id);
  };
  // Sem ouvir cada evento de rolagem: a aba só muda quando uma seção cruza a linha do primeiro
  // terço (a faixa de cima do observador) ou quando o rodapé, o fim da página, aparece inteiro.
  const line = new IntersectionObserver(mark, {rootMargin: '0px 0px -66.667% 0px'});
  for (const id of ids) line.observe($('#' + id));
  new IntersectionObserver(mark, {threshold: .99}).observe($('footer'));
  mark();
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
