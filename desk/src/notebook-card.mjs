// @ts-check
import {t} from './ui-text.mjs';
import {icon} from '../icons.mjs';

/* O desenho único do caderno anexado: o cartão da bandeja (a imagem da página
   ou o ícone do caderno, a etiqueta "pág. N" e ×) e o chip menor que fica como
   reserva das mensagens antigas, que têm o bloco escondido mas não a imagem. A
   bandeja do chat lateral (`sidechat-attach.mjs`) e a do tutor principal
   (`tutor-notebooks.mjs`) usam o mesmo cartão; as duas bolhas usam o mesmo
   rótulo. O caminho do arquivo nunca entra no nó — só nome e página. */

/**
 * O rótulo que a pessoa vê (dica, nome acessível e a tela da página):
 * "<caderno> — pág. N".
 * @param {{nome: string, pagina: number}} item
 * @returns {string}
 * @example notebookPageLabel({nome: 'Limites', pagina: 2}) // 'Limites — pág. 2'
 */
export function notebookPageLabel(item) {
  return `${item.nome} — ${t('sidechat.tray.page', {page: item.pagina})}`;
}

/**
 * O cartão `.attachment` da bandeja: a imagem da página no mesmo quadrado das
 * imagens anexadas (o × e o clique para ampliar são os mesmos), com a etiqueta
 * "pág. N" sobre a parte de baixo; sem PNG, o quadrado leva o ícone do caderno.
 * @param {{nome: string, pagina: number, thumb?: string}} item
 * @param {{onRemove?: (() => void) | null, key?: string, doc?: Document}} [options]
 * @returns {HTMLElement}
 * @example notebookCardNode({nome: 'Limites', pagina: 2}, {onRemove: () => {}})
 */
export function notebookCardNode(item, {onRemove = null, key = '', doc = document} = {}) {
  const label = notebookPageLabel(item);
  const page = t('sidechat.tray.page', {page: item.pagina});
  const thumb = doc.createElement(item.thumb ? 'img' : 'span');
  thumb.className = 'notebook-thumb';
  if (item.thumb) {
    thumb.setAttribute('src', item.thumb);
    thumb.setAttribute('alt', label);
  } else {
    thumb.setAttribute('aria-hidden', 'true');
    thumb.innerHTML = icon('book');
  }
  const where = doc.createElement('span');
  where.className = 'notebook-page';
  where.textContent = page;
  const remove = doc.createElement('button');
  remove.type = 'button';
  remove.className = 'attachment-remove';
  remove.setAttribute('aria-label', t('attach.remove', {name: item.nome}));
  remove.textContent = '×';
  remove.addEventListener('click', () => onRemove?.());
  const card = doc.createElement('div');
  card.className = 'attachment notebook-card';
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', label);
  card.title = label;
  if (key) card.dataset.key = key;
  card.append(thumb, where, remove);
  return card;
}

/**
 * Marca as imagens da bolha que são páginas de caderno: as primeiras do corpo,
 * na ordem em que o envio as mandou, ganham "<caderno> — pág. N" no `alt` e no
 * `title`. Só age quando há imagem para cada caderno; devolve se marcou.
 * @param {HTMLElement} body o `.body` da bolha
 * @param {Array<{nome: string, pagina: number}>} notebooks
 * @returns {boolean}
 * @example paintNotebookPageLabels(message.querySelector('.body'), [{nome: 'Limites', pagina: 2}])
 */
export function paintNotebookPageLabels(body, notebooks) {
  const list = Array.isArray(notebooks) ? notebooks : [];
  const shots = body?.querySelectorAll ? /** @type {HTMLImageElement[]} */ ([...body.querySelectorAll('img.shot')]) : [];
  if (!list.length || shots.length < list.length) return false;
  for (let at = 0; at < list.length; at++) {
    const label = notebookPageLabel(list[at]);
    shots[at].alt = label;
    shots[at].title = label;
  }
  return true;
}

/**
 * O chip pequeno da reserva: o ícone do caderno, o nome e "pág. N" no estilo
 * dos chips de anexo, sem o caminho do arquivo. É o que uma mensagem antiga
 * (só com o bloco escondido, sem a imagem) mostra no lugar da página.
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
