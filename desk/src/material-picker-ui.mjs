// @ts-check
import {icon} from '../icons.mjs';
import {t} from './ui-text.mjs';
import {materialRows, materialActive, normalizeMaterialFolders, folderOpen, stepActive} from './material-picker.mjs';

/* O seletor de material do leitor (#74), a parte que toca o DOM. O
   `<select class="pdf-select">` continua sendo o valor, o nome acessível e o
   contrato dos testes existentes; o clique/teclado nele abre este popover —
   busca (`role=combobox`, o foco fica nela) e lista (`role=listbox`) com os
   PDFs da raiz no topo e um grupo por subpasta, no jeito do seletor de modelo
   (#59): ↑↓ com volta, ⏎ escolhe, Esc fecha e devolve o foco ao seletor. Nos
   grupos, ⏎ no título abre e fecha; a busca abre todos os grupos para o achado
   aparecer com a pasta de origem. O estado aberto/fechado mora no `desk.json`
   (estado de interface, por matéria, fora do `config.json`).

   A organização (raiz no topo, ordem natural, filtro) é a função pura de
   `material-picker.mjs`; aqui só entram DOM, teclado e a leitura do idioma. */

/** @typedef {import('./material-picker.mjs').MaterialEntry} MaterialEntry */
/** @typedef {import('./material-picker.mjs').MaterialRow} MaterialRow */
/** @typedef {MaterialRow | {kind: 'action'}} PickerRow */

/** @type {Record<string, boolean>} */
let folders = {};
/** @type {Set<{close: (restoreFocus?: boolean) => void, isOpen: () => boolean}>} */
const openPickers = new Set();
let seq = 0;

/** Estado aberto/fechado lido do `initialData` (por matéria). @param {unknown} raw */
export function loadMaterialFolders(raw) {
  folders = normalizeMaterialFolders(raw);
}

/** O estado aberto/fechado para o `save-state`. */
export function materialFoldersSnapshot() {
  return {...folders};
}

/**
 * Monta o popover de um leitor. `library` devolve a biblioteca viva
 * (`S.library`), `onPick` abre o caminho escolhido e `onFoldersChanged` avisa
 * que o estado aberto/fechado mudou (o `save()` do renderer).
 * @param {{select: HTMLSelectElement | null, label: string, library: () => MaterialEntry[],
 *   onPick: (path: string) => void, onOpenFile: () => void, onFoldersChanged: () => void}} wiring
 * @returns {{refresh: () => void, open: () => void, close: (restoreFocus?: boolean) => void,
 *   closeOutside: (target: EventTarget | null) => void, isOpen: () => boolean} | null}
 * @example const picker = createMaterialPicker({select: panel.querySelector('.pdf-select'), label: 'Enunciado', library: () => S.library, onPick, onOpenFile, onFoldersChanged: save});
 */
export function createMaterialPicker({select, label, library, onPick, onOpenFile, onFoldersChanged}) {
  const panel = select?.closest('.pdf-panel');
  if (!select || !panel) return null;
  const id = ++seq;
  const listId = `material-list-${id}`;

  const box = document.createElement('div');
  box.className = 'material-pop';
  box.hidden = true;
  box.setAttribute('role', 'dialog');

  const searchBox = document.createElement('div');
  searchBox.className = 'material-search';
  const lens = document.createElement('span');
  lens.className = 'material-search-icon';
  lens.setAttribute('aria-hidden', 'true');
  lens.innerHTML = icon('search');
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'material-search-input';
  search.setAttribute('role', 'combobox');
  search.setAttribute('aria-autocomplete', 'list');
  search.setAttribute('aria-expanded', 'true');
  search.setAttribute('aria-controls', listId);
  search.setAttribute('autocomplete', 'off');
  search.setAttribute('spellcheck', 'false');
  searchBox.append(lens, search);

  const empty = document.createElement('p');
  empty.className = 'material-empty';
  empty.setAttribute('role', 'status');
  empty.hidden = true;

  const list = document.createElement('div');
  list.className = 'material-list';
  list.id = listId;
  list.setAttribute('role', 'listbox');

  box.append(searchBox, empty, list);
  panel.append(box);

  /** @type {{rows: PickerRow[], active: number, query: string}} */
  const state = {rows: [], active: -1, query: ''};

  const picker = {
    refresh,
    open,
    close,
    closeOutside,
    isOpen: () => !box.hidden,
  };
  function labels() {
    const name = t('pdf.material.aria', {label});
    box.setAttribute('aria-label', name);
    search.placeholder = t('pdf.material.search');
    search.setAttribute('aria-label', t('pdf.material.searchAria'));
    list.setAttribute('aria-label', t('pdf.material.listAria', {label}));
  }

  function currentPath() {
    return select.value && select.value !== '__open__' ? select.value : '';
  }

  /** @param {{resetActive: boolean}} how */
  function paint({resetActive}) {
    labels();
    const query = state.query.trim();
    const rows = materialRows(library(), {folders, query});
    const action = typeof onOpenFile === 'function' ? /** @type {PickerRow[]} */ ([{kind: 'action'}]) : [];
    state.rows = [...rows, ...action];
    const fragment = document.createDocumentFragment();
    /** @type {Map<string, HTMLElement>} */
    const groups = new Map();
    let index = 0;
    for (const row of rows) {
      if (row.kind === 'file') {
        const node = fileRow(row, index, query);
        const group = row.folder ? groups.get(row.folder) : null;
        (group || fragment).append(node);
      } else {
        const group = groupNode(row, index);
        groups.set(row.folder, group);
        fragment.append(group);
      }
      index += 1;
    }
    if (action.length) fragment.append(actionRow(index));
    list.replaceChildren(fragment);
    const noMatch = query.length > 0 && !rows.some((row) => row.kind === 'file');
    empty.hidden = !noMatch;
    empty.textContent = noMatch ? t('pdf.material.noMatch', {query}) : '';
    const keep = resetActive ? materialActive(rows, currentPath()) : Math.min(state.active, state.rows.length - 1);
    setActive(keep, {scroll: false});
  }

  /**
   * @param {MaterialRow & {kind: 'file'}} row
   * @param {number} index
   * @param {string} query
   * @returns {HTMLElement}
   */
  function fileRow(row, index, query) {
    const node = document.createElement('div');
    node.className = 'material-row';
    node.id = `${listId}-o${index}`;
    node.setAttribute('role', 'option');
    node.dataset.row = String(index);
    node.dataset.path = row.entry.path;
    node.setAttribute('aria-selected', String(row.entry.path === currentPath()));
    node.title = row.entry.name;
    const name = document.createElement('span');
    name.className = 'material-row-name';
    name.textContent = row.entry.name;
    node.append(name);
    if (query && row.folder) {
      const folder = document.createElement('span');
      folder.className = 'material-row-folder';
      folder.textContent = row.folder;
      node.append(folder);
    }
    const check = document.createElement('span');
    check.className = 'material-row-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = icon('check');
    node.append(check);
    return node;
  }

  /**
   * @param {MaterialRow & {kind: 'group'}} row
   * @param {number} index
   * @returns {HTMLElement}
   */
  function groupNode(row, index) {
    const group = document.createElement('div');
    group.className = 'material-group';
    group.id = `${listId}-g${index}`;
    group.setAttribute('role', 'group');
    const head = document.createElement('div');
    head.className = 'material-group-head';
    head.id = `${listId}-t${index}`;
    head.setAttribute('role', 'option');
    head.setAttribute('aria-selected', 'false');
    head.setAttribute('aria-expanded', String(row.open));
    head.dataset.row = String(index);
    head.dataset.folder = row.folder;
    const chevron = document.createElement('span');
    chevron.className = 'material-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = icon(row.open ? 'chevronDown' : 'chevronRight');
    const title = document.createElement('span');
    title.className = 'material-group-title';
    title.textContent = row.label;
    const count = document.createElement('span');
    count.className = 'material-group-count';
    count.textContent = String(row.count);
    head.append(chevron, title, count);
    group.setAttribute('aria-labelledby', head.id);
    group.append(head);
    return group;
  }

  /** @param {number} index @returns {HTMLElement} */
  function actionRow(index) {
    const node = document.createElement('div');
    node.className = 'material-row material-open';
    node.id = `${listId}-o${index}`;
    node.setAttribute('role', 'option');
    node.dataset.row = String(index);
    node.dataset.action = 'open';
    node.setAttribute('aria-selected', 'false');
    const name = document.createElement('span');
    name.className = 'material-row-name';
    name.textContent = t('pdf.view.open');
    node.append(name);
    return node;
  }

  /** @param {number} at @param {{scroll: boolean}} how */
  function setActive(at, {scroll}) {
    state.active = at;
    for (const node of list.querySelectorAll('[data-row]')) {
      node.classList.toggle('active', Number(/** @type {HTMLElement} */ (node).dataset.row) === at);
    }
    const active = list.querySelector(`[data-row="${at}"]`);
    if (active) search.setAttribute('aria-activedescendant', active.id);
    else search.removeAttribute('aria-activedescendant');
    if (active && scroll) active.scrollIntoView({block: 'nearest'});
  }

  /** @param {number} at */
  function choose(at) {
    const row = state.rows[at];
    if (!row) return;
    if (row.kind === 'group') {
      toggle(row.folder);
      return;
    }
    close(true);
    if (row.kind === 'file') onPick(row.entry.path);
    else if (row.kind === 'action') onOpenFile();
  }

  /** @param {string} folder */
  function toggle(folder) {
    folders = {...folders, [folder]: !folderOpen(folders, folder)};
    paint({resetActive: false});
    onFoldersChanged();
  }

  function open() {
    if (!box.hidden) return;
    for (const other of openPickers) if (other !== picker) other.close(false);
    state.query = '';
    search.value = '';
    paint({resetActive: true});
    box.hidden = false;
    openPickers.add(picker);
    setActive(state.active, {scroll: true});
    search.focus();
  }

  /** @param {boolean} [restoreFocus] */
  function close(restoreFocus = true) {
    if (box.hidden) return;
    box.hidden = true;
    openPickers.delete(picker);
    if (restoreFocus && document.activeElement && box.contains(document.activeElement)) select.focus();
  }

  /** @param {EventTarget | null} target */
  function closeOutside(target) {
    if (box.hidden) return;
    if (target === select || (target instanceof Node && box.contains(target))) return;
    close(false);
  }

  function refresh() {
    if (!box.hidden) paint({resetActive: false});
  }

  /** @param {KeyboardEvent} event */
  function onKeydown(event) {
    const {key} = event;
    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      setActive(stepActive(state.rows.length, state.active, key === 'ArrowDown' ? 1 : -1), {scroll: true});
      return;
    }
    if (key === 'Home' || key === 'End') {
      event.preventDefault();
      setActive(key === 'Home' ? 0 : state.rows.length - 1, {scroll: true});
      return;
    }
    if (key !== 'Enter') return;
    event.preventDefault();
    choose(state.active);
  }

  /** @param {MouseEvent} event */
  function onListClick(event) {
    const node = event.target instanceof Element ? event.target.closest('[data-row]') : null;
    if (!node) return;
    /* O clique que fecha/abre um grupo repinta a lista: o alvo original sai do
       DOM antes de o clique chegar ao documento, e o fechar-por-fora o leria
       como clique de fora. A escolha é da lista; o clique morre aqui. */
    event.stopPropagation();
    choose(Number(/** @type {HTMLElement} */ (node).dataset.row));
  }

  /** @param {Event} event */
  function onSelectActivate(event) {
    if (event instanceof KeyboardEvent) {
      if (event.key === 'Escape') {
        if (box.hidden) return;
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== ' ') return;
    }
    event.preventDefault();
    if (box.hidden) open();
    else close(true);
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    paint({resetActive: true});
  });
  search.addEventListener('keydown', onKeydown);
  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', onListClick);
  select.addEventListener('pointerdown', onSelectActivate);
  select.addEventListener('mousedown', (event) => event.preventDefault());
  select.addEventListener('keydown', onSelectActivate);

  paint({resetActive: true});
  return picker;
}
