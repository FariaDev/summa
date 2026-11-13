// @ts-check
import {t} from './ui-text.mjs';

/* A página mandada pelo Ambitus (`ambitus-page`, pela ponte local): abre o
   chat lateral e põe no rascunho de onde ela vem, com o caminho, sem enviar.
   O tutor relê a página pelo `ler_caderno` (o main já autorizou o caderno);
   a pessoa escreve a pergunta e envia. */

/** O nome do caderno: o que veio, senão o arquivo sem `.xopp`. @param {string} caminho @param {string} nome @returns {string} */
function notebookName(caminho, nome) {
  if (nome) return nome;
  return (caminho.split(/[\\/]/).pop() || caminho).replace(/\.xopp$/i, '');
}

/**
 * O texto que entra no rascunho, ou '' quando o pedido não é uma página.
 * @param {unknown} raw `{caminho, pagina, nome}`
 * @returns {string}
 * @example ambitusPageText({caminho: '/c/Limites.xopp', pagina: 2, nome: ''}) // 'Sobre a pág. 2 do caderno “Limites” (/c/Limites.xopp): '
 */
export function ambitusPageText(raw) {
  const {caminho, pagina, nome} = /** @type {{caminho?: unknown, pagina?: unknown, nome?: unknown}} */ (raw || {});
  if (typeof caminho !== 'string' || !caminho || !Number.isInteger(pagina) || /** @type {number} */ (pagina) < 1) return '';
  const name = notebookName(caminho, typeof nome === 'string' ? nome.trim() : '');
  return `${t('sidechat.ambitusPage', {page: String(pagina), name, path: caminho})} `;
}

/**
 * Recebe as páginas do Ambitus. Sem matéria aberta, avisa; senão abre o chat
 * lateral e espera ele montar (a primeira abertura importa o módulo) para pôr
 * o texto no rascunho.
 * @param {{ready: () => boolean, open: () => void, insert: (text: string) => Promise<boolean>,
 *   toast: (text: string) => void, wait?: (ms: number) => Promise<void>, tries?: number}} deps
 * @returns {(raw: unknown) => Promise<boolean>}
 * @example window.desk.onAmbitusPage(createAmbitusPage({ready, open, insert: insertSidechatText, toast}));
 */
export function createAmbitusPage({ready, open, insert, toast, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), tries = 50}) {
  return async (raw) => {
    const text = ambitusPageText(raw);
    if (!text) return false;
    if (!ready()) {
      toast(t('sidechat.ambitusPage.noCourse'));
      return false;
    }
    open();
    for (let i = 0; i < tries; i++) {
      if (await insert(text)) return true;
      await wait(100);
    }
    toast(t('sidechat.ambitusPage.failed'));
    return false;
  };
}
