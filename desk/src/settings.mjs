import settingsCore from './generated/settingsview.core.js';
import {build, childrenOf, preserveFocus, renderChildren, renderInto} from './view-host.mjs';
import {LANGUAGE_EVENT} from './ui-text.mjs';
import {mountSettingsChrome} from './settings-chrome.mjs';
import {clearSettingsFilter, filterSettingsSection, matchingSettingsSections} from './settings-search.mjs';

/* Aplicador das Configurações com seções na lateral (ticket #20). O núcleo é
   `core/settingsview.bend`: quais são as seções, a árvore da navegação, a
   validação das matérias e o aviso de erro. Aqui só se cola no DOM: mostrar a
   seção certa, entregar as linhas lidas como fatos, pôr o aviso ao lado do
   campo e levar o foco até ele. Ler/gravar o `config.json` continua no main. */

const $ = (selector) => document.querySelector(selector);
const bendList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

let current = settingsCore.firstSection();
/* Fatos do rodapé (#42): o tutor está respondendo e há mudança pendente. O
   texto e a trava do Salvar são do núcleo (`footerHintFor`/`saveBlocked`). */
let footer = {busy: false, dirty: false};

const HANDLERS = {
  SelectSection: (event) => showSection(event.currentTarget?.dataset?.sec, {focus: true}),
};

function renderNav(focus) {
  const tabs = $('#settings-tabs');
  if (!tabs) return;
  preserveFocus(tabs, () => renderChildren(tabs, settingsCore.navChildren(current), HANDLERS));
  if (focus) tabs.querySelector('[aria-current="page"]')?.focus();
}

/* Mostra uma seção e esconde as outras. Seção desconhecida cai em Matérias
   (decisão do núcleo). Trocar de seção nunca salva nem descarta nada: os campos
   das seções escondidas continuam no DOM com o que foi digitado. */
export function showSection(id, {focus = false} = {}) {
  current = settingsCore.activeSection(String(id ?? ''));
  const body = $('#settings-body');
  if (body) {
    for (const pane of body.querySelectorAll(':scope > [data-sec]')) {
      pane.hidden = pane.dataset.sec !== current;
    }
    body.scrollTop = 0;
  }
  renderNav(focus);
  paintFooter();
  paintSearch();
  return current;
}

/* ---------- busca ---------- */

/* A busca da lateral filtra as linhas da seção aberta; se o termo só casa
   noutra seção, a Mesa troca para a primeira que tem resultado. A pintura é
   feita de novo a cada `showSection` porque a lateral é re-renderizada pelo
   núcleo, e com ela os botões escondidos. */
function paintSearch() {
  const body = $('#settings-body');
  const input = $('#settings-search');
  if (!body || !input) return;
  const query = input.value.trim();
  const buttons = [...document.querySelectorAll('#settings-tabs [data-sec]')];
  const empty = $('#settings-search-empty');
  if (!query) {
    for (const section of body.querySelectorAll(':scope > [data-sec]')) {
      clearSettingsFilter(section);
      section.hidden = section.dataset.sec !== current;
    }
    for (const button of buttons) button.hidden = false;
    if (empty) empty.hidden = true;
    return;
  }
  const matches = new Set(matchingSettingsSections(body, query));
  for (const button of buttons) button.hidden = !matches.has(button.dataset.sec);
  if (empty) empty.hidden = matches.size > 0;
  if (!matches.size) {
    for (const section of body.querySelectorAll(':scope > [data-sec]')) section.hidden = true;
    return;
  }
  if (!matches.has(current)) {
    showSection([...matches][0]);
    return;
  }
  for (const section of body.querySelectorAll(':scope > [data-sec]')) {
    if (section.dataset.sec === current) filterSettingsSection(section, query);
    else clearSettingsFilter(section);
  }
}

function resetSearch() {
  const input = $('#settings-search');
  if (input) input.value = '';
  paintSearch();
}

function paintFooter() {
  const hint = $('#settings-hint');
  if (hint) renderInto(hint, settingsCore.footerHintForNode(current, footer.busy, footer.dirty));
  const blocked = settingsCore.saveBlocked(footer.busy, footer.dirty);
  hint?.classList.toggle('waiting', blocked);
  const save = $('#settings-save');
  if (save) save.disabled = blocked;
}

/* O host avisa quando o tutor começa/termina a resposta e quando a pessoa
   mexe num campo; o rodapé e o Salvar acompanham na hora. */
export function setSettingsFooter({busy = footer.busy, dirty = footer.dirty} = {}) {
  footer = {busy: !!busy, dirty: !!dirty};
  paintFooter();
}

export function saveBlockedNow() {
  return settingsCore.saveBlocked(footer.busy, footer.dirty);
}

/* Erro de salvar (o main recusou) aparece DENTRO do diálogo, ao lado do Salvar
   — nunca num aviso que ficaria atrás do modal. */
export function showSaveError(message) {
  const box = $('#settings-error');
  if (!box) return;
  box.textContent = String(message || '');
  box.hidden = !message;
  const hint = $('#settings-hint');
  if (hint) hint.hidden = !!message;
}

/* Abertura do diálogo: sempre em Matérias (ou na seção pedida) e sem avisos
   de uma tentativa anterior. */
export function prepareSettings({section = ''} = {}) {
  clearErrors();
  showSaveError('');
  resetSearch();
  showSection(section || settingsCore.firstSection());
}

/* ---------- validação das matérias ---------- */

function courseRows() {
  return [...document.querySelectorAll('#cfg-courses .cfg-course')];
}

function rowFacts(rows) {
  return bendList(rows.map((row) => ({
    $: 'SettingsRow',
    id: String(row.dataset.id ?? ''),
    name: row.querySelector('.cfg-name')?.value ?? '',
    path: row.querySelector('.cfg-path')?.value ?? '',
  })));
}

/* Tira o aviso de uma linha (o parágrafo logo abaixo e as marcas do campo). */
function clearRowError(row) {
  const note = row.nextElementSibling;
  if (note?.classList.contains('cfg-error')) note.remove();
  row.classList.remove('has-error');
  for (const field of row.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  }
}

export function clearErrors() {
  for (const row of courseRows()) clearRowError(row);
  for (const note of document.querySelectorAll('#cfg-courses .cfg-error')) note.remove();
}

/* `true` = pode salvar. Com erro: o aviso aparece ao lado do campo, a seção do
   primeiro erro abre e o foco vai para o campo. */
export function validateSettings() {
  clearErrors();
  resetSearch();
  const rows = courseRows();
  const facts = rowFacts(rows);
  const list = settingsCore.settingsIssues(facts);
  const issues = childrenOf(list);
  if (!issues.length) return true;
  let first = null;
  for (const issue of issues) {
    const row = rows[Number(issue.row)];
    if (!row) continue;
    const field = row.querySelector(issue.field === 'name' ? '.cfg-name' : '.cfg-path');
    const id = `course-${Number(issue.row)}`;
    row.classList.add('has-error');
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', settingsCore.errorId(id));
      first ||= field;
    }
    row.after(build(settingsCore.errorNode(id, String(issue.message))));
  }
  showSection(settingsCore.issueSection(list));
  first?.focus();
  return false;
}

/* ---------- ligação ---------- */

export function initSettings() {
  mountSettingsChrome(document);
  $('#settings-search')?.addEventListener('input', paintSearch);
  /* Enter na busca não é Salvar: o form fecharia como cancelar (ou o main
     salvaria o campo), então a tecla para aqui. */
  $('#settings-search')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
  });
  /* Densidade e avisos redesenham as próprias linhas ao mudar; re-vestir
     mantém o interruptor e a descrição no formato do r2 depois do render.
     O `wrapSelects` do re-vestir move o select focado para dentro da casca e
     o blur perdia o foco (hunt-shell); o `preserveFocus` devolve pelo id. */
  $('#settings-form')?.addEventListener('change', () => {
    preserveFocus($('#settings-form'), () => mountSettingsChrome(document));
    paintSearch();
  });
  /* A Densidade redesenha o próprio `label` quando o diálogo abre; vestir de
     novo aqui garante que a linha e o seletor continuem no formato do r2. */
  $('#settings-dialog')?.addEventListener('toggle', (event) => {
    if (/** @type {HTMLDialogElement} */ (event.target).open) mountSettingsChrome(document);
  });
  const tabs = $('#settings-tabs');
  tabs?.addEventListener('keydown', (event) => {
    const target = {
      ArrowDown: settingsCore.nextSection(current),
      ArrowRight: settingsCore.nextSection(current),
      ArrowUp: settingsCore.prevSection(current),
      ArrowLeft: settingsCore.prevSection(current),
      Home: settingsCore.firstSection(),
      End: settingsCore.prevSection(settingsCore.firstSection()),
    }[event.key];
    if (!target) return;
    event.preventDefault();
    showSection(target, {focus: true});
  });
  const courses = $('#cfg-courses');
  /* Corrigir o campo tira o aviso; remover/escolher pasta numa linha também
     (o clique em botão, não o clique para posicionar o cursor). */
  courses?.addEventListener('input', (event) => {
    const row = event.target?.closest?.('.cfg-course');
    if (row) clearRowError(row);
  });
  courses?.addEventListener('click', (event) => {
    if (event.target?.closest?.('button')) clearErrors();
  });
  $('#settings-dialog')?.addEventListener('close', clearErrors);
  // A navegação e o rodapé são árvores do núcleo: trocar o idioma as refaz na hora (#41).
  window.addEventListener(LANGUAGE_EVENT, () => { renderNav(false); paintFooter(); paintSearch(); });
}
