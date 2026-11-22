// @ts-check
'use strict';

/* Religação do MCP `mesa` antes de cada envio (#63): o MCP é um processo
   filho e pode morrer no meio da sessão; o OpenCode deixa o `mesa` em
   `failed` e a sessão perde as ferramentas. Fica fora do adaptador para ele
   continuar abaixo do teto de 500 linhas. */

const {mesaMcpStatus} = require('./opencode-mcp.cjs');

/**
 * Confere o MCP antes do envio e religa quando ele caiu. Chamadas simultâneas
 * dividem a mesma conferência.
 * @param {Record<string, any>} adapter o `OpenCodeAdapter` dono da sessão
 * @returns {Promise<void>}
 * @example await ensureMesaMcp(adapter);
 */
async function ensureMesaMcp(adapter) {
  if (!adapter.mcpCheck) adapter.mcpCheck = checkMesa(adapter).finally(() => { adapter.mcpCheck = null; });
  return adapter.mcpCheck;
}

/* Um GET por envio confere; fora do conectado, remove a entrada morta e
   registra de novo. */
async function checkMesa(adapter) {
  if (!adapter.client || !adapter.options.mcpConfig?.()) return;
  const status = await mesaMcpStatus(adapter.http().request, () => adapter.location());
  if (status === 'connected' || status === 'ready') {
    if (!adapter.mcpUnavailable) return;
    adapter.mcpUnavailable = false;
    await adapter.publishTutorPrompt();
    return;
  }
  adapter.log('opencode', `MCP mesa ${status || 'sem resposta'} antes do envio; religando`);
  const wasUnavailable = adapter.mcpUnavailable;
  await adapter.registerMcp({replace: true, notify: !wasUnavailable});
  if (wasUnavailable !== adapter.mcpUnavailable) await adapter.publishTutorPrompt();
}

module.exports = {ensureMesaMcp};
