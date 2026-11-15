// @ts-check
/* O seletor de material do leitor (#74), a parte pura: a raiz da pasta da
   matéria no topo, cada subpasta como um nó dentro da pasta mãe (título = último
   pedaço do caminho), busca pelo nome do arquivo e o estado aberto/fechado de
   cada grupo. A organização é a do disco: nada de cadastro de capítulo dentro
   da Summa. Agrupar, ordenar e filtrar é interface sem consequência de domínio,
   então fica em JS com teste (ADR 0003). Nada aqui toca o DOM, o idioma ou o
   estado de interface. */

import {foldSearch, stepActive} from './model-picker.mjs';

/** @typedef {{name: string, path: string, folder?: string}} MaterialEntry */
/** @typedef {{kind: 'group', folder: string, label: string, open: boolean, count: number, depth: number} | {kind: 'file', entry: MaterialEntry, folder: string, depth: number}} MaterialRow */
/**
 * @typedef {object} FolderNode
 * @property {string} folder
 * @property {string} label
 * @property {MaterialEntry[]} files
 * @property {FolderNode[]} children
 * @property {number} count
 */

/* Ordem natural de nome, em pt-BR: "Cap 3" antes de "Cap 10" e acento sem
   peso. É a mesma régua da busca do seletor de modelo (#59). */
const NAME_ORDER = new Intl.Collator('pt-BR', {sensitivity: 'base', numeric: true});
/* Teto só contra estado editado à mão: ninguém fecha 500 pastas de verdade. */
export const FOLDER_LIMIT = 500;

/**
 * O caminho relativo de uma subpasta, com `/` nos dois sistemas e sem barras
 * sobrando. Vazio é a raiz da pasta da matéria.
 * `normalizeFolder('\\Listas\\2024\\')` → `'Listas/2024'`
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeFolder(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
}

/**
 * O estado aberto/fechado lido do `desk.json`: só pares pasta → booleano.
 * `__proto__`, chave vazia e valor de outro tipo caem; o resto vale até o teto.
 * `normalizeMaterialFolders({'Listas': false, '': true, x: 'não'})` → `{'Listas': false}`
 * @param {unknown} raw
 * @returns {Record<string, boolean>}
 */
export function normalizeMaterialFolders(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw).slice(0, FOLDER_LIMIT)) {
    const folder = normalizeFolder(key);
    if (!folder || folder === '__proto__' || typeof value !== 'boolean') continue;
    out[folder] = value;
  }
  return out;
}

/**
 * O grupo está aberto? Ausente vale aberto: o seletor abre como o `<select>`
 * nativo (tudo à vista) e a pessoa fecha o que não quer ver; o fechamento é o
 * que fica guardado.
 * `folderOpen({}, 'Listas')` → `true`; `folderOpen({'Listas': false}, 'Listas')` → `false`
 * @param {Record<string, boolean>} folders
 * @param {string} folder
 * @returns {boolean}
 */
export function folderOpen(folders, folder) {
  return folders[folder] !== false;
}

/**
 * O nome do arquivo casa com a busca, sem caixa nem acento.
 * `matchesMaterialQuery('Aula 3 — Derivadas.pdf', 'derivadas')` → `true`
 * @param {string} name
 * @param {string} query
 * @returns {boolean}
 */
export function matchesMaterialQuery(name, query) {
  const needle = foldSearch(query);
  return !needle || foldSearch(name).includes(needle);
}

const byName = (left, right) => NAME_ORDER.compare(left.name, right.name);
const parentFolder = (folder) => folder.split('/').slice(0, -1).join('/');

/**
 * A árvore de pastas da biblioteca, com os arquivos de cada pasta e as
 * subpastas. Pasta intermediária que só tem descendentes também nasce (senão
 * `Semestre 1/Cap 3/x.pdf` perderia o nó "Semestre 1"); a busca já filtrou os
 * arquivos, então pasta sem achado em descendente nem aparece (#74).
 * @param {MaterialEntry[]} entries
 * @returns {FolderNode[]} as pastas de nível 0, já ordenadas
 */
function folderTree(entries) {
  /** @type {Map<string, FolderNode>} */
  const nodes = new Map();
  for (const entry of entries) {
    const parts = entry.folder.split('/');
    for (let end = 1; end <= parts.length; end += 1) {
      const folder = parts.slice(0, end).join('/');
      if (!nodes.has(folder)) nodes.set(folder, {folder, label: parts[end - 1], files: [], children: [], count: 0});
    }
    const node = /** @type {FolderNode} */ (nodes.get(entry.folder));
    node.files.push(entry);
  }
  /** @type {FolderNode[]} */
  const roots = [];
  for (const node of nodes.values()) {
    node.files.sort(byName);
    const parent = nodes.get(parentFolder(node.folder));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  for (const node of nodes.values()) node.children.sort((left, right) => NAME_ORDER.compare(left.label, right.label));
  for (const root of roots) countFolder(root);
  roots.sort((left, right) => NAME_ORDER.compare(left.label, right.label));
  return roots;
}

/**
 * A contagem do grupo é o total de arquivos visíveis nele e nas subpastas.
 * @param {FolderNode} node
 * @returns {number}
 */
function countFolder(node) {
  node.count = node.files.length + node.children.reduce((sum, child) => sum + countFolder(child), 0);
  return node.count;
}

/**
 * Uma pasta e tudo abaixo dela, na ordem de leitura: subpastas antes dos
 * arquivos da própria pasta, todas em ordem natural. Grupo fechado esconde o
 * que está abaixo; a busca força aberto para o achado aparecer.
 * @param {FolderNode} node
 * @param {number} depth
 * @param {MaterialRow[]} rows
 * @param {{folders: Record<string, boolean>, searching: boolean}} state
 */
function emitFolder(node, depth, rows, state) {
  const open = state.searching || folderOpen(state.folders, node.folder);
  rows.push({kind: 'group', folder: node.folder, label: node.label, open, count: node.count, depth});
  if (!open) return;
  for (const child of node.children) emitFolder(child, depth + 1, rows, state);
  for (const entry of node.files) rows.push({kind: 'file', entry, folder: node.folder, depth: depth + 1});
}

/**
 * As linhas do seletor na ordem de leitura: arquivos da raiz no topo, depois
 * cada subpasta como nó dentro da pasta mãe, com as subpastas antes dos
 * arquivos da pasta (todos em ordem natural). A busca filtra pelo NOME do
 * arquivo e força abertos os ancestrais do achado; pasta sem achado em
 * descendente não entra.
 * @param {MaterialEntry[]} library
 * @param {{folders?: Record<string, boolean>, query?: string}} [options]
 * @returns {MaterialRow[]}
 */
export function materialRows(library, {folders = {}, query = ''} = {}) {
  const searching = String(query ?? '').trim().length > 0;
  /** @type {MaterialEntry[]} */
  const root = [];
  /** @type {MaterialEntry[]} */
  const nested = [];
  for (const raw of Array.isArray(library) ? library : []) {
    if (!raw || typeof raw.path !== 'string' || !raw.path) continue;
    const entry = {
      name: String(raw.name || raw.path.split(/[/\\]/).at(-1) || ''),
      path: raw.path,
      folder: normalizeFolder(raw.folder),
    };
    if (!matchesMaterialQuery(entry.name, query)) continue;
    (entry.folder ? nested : root).push(entry);
  }
  root.sort(byName);
  /** @type {MaterialRow[]} */
  const rows = root.map((entry) => ({kind: 'file', entry, folder: '', depth: 0}));
  for (const node of folderTree(nested)) emitFolder(node, 0, rows, {folders, searching});
  return rows;
}

/**
 * A linha ativa ao abrir: o material em uso quando ele está à vista; senão a
 * primeira linha. `-1` para uma lista vazia.
 * @param {MaterialRow[]} rows
 * @param {string} path
 * @returns {number}
 */
export function materialActive(rows, path) {
  const at = rows.findIndex((row) => row.kind === 'file' && row.entry.path === path);
  if (at >= 0) return at;
  return rows.length ? 0 : -1;
}

/* Reexportado para o DOM andar o índice sem repetir a conta do seletor de
   modelo (#59): é a mesma lista com volta nas pontas. */
export {stepActive};
