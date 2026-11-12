/* Histórico: devolve o slot das atividades que só existem no store.
   A prévia publicada no fim do turno (`previa:prv-…`) e o id de fallback do
   OpenCode (`opencode-mcp:…`) não têm passo de ferramenta no transcript; sem
   slot, o renderer não tem onde hidratar e o quadro some ao reabrir a conversa
   (H4, 2ª rodada do commit cf57ec7b). A posição sai do `createdAt` do store
   contra o começo dos turnos: o quadro fica depois do último nó do turno em
   que nasceu. Sem carimbo (ou sem turno correspondente), fica no fim da
   conversa. A escolha é determinística: reabrir de novo põe o quadro no mesmo
   lugar.

   Um item que já tem slot pelo `toolCallId` do passo de ferramenta não ganha
   segundo slot. Roda depois do `showHistory` já ter montado o DOM; só lê a
   lista do store e insere slots (a hidratação é do renderer de atividades). */

const SLOT_ATTRIBUTE = '.activity-slot[data-activity-call';
/* Só os ids sintéticos ficam sem passo no transcript. Um id de passo comum sem
   slot é de turno cortado ou refeito: ressuscitá-lo poria um quadro velho fora
   do lugar. */
const RECOVERED_PREFIXES = ['previa:', 'opencode-mcp:'];

/** @param {string} toolCallId @returns {boolean} @example isRecoverableCall('previa:prv-1') // true */
export function isRecoverableCall(toolCallId) {
  return RECOVERED_PREFIXES.some((prefix) => String(toolCallId || '').startsWith(prefix));
}

/* Carimbo anterior ao primeiro turno com tempo: o turno foi cortado do
   histórico (teto de mensagens), então o quadro não volta no fim. */
function olderThanHistory(ranges, createdAt) {
  const stamp = Number(createdAt) || 0;
  const first = (Array.isArray(ranges) ? ranges : []).map((range) => Number(range && range.start) || 0).find((start) => start > 0);
  return !!stamp && !!first && stamp < first;
}

function escaped(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

/**
 * Itens do store (já da conversa atual) que ainda não têm slot no DOM, do mais
 * antigo para o mais novo. Mesmo `toolCallId` conta uma vez: vale a versão mais
 * alta, como na hidratação normal.
 * @param {Array<object>} items itens de `activityList`
 * @param {(toolCallId: string) => boolean} hasSlot
 * @returns {Array<object>}
 * @example activityItemsWithoutSlot([{toolCallId: 'previa:prv-1', createdAt: 1}], () => false)
 */
export function activityItemsWithoutSlot(items, hasSlot) {
  const byCall = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const toolCallId = String(item && item.toolCallId || '');
    if (!isRecoverableCall(toolCallId) || typeof hasSlot !== 'function' || hasSlot(toolCallId)) continue;
    const previous = byCall.get(toolCallId);
    if (!previous || Number(item.version) > Number(previous.version)) byCall.set(toolCallId, item);
  }
  return [...byCall.values()].sort((left, right) => (Number(left.createdAt) || 0) - (Number(right.createdAt) || 0));
}

/**
 * Índice do turno em que a atividade nasceu: o último que já tinha começado
 * quando o store gravou `createdAt`. -1 quando não dá para saber (sem carimbo
 * ou sem turno com tempo).
 * @param {Array<{start: number}>} ranges começo de cada turno, na ordem do histórico
 * @param {number} createdAt carimbo de parede do item do store (ms)
 * @returns {number}
 * @example activityTurnIndex([{start: 100}, {start: 200}], 250) // 1
 */
export function activityTurnIndex(ranges, createdAt) {
  const stamp = Number(createdAt) || 0;
  if (!stamp || !Array.isArray(ranges)) return -1;
  let found = -1;
  for (let index = 0; index < ranges.length; index += 1) {
    const start = Number(ranges[index] && ranges[index].start) || 0;
    if (start > 0 && start <= stamp) found = index;
  }
  return found;
}

function hasSlotIn(root, toolCallId) {
  if (!root || typeof root.querySelector !== 'function') return false;
  return !!root.querySelector(`${SLOT_ATTRIBUTE}="${escaped(toolCallId)}"]`);
}

function insertSlot({doc, root, ranges, item}) {
  const toolCallId = String(item.toolCallId || '');
  const slot = doc.createElement('div');
  slot.className = 'activity-slot';
  slot.dataset.activityCall = toolCallId;
  /* O store só tem publicação terminada: não é um passo pendente do turno. */
  slot.dataset.status = 'done';
  const index = activityTurnIndex(ranges, item.createdAt);
  const tail = index >= 0 ? ranges[index] && ranges[index].tail : null;
  if (tail && tail.isConnected && root.contains(tail)) {
    /* Slots vizinhos do mesmo turno mantêm a ordem de chegada do store. */
    let after = tail;
    while (after.nextElementSibling && after.nextElementSibling.classList && after.nextElementSibling.classList.contains('activity-slot')) {
      after = after.nextElementSibling;
    }
    after.after(slot);
  } else {
    root.append(slot);
  }
  return slot;
}

/**
 * Cria e hidrata os slots que faltam para as atividades do store da conversa.
 * Erro da lista (IPC, escopo trocado) é inerte: o histórico já está na tela.
 * @param {{
 *   root: Element,
 *   ranges: Array<{start: number, tail: Element|null}>,
 *   list: () => Promise<object[]|{items?: object[]}|null>,
 *   isCurrent?: () => boolean,
 *   conversationId?: string,
 *   dispatch?: (detail: {toolCallId: string, element: Element}) => void,
 *   doc?: Document,
 * }} deps
 * @returns {Promise<Array<{toolCallId: string, element: Element}>>}
 * @example await recoverActivitySlots({root, ranges, list: () => desk.activityList()})
 */
export async function recoverActivitySlots({root, ranges = [], list, isCurrent = () => true, conversationId = '', dispatch = () => {}, doc = root && root.ownerDocument} = {}) {
  if (!root || typeof list !== 'function' || !doc) return [];
  let result;
  try { result = await list(); } catch { return []; }
  /* Outro `showHistory` ou uma publicação ao vivo pode ter chegado enquanto a
     lista vinha: o DOM atual manda. */
  if (!isCurrent() || !root.isConnected) return [];
  const listed = Array.isArray(result) ? result : (result && Array.isArray(result.items) ? result.items : []);
  /* A lista é da conversa corrente do main; o filtro evita semear no histórico
     antigo o item de uma troca que chegou no meio. */
  const items = conversationId ? listed.filter((item) => String(item && item.conversationId || '') === conversationId) : listed;
  const missing = activityItemsWithoutSlot(items, (toolCallId) => hasSlotIn(root, toolCallId)).filter((item) => !olderThanHistory(ranges, item.createdAt));
  const placed = [];
  for (const item of missing) {
    const toolCallId = String(item.toolCallId || '');
    if (hasSlotIn(root, toolCallId)) continue;
    const element = insertSlot({doc, root, ranges, item});
    placed.push({toolCallId, element});
    dispatch({toolCallId, element});
  }
  return placed;
}
