// @ts-check
import {t} from './ui-text.mjs';
import {icon} from '../icons.mjs';

/* O desenho único do caderno anexado: o cartão da bandeja (miniatura ou ícone,
   nome, "pág. N" e ×) e o chip menor da bolha. A bandeja do chat lateral
   (`sidechat-attach.mjs`) e a do tutor principal (`tutor-notebooks.mjs`) usam o
   mesmo cartão; as duas bolhas usam o mesmo chip. O caminho do arquivo nunca
   entra no nó — só nome e página. */

/**
 * O cartão `.attachment` da bandeja: a miniatura da página (ou o ícone do
 * caderno), o nome, "pág. N" e o × que chama `onRemove`.
 * @param {{nome: string, pagina: number, thumb?: string}} item
 * @param {{onRemove?: (() => void) | null, key?: string, doc?: Document}} [options]
 * @returns {HTMLElement}
 * @example notebookCardNode({nome: 'Limites', pagina: 2}, {onRemove: () => {}})
 */
export function notebookCardNode(item, {onRemove = null, key = '', doc = document} = {}) {
  const page = t('sidechat.tray.page', {page: item.pagina});
  const thumb = doc.createElement(item.thumb ? 'img' : 'span');
  thumb.className = 'notebook-thumb';
  if (item.thumb) {
    thumb.setAttribute('src', item.thumb);
    thumb.setAttribute('alt', '');
  } else {
    thumb.setAttribute('aria-hidden', 'true');
    thumb.innerHTML = icon('book');
  }
  const name = doc.createElement('span');
  name.className = 'notebook-name';
  name.textContent = item.nome;
  const where = doc.createElement('span');
  where.className = 'notebook-page';
  where.textContent = page;
  const text = doc.createElement('span');
  text.className = 'notebook-text';
  text.append(name, where);
  const file = doc.createElement('div');
  file.className = 'file notebook-card';
  file.title = `${item.nome} · ${page}`;
  file.append(thumb, text);
  const remove = doc.createElement('button');
  remove.type = 'button';
  remove.className = 'attachment-remove';
  remove.setAttribute('aria-label', t('attach.remove', {name: item.nome}));
  remove.textContent = '×';
  remove.addEventListener('click', () => onRemove?.());
  const card = doc.createElement('div');
  card.className = 'attachment';
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${item.nome}, ${page}`);
  if (key) card.dataset.key = key;
  card.append(file, remove);
  return card;
}

/**
 * O chip pequeno da bolha enviada: o ícone do caderno, o nome e "pág. N" no
 * estilo dos chips de anexo, sem o caminho do arquivo.
 * @param {{nome: string, pagina: number}} item
 * @param {{doc?: Document}} [options]
 * @returns {HTMLElement}
 * @example notebookChipNode({nome: 'Limites', pagina: 2})
 */
export function notebookChipNode(item, {doc = document} = {}) {
  const page = t('sidechat.tray.page', {page: item.pagina});
  const chip = doc.createElement('div');
  chip.className = 'attachment message-file notebook-chip';
  const file = doc.createElement('div');
  file.className = 'file notebook-chip-file';
  file.title = `${item.nome} · ${page}`;
  const book = doc.createElement('span');
  book.className = 'notebook-icon';
  book.setAttribute('aria-hidden', 'true');
  book.innerHTML = icon('book');
  const name = doc.createElement('span');
  name.className = 'notebook-name';
  name.textContent = item.nome;
  const where = doc.createElement('span');
  where.className = 'notebook-page';
  where.textContent = page;
  const text = doc.createElement('span');
  text.className = 'notebook-text';
  text.append(name, where);
  file.append(book, text);
  chip.append(file);
  return chip;
}
