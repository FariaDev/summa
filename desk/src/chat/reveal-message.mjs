// @ts-check
/* Ponto comum da revelação de uma mensagem da busca global (#143/#183): o
   índice vai na bolha montada e o trecho do resultado desempata quando a mesma
   fala virou mais de uma bolha (antes/depois de uma ferramenta). Sem índice
   exato, cai na bolha anterior mais próxima em vez de deixar o aluno no fim.
   O rolamento em si fica com cada coluna: a principal formata a casca
   preguiçosa (#118) e o lateral tem o próprio scroller. */
import {fold} from './chat-search.mjs';

/**
 * Acha a bolha que a busca de estudos encontrou no histórico montado.
 * @param {ParentNode|null} box contêiner com as bolhas (`#messages` ou `#sidechat-messages`)
 * @param {unknown} index índice da mensagem de fala (0 é a primeira)
 * @param {unknown} [snippet] trecho do resultado, com `…` nas pontas
 * @returns {Element|null} a bolha, ou null sem índice válido/bolhas
 * @example pickMessageBubble(document.querySelector('#messages'), 239, 'trecho')
 */
export function pickMessageBubble(box,index,snippet){
 const at=Number(index);
 if(!box||!Number.isInteger(at)||at<0)return null;
 const needle=fold(String(snippet??'').replaceAll('…',' ')).trim();
 const bubbles=[...box.querySelectorAll('.message[data-message-index]')];
 const indexOf=el=>Number(el.dataset.messageIndex);
 const exact=bubbles.filter(el=>indexOf(el)===at);
 const hasNeedle=el=>!!needle&&fold(String(el._raw??el.textContent??'')).includes(needle);
 return exact.find(hasNeedle)
  ||(needle?bubbles.find(hasNeedle):null)
  ||exact[0]
  ||bubbles.filter(candidate=>indexOf(candidate)<=at).at(-1)
  ||null;
}

/**
 * Revela a bolha do resultado e repete a revelação por dois quadros: a altura
 * real das bolhas pode chegar no quadro seguinte (`content-visibility`) e a
 * âncora nativa do Chromium devolve a vista ao ponto antigo (#143).
 * @param {ParentNode|null} box contêiner com as bolhas
 * @param {unknown} index índice da mensagem de fala (0 é a primeira)
 * @param {unknown} snippet trecho do resultado, com `…` nas pontas (pode ser undefined)
 * @param {(el: Element) => void} reveal leva a bolha para a vista
 * @returns {boolean} ex.: revealMessageBubble(box, 239, 'trecho', revealInChat) // true quando a bolha existe
 */
export function revealMessageBubble(box,index,snippet,reveal){
 const first=pickMessageBubble(box,index,snippet);
 if(!first)return false;
 const paint=()=>reveal(pickMessageBubble(box,index,snippet)||first);
 paint();
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{paint();requestAnimationFrame(paint);});
 return true;
}
