'use strict';

/* `salvar_nota` no Claude (#91/#139): o MESMO guia da extensão do Pi
   (`mesa-notes/guide.mjs`). O host registra a SUGESTÃO no chat; o arquivo em
   `Notas/` só nasce no clique "Guardar" do aluno. O chat lateral não recebe
   esta ferramenta. */
const NOTE_TOOL_NAME = 'mcp__mesa__salvar_nota';
const {toolErrorText} = require('./tool-error-text.cjs');

/**
 * @param {(args: {titulo?: unknown, conteudo?: unknown}) => Promise<{suggested: boolean, id: string, title: string}>} suggestNote
 * @param {{language?: string}} [options]
 */
async function createNoteTool(suggestNote, {language} = {}) {
  const [{tool}, {z}, guide, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-notes/guide.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  return tool('salvar_nota', guide.NOTES_DESCRIPTION, fields.zodShape(z, guide.NOTES_FIELDS), async (args) => {
    try {
      const result = await suggestNote({titulo: args?.titulo, conteudo: args?.conteudo});
      return {content: [{type: 'text', text: guide.noteText(result)}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.note.write')}]};
    }
  }, {annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {NOTE_TOOL_NAME, createNoteTool};
