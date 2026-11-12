import guideCore from './generated/guideview.core.js';
import {renderChildren,applyIcons} from './view-host.mjs';
import {icon} from '../icons.mjs';
import {t,text} from './ui-text.mjs';
import {createMascote} from './mascote.mjs';

/* Guia da Mesa (`#help-dialog`): o aplicador do núcleo `core/guideview.bend`.
   A ordem das seções e o "Próximo"/"Anterior" são do núcleo; aqui só se
   mostra uma seção por vez, se acha o que casa com a busca (texto do DOM, sem
   acento) e se leva o foco ao título da seção nova. O corpo das seções mora
   no HTML.

   Desde a #64 (docs/design/setup-guia-r1/Guia.dc.html) a busca não filtra a
   lateral: mostra numa lista só os tópicos que casam, de todas as seções, cada
   um com a seção de onde veio (o botão leva até ela). A lateral ganha ícones e,
   na etapa 3 (docs/design/carbon-r1/guia.html), o índice mono 01–07 antes de
   cada um; o ∇ pensando (`mascote.mjs`) aparece quando a busca não acha nada. */

const $ = (selector) => document.querySelector(selector);
const Nil = {$: 'Nil'};
const bendList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);

/* Sem acento e sem caixa: "calculo" acha "Cálculo". */
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const state = {section: 'comecar', query: '', bound: false, emptyMascote: null};

const root = () => $('#help-dialog');
const sections = () => [...root().querySelectorAll('section[data-section]')];
const visibleUnits = (section) => [...section.querySelectorAll('[data-search]')].filter((unit) => !unit.hidden);

/* O que casa com a busca, na ordem do guia. Seção cujo nome, título ou frase
   de abertura casa entra inteira; senão só as unidades que casam. */
function hitsOf(query) {
  const hits = [];
  for (const section of sections()) {
    const id = section.dataset.section;
    const own = fold([guideCore.guideLabel(id), guideCore.guideTitle(id), guideCore.guideLead(id)].map(text).join(' '));
    const units = visibleUnits(section);
    const matching = own.includes(query) ? units : units.filter((unit) => fold(unit.textContent).includes(query));
    for (const unit of matching) hits.push({id, unit});
  }
  return hits;
}

/* Cada achado vira uma linha da lista de leitura: título à esquerda (com a
   seção de onde veio), texto à direita. Cartão de passo e linha de atalho
   viram o mesmo formato. */
function titleAndBody(unit) {
  if (unit.matches('.guide-topic')) return [unit.querySelector('h4'), unit.querySelector('p')];
  if (unit.matches('.guide-card')) return [unit.querySelector('strong'), unit.lastElementChild];
  return [unit.querySelector('span[data-i18n]'), unit.querySelector('.guide-combo')];
}

function hitRow({id, unit}) {
  const [title, body] = titleAndBody(unit);
  const row = document.createElement('section');
  row.className = 'guide-topic guide-hit';
  const heading = document.createElement('h4');
  heading.textContent = title?.textContent.trim() || '';
  const from = document.createElement('button');
  from.type = 'button';
  from.className = 'guide-hit-section';
  from.dataset.section = id;
  from.textContent = text(guideCore.guideLabel(id));
  from.addEventListener('click', () => {
    state.query = '';
    $('#guide-search').value = '';
    go(id);
  });
  const copy = document.createElement('p');
  if (body) copy.append(...[...body.cloneNode(true).childNodes]);
  for (const el of copy.querySelectorAll('[id]')) el.removeAttribute('id');
  row.append(heading, from, copy);
  return row;
}

/* O número sai em `data-index` (o CSS o desenha) para não entrar no texto do
   botão, e a ordem é a dos itens que o núcleo já pôs na lateral. O r2 tirou o
   ícone: fica o número em mono e o nome (docs/design/carbon-r2/revisao.html,
   2026-11-11). */
function paintNavMarks() {
  [...root().querySelectorAll('.guide-nav-item')].forEach((item, index) => {
    item.dataset.index = String(index + 1).padStart(2, '0');
    item.querySelector('.guide-nav-icon')?.remove();
  });
}

/* O rodapé fixo do guia saiu no r2: o "Próximo" vira um link no fim da seção,
   depois de um fio, com o nome da próxima seção em STIX. O "Anterior" não
   volta. O botão do núcleo é reaproveitado inteiro (clique, teclado e
   `data-section`), só trocando a classe e o texto. */
function paintNextLink(all, current, searching) {
  for (const old of root().querySelectorAll('section[data-section] > .guide-next')) old.remove();
  if (searching) return;
  const holder = document.createElement('div');
  renderChildren(holder, guideCore.guideFoot(all, current), guideHandlers);
  const button = holder.querySelector('.guide-next');
  if (!button) return;
  const target = button.dataset.section || '';
  const name = text(guideCore.guideLabel(target));
  let prefix = button.textContent.replace(/[\s→←]+$/u, '').trim();
  if (name && prefix.endsWith(name)) prefix = prefix.slice(0, -name.length).trim();
  button.className = 'guide-next-link';
  const label = document.createElement('span');
  label.className = 'guide-next-name';
  label.textContent = name;
  button.replaceChildren(document.createTextNode(prefix ? `${prefix} ` : ''), label);
  const paragraph = document.createElement('p');
  paragraph.className = 'guide-next';
  paragraph.append(button);
  root().querySelector(`section[data-section="${current}"]`)?.append(paragraph);
}

function paintSection(current) {
  for (const section of sections()) section.hidden = section.dataset.section !== current;
  $('#guide-section-title').textContent = text(guideCore.guideTitle(current));
  $('#guide-lead').textContent = text(guideCore.guideLead(current));
  $('#guide-crumb').textContent = t('guide.crumb', {section: text(guideCore.guideLabel(current))});
}

function paintSearch(hits, query) {
  for (const section of sections()) section.hidden = true;
  $('#guide-section-title').textContent = t('guide.searchTitle', {query});
  $('#guide-lead').textContent = hits.length ? t('guide.hits', {count: hits.length}) : '';
  $('#guide-crumb').textContent = t('guide.crumbSearch');
  $('#guide-results').replaceChildren(...hits.map(hitRow));
}

export function paintGuide() {
  const dialog = root();
  if (!dialog) return;
  const query = fold(state.query);
  const all = guideCore.guideVisible(bendList(sections().map((section) => section.dataset.section)));
  const current = guideCore.guideCurrent(all, state.section);
  state.section = current;
  const hits = query ? hitsOf(query) : [];
  renderChildren($('#guide-nav'), guideCore.guideNavNodes(all, query ? '' : current), guideHandlers);
  paintNavMarks();
  renderChildren($('#guide-foot'), [], guideHandlers);
  if (query) paintSearch(hits, state.query.trim());
  else paintSection(current);
  paintNextLink(all, current, !!query);
  const none = !!query && hits.length === 0;
  if (none) mountEmptyMascote();
  $('#guide-results').hidden = !query || none;
  $('#guide-empty').hidden = !none;
  $('#guide-lead').hidden = !$('#guide-lead').textContent;
  dialog.dataset.guideSection = query ? 'busca' : current;
}

/* Vai para uma seção: o foco segue o título (leitor de tela e teclado
   continuam de onde a leitura começa) e a página volta ao topo. */
function go(id) {
  state.section = id;
  paintGuide();
  $('#guide-scroll').scrollTop = 0;
  $('#guide-section-title').focus({preventScroll: true});
}

const guideHandlers = {
  GuidePick: (event) => {
    const id = event.currentTarget?.dataset?.section;
    if (!id) return;
    if (state.query) {
      state.query = '';
      $('#guide-search').value = '';
    }
    go(id);
  },
};

/* O ∇ da busca vazia é decorativo: não acena nem cochila (#101 voltou ao
   personagem fixo de antes da #100). */
function mountEmptyMascote() {
  if (state.emptyMascote) return;
  state.emptyMascote = createMascote({personagem: 'nabla', humor: 'pensando', tamanho: 120, interativa: false});
  $('#guide-empty-mascote').replaceChildren(state.emptyMascote.el);
}

function bind() {
  if (state.bound) return;
  state.bound = true;
  if ($('#guide-empty-mascote')) mountEmptyMascote();
  applyIcons(root().querySelector('.guide-search'), icon);
  $('#guide-search').addEventListener('input', (event) => {
    state.query = event.target.value;
    paintGuide();
  });
  /* Enter na busca não envia o formulário do diálogo. */
  $('#guide-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });
}

/* A abertura limpa a busca e vai para a seção pedida (ou mantém a última).
   Seção desconhecida cai na primeira pelo `guideCurrent` do núcleo. */
export function openGuide(section = '') {
  if (!root()) return;
  bind();
  state.query = '';
  if (section) state.section = String(section);
  $('#guide-search').value = '';
  paintGuide();
}

/* Troca de idioma (#41): o corpo do guia é refeito pelo `data-i18n`; a lateral, o título e a busca são daqui. */
export function relabelGuide() {
  if (root()) paintGuide();
}

export function guideSection() {
  return state.section;
}
