import {createLazyModule} from './lazy-module.mjs';

/**
 * Mantém o Caderno de revisão fora da partida (#desempenho): o módulo (e o
 * `review.core.js`) só entram quando a aba abre, uma resposta é guardada para
 * revisar ou o tutor propõe um card.
 * @param {() => Promise<typeof import('./review.mjs')>} importModule
 * @returns {{init: () => Promise<void>, activate: () => Promise<void>, deactivate: () => void, openFromMessage: (node?: object | null) => Promise<void>, openProposal: (payload: object) => Promise<void>, cancelProposal: (payload: object) => void, current: () => any | null}}
 * @example const review = createReviewLoader(); await review.activate();
 */
export function createReviewLoader(importModule = () => import('./review.mjs')) {
  const lazy = createLazyModule({importModule});
  /* A intenção de abrir o Caderno vale mais que a carga: quem clica em
     GeoGebra/matéria durante o import cancela `wanted` e a ativação pendente
     não acontece. O contador garante que duas ativações seguidas apliquem uma
     vez só (o módulo ainda não mudou `S.reviewActive`). */
  let wanted = false;
  let activation = 0;
  /* Cancelamentos de proposta que chegaram antes de o módulo carregar: sem
     eles, o import terminava e abria um card que o host já tinha descartado. */
  const cancelledWhileLoading = new Set();
  const proposalId = (payload) => String(payload?.id ?? '');
  return {
    init: () => lazy.load().then(() => undefined),
    activate: async () => {
      wanted = true;
      const current = ++activation;
      let module;
      try {
        module = await lazy.load();
      } catch (error) {
        if (current === activation) wanted = false;
        throw error;
      }
      if (wanted && current === activation) module.activateReview();
    },
    /* Sair do caderno desmarca a intenção mesmo antes da carga; o módulo só é
       tocado se já veio (trocar de aba não paga o import para esconder uma view
       que nunca apareceu). */
    deactivate: () => {
      wanted = false;
      activation++;
      lazy.current()?.deactivateReview();
    },
    openFromMessage: async (node = null) => (await lazy.load()).openReviewFromMessage(node),
    openProposal: async (payload) => {
      const module = await lazy.load();
      if (cancelledWhileLoading.delete(proposalId(payload))) return;
      module.openReviewProposal(payload);
    },
    cancelProposal: (payload) => {
      if (lazy.current()) return lazy.current().cancelReviewProposal(payload);
      const id = proposalId(payload);
      if (id) cancelledWhileLoading.add(id);
    },
    current: () => lazy.current(),
  };
}

const review = createReviewLoader();
/** Prepara o Caderno sob demanda sem abrir a aba; resolve quando o módulo importa.
 * @returns {Promise<void>}
 * @example await initReview();
 */
export const initReview = () => review.init();
/** Abre a aba do Caderno; a ativação só vale se a pessoa não saiu durante a carga.
 * @returns {Promise<void>}
 * @example await activateReview();
 */
export const activateReview = () => review.activate();
/** Sai do Caderno e cancela uma ativação que ainda esteja carregando.
 * @returns {void}
 * @example deactivateReview();
 */
export const deactivateReview = () => review.deactivate();
/** Abre o diálogo de revisão a partir de uma mensagem do tutor.
 * @param {object | null} [node] a bolha da mensagem
 * @returns {Promise<void>}
 * @example await openReviewFromMessage(el);
 */
export const openReviewFromMessage = (node = null) => review.openFromMessage(node);

/**
 * Registra cedo os canais de proposta do tutor e adia o módulo até a primeira
 * proposta (#desempenho): uma proposta chegada antes da carga é repassada ao
 * módulo assim que ele importa; um cancelamento antes não carrega nada.
 * @param {{loader?: ReturnType<typeof createReviewLoader>, desk?: any, toast?: (message: string) => void}} [options]
 * @returns {() => void} solta os dois canais
 * @example const unbind = mountReviewBoot({desk: window.desk, toast});
 */
export function mountReviewBoot({loader = review, desk = globalThis.window?.desk, toast = () => {}} = {}) {
  const offProposal = desk?.onReviewProposal?.((payload) => {
    loader.openProposal(payload).catch((error) => toast(error?.message || String(error)));
  });
  const offCancel = desk?.onReviewProposalCancel?.((payload) => loader.cancelProposal(payload));
  return () => {
    offProposal?.();
    offCancel?.();
  };
}
