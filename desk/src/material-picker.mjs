// @ts-check
/* O seletor de material do leitor (#74), a parte pura: a raiz da pasta da
   matéria no topo, um grupo por subpasta (título = caminho relativo), busca
   pelo nome do arquivo e o estado aberto/fechado de cada grupo. A organização é
   a do disco: nada de cadastro de capítulo dentro da Summa. Agrupar, ordenar e
   filtrar é interface sem consequência de domínio, então fica em JS com teste
   (ADR 0003). Nada aqui toca o DOM, o idioma ou o estado de interface. */

import {foldSearch, stepActive} from './model-picker.mjs';

/** @typedef {{name: string, path: string, folder?: string}} MaterialEntry */
/** @typedef {{kind: 'group', folder: string, label: string, open: boolean, count: number} | {kind: 'file', entry: MaterialEntry, folder: string}} MaterialRow */

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

/**
 * As linhas do seletor na ordem de leitura: arquivos da raiz, depois os grupos
 * de subpasta em ordem natural, cada um com seus arquivos (também naturais).
 * A busca filtra pelo NOME do arquivo e força os grupos abertos, para o achado
 * aparecer com a pasta de origem; grupo sem achado não entra.
 * @param {MaterialEntry[]} library
 * @param {{folders?: Record<string, boolean>, query?: string}} [options]
 * @returns {MaterialRow[]}
 */
export function materialRows(library, {folders = {}, query = ''} = {}) {
  const searching = String(query ?? '').trim().length > 0;
  const root = [];
  /** @type {Map<string, MaterialEntry[]>} */
  const groups = new Map();
  for (const raw of Array.isArray(library) ? library : []) {
    if (!raw || typeof raw.path !== 'string' || !raw.path) continue;
    const entry = {
      name: String(raw.name || raw.path.split(/[/\\]/).at(-1) || ''),
      path: raw.path,
      folder: normalizeFolder(raw.folder),
    };
    if (!matchesMaterialQuery(entry.name, query)) continue;
    if (!entry.folder) {
      root.push(entry);
      continue;
    }
    const items = groups.get(entry.folder) || [];
    items.push(entry);
    groups.set(entry.folder, items);
  }
  root.sort((left, right) => NAME_ORDER.compare(left.name, right.name));
  const foldersNamed = [...groups.keys()].sort((left, right) => NAME_ORDER.compare(left, right));
  /** @type {MaterialRow[]} */
  const rows = root.map((entry) => ({kind: 'file', entry, folder: ''}));
  for (const folder of foldersNamed) {
    const items = /** @type {MaterialEntry[]} */ (groups.get(folder));
    items.sort((left, right) => NAME_ORDER.compare(left.name, right.name));
    const open = searching || folderOpen(folders, folder);
    rows.push({kind: 'group', folder, label: folder, open, count: items.length});
    if (!open) continue;
    for (const entry of items) rows.push({kind: 'file', entry, folder});
  }
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
