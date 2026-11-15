/* Estado do "Enviar agora" da faixa da fila (#36). O comando do aluno solta a
   fila segurada pelo Parar, mas não reenvia o que o host já recusou: a entrega
   incerta pode ter chegado, e o núcleo veda começar um envio novo com
   incerteza (`core/agentdelivery.bend` → `canBegin`). O tutor ocupado não entra
   aqui — o clique já tem o aviso próprio (`queue.busyNow`). */
import deliveryCore from './generated/agentdelivery.core.js';

/**
 * Decide o que a faixa mostra para a ação "Enviar agora".
 * `visible` mantém a ação à vista quando há fila segurada; `blocked` diz que o
 * núcleo não deixaria começar um envio novo (hoje, só a entrega incerta).
 * @param {{held: boolean, count: number, uncertain: boolean}} facts
 * @returns {{visible: boolean, blocked: boolean}}
 * @example
 * sendNowState({held: true, count: 2, uncertain: true}); // {visible: true, blocked: true}
 */
export function sendNowState({held, count, uncertain}) {
  const visible = !!held && Number(count) > 0;
  return {visible, blocked: visible && !deliveryCore.canBegin(false, !!uncertain)};
}
