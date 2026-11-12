'use strict';

/* `ler_caderno` no Claude (#135): o mesmo nome, a mesma descrição e os
   mesmos campos do OpenCode (`notebook-tool.mjs`). O adaptador chama o
   leitor do processo principal (`readNotebookPage`/`notebookPageText` de
   `notebook-tool.mjs` via o callback do host); não há segunda ida ao
   Xournal++ nem segunda validação. O nome que o modelo vê é
   `mcp__mesa__ler_caderno`. */
const NOTEBOOK_READ_TOOL_NAME = 'mcp__mesa__ler_caderno';
const {toolErrorText} = require('./tool-error-text.cjs');

/**
 * Cria a ferramenta `ler_caderno` para o motor Claude: chama o leitor do
 * processo principal (`readNotebook`) e devolve texto e imagem da página;
 * erro vira resultado com `isError` e a reserva `err.notebook.readFailed`.
 * @param {(raw: {caminho?: unknown, pagina?: unknown}) => Promise<object>} readNotebook o leitor do processo principal
 * @param {{language?: string}} [options] a língua do tutor para o texto do erro
 * @returns {Promise<object>} a ferramenta `mcp__mesa__ler_caderno` pronta para o SDK
 * @example const tool = await createNotebookReadTool(readNotebook, {language: 'pt-BR'}); // tool ler_caderno com texto e PNG da página
 */
async function createNotebookReadTool(readNotebook, {language} = {}) {
  const [{tool}, {z}, notebook, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-mcp/notebook-tool.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  return tool(notebook.NOTEBOOK_TOOL_NAME, notebook.NOTEBOOK_DESCRIPTION, fields.zodShape(z, notebook.NOTEBOOK_FIELDS), async (args) => {
    try {
      const result = await readNotebook({caminho: args.caminho, pagina: args.pagina});
      return {content: [{type: 'text', text: notebook.notebookPageText(result)}, {type: 'image', data: result.image, mimeType: 'image/png'}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.notebook.readFailed')}]};
    }
  }, {annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {NOTEBOOK_READ_TOOL_NAME, createNotebookReadTool};
