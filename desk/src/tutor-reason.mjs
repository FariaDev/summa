// @ts-check
/* O motivo que a coluna do tutor mostra quando ele não atende (#23, #51).
   Puro (sem DOM): o `tutor-state.mjs` pinta, os testes leem daqui. */
import claudeVersionCore from './generated/claudeversion.core.js';
import {parseMessage} from './i18n.mjs';
import {reasonText} from './tutor-reason-text.mjs';

/* A frase comum mora em `tutor-reason-text.mjs` (#desempenho): o tutor-state a
   usa sem arrastar o núcleo da faixa do Claude Code. Este módulo só é importado
   sob demanda, quando o motivo chega como mensagem do catálogo (#51). */
export {reasonText};

/* O motivo que chega como mensagem do catálogo (Claude Code fora da faixa,
   #51) vai inteiro ao núcleo, que a mostra com o conserto; o view-host a traduz
   no idioma da interface. Qualquer outro motivo segue a frase de sempre. */
/**
 * Motivo e conserto para o núcleo `tutorstate` (`stateViewFix`).
 * @param {unknown} raw o motivo como o `connect()` recebeu
 * @returns {{reason: string, fix: string}} `fix`: "update", "about" ou "".
 * @example reasonFacts('Tutor sem resposta.') // {reason: 'Tutor sem resposta.', fix: ''}
 */
export function reasonFacts(raw){
 const message=parseMessage(String(raw??''));
 if(!message)return {reason:reasonText(raw),fix:''};
 return {reason:String(raw),fix:claudeVersionCore.fixFor(message.key)};
}

