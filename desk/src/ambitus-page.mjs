// @ts-check
import {t} from './ui-text.mjs';

/* A página mandada pelo Ambitus (`ambitus-page`, pela ponte local) vai SEMPRE à
   bandeja do tutor principal (`tutor-notebooks.mjs`), como cartão (miniatura,
   caderno e "pág. N"), com o campo de pergunta do tutor (`#prompt`) em foco. O
   caminho do arquivo vai junto do cartão, escondido, e segue ao motor no envio
   para o tutor reler a página pelo `ler_caderno` (o main já autorizou o
   caderno). O chat lateral não abre. */

/** O nome do caderno: o que veio, senão o arquivo sem `.xopp`. @param {string} caminho @param {string} nome @returns {string} */
function notebookName(caminho, nome) {
  if (nome) return nome;
  return (caminho.split(/[\\/]/).pop() || caminho).replace(/\.xopp$/i, '');
}

/**
 * O cartão de uma página pedida, ou null quando o pedido não é uma página.
 * @param {unknown} raw `{caminho, pagina, nome}`
 * @returns {{caminho: string, pagina: number, nome: string}|null}
 * @example notebookCardOf({caminho: '/c/Limites.xopp', pagina: 2, nome: ''}) // {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'}
 */
export function notebookCardOf(raw) {
  const {caminho, pagina, nome} = /** @type {{caminho?: unknown, pagina?: unknown, nome?: unknown}} */ (raw || {});
  if (typeof caminho !== 'string' || !caminho || typeof pagina !== 'number' || !Number.isInteger(pagina) || pagina < 1) return null;
  return {caminho, pagina, nome: notebookName(caminho, typeof nome === 'string' ? nome.trim() : '')};
}

/**
 * Recebe as páginas do Ambitus. Sem matéria aberta, avisa. Com matéria, a
 * página vai ao TUTOR principal, como cartão na bandeja dele, e o campo de
 * pergunta fica em foco; o chat lateral não abre. Se o tutor recusar, avisa.
 * @param {{ready: () => boolean, attachTutor: (card: {caminho: string, pagina: number, nome: string}) => boolean,
 *   toast: (text: string) => void}} deps
 * @returns {(raw: unknown) => Promise<boolean>}
 * @example window.desk.onAmbitusPage(createAmbitusPage({ready, attachTutor: attachTutorNotebook, toast}));
 */
export function createAmbitusPage({ready, attachTutor, toast}) {
  return async (raw) => {
    const card = notebookCardOf(raw);
    if (!card) return false;
    if (!ready()) {
      toast(t('sidechat.ambitusPage.noCourse'));
      return false;
    }
    if (attachTutor(card)) return true;
    toast(t('sidechat.ambitusPage.failed'));
    return false;
  };
}
