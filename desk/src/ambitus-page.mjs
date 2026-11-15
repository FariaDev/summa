// @ts-check
import {t} from './ui-text.mjs';

/* A página mandada pelo Ambitus (`ambitus-page`, pela ponte local): abre o
   chat lateral e a põe na bandeja de anexos como cartão (miniatura, caderno e
   "pág. N"), com o campo de texto vazio e com foco para a pergunta. O caminho
   do arquivo vai junto do cartão, escondido, e segue ao motor no envio para o
   tutor reler a página pelo `ler_caderno` (o main já autorizou o caderno).
   Com o modo mini ligado (`mini-mode.mjs`) o destino é a bandeja do tutor
   principal (`tutor-notebooks.mjs`), com o mesmo cartão e o mesmo caminho escondido. */

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
 * Recebe as páginas do Ambitus. Sem matéria aberta, avisa. Com o modo mini
 * ligado a página vai ao TUTOR principal, como cartão na bandeja dele (o chat
 * lateral não abre); fora do modo mini abre o chat lateral e espera ele montar
 * (a primeira abertura importa o módulo) para pôr o cartão na bandeja.
 * @param {{ready: () => boolean, open: () => void, attach: (card: {caminho: string, pagina: number, nome: string}) => Promise<boolean>,
 *   toast: (text: string) => void, mini?: () => boolean, attachTutor?: (card: {caminho: string, pagina: number, nome: string}) => boolean,
 *   wait?: (ms: number) => Promise<void>, tries?: number}} deps
 * @returns {(raw: unknown) => Promise<boolean>}
 * @example window.desk.onAmbitusPage(createAmbitusPage({ready, open, attach: attachSidechatNotebook, toast, mini: isMiniMode, attachTutor: attachTutorNotebook}));
 */
export function createAmbitusPage({ready, open, attach, toast, mini = () => false, attachTutor = () => false, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), tries = 50}) {
  return async (raw) => {
    const card = notebookCardOf(raw);
    if (!card) return false;
    if (!ready()) {
      toast(t('sidechat.ambitusPage.noCourse'));
      return false;
    }
    if (mini()) {
      if (attachTutor(card)) return true;
      toast(t('sidechat.ambitusPage.failed'));
      return false;
    }
    open();
    for (let i = 0; i < tries; i++) {
      if (await attach(card)) return true;
      await wait(100);
    }
    toast(t('sidechat.ambitusPage.failed'));
    return false;
  };
}
