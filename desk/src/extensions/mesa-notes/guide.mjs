/* `salvar_nota` — UM texto e um formato de resultado para os três motores
   (Pi `mesa_salvar_nota`, Claude e OpenCode `salvar_nota`). Desde a #139 a
   ferramenta NÃO grava: ela sugere uma nota no chat e só o clique do aluno em
   "Guardar" cria `Notas/<título>.md` (nunca sobrescreve, nunca sai da pasta).
   Descrição e campos são SEMPRE em inglês; o resultado (`noteText`) segue em
   português. */

import notesCore from '../../generated/tutornotes.core.js';

const MAX_TITLE = Number(notesCore.maxTitle());
const MAX_CONTENT = Number(notesCore.maxContent());

export const NOTES_DESCRIPTION =
  'Suggests a Markdown note for the student to keep. The note appears as a card in the conversation with Guardar and Descartar buttons; ' +
  'do NOT say it was saved: the tool returns immediately and the student decides. Only when the student clicks Guardar does the desk write it ' +
  'inside the current course (in the Notas folder; in a free session, inside its own workspace). ' +
  'Use it for durable study notes the student asked to keep, not for chat replies. ' +
  'It never overwrites: an existing name gets -2, -3, and so on. It cannot write PDFs or files outside that folder.';

export const NOTES_FIELDS = {
  titulo: {type: 'string', min: 1, max: MAX_TITLE, trim: true, description: `Note title (1 to ${MAX_TITLE} characters); it becomes the file name.`},
  conteudo: {type: 'string', min: 1, max: MAX_CONTENT, description: `Markdown content (1 to ${MAX_CONTENT} characters).`},
};

/**
 * O texto que volta ao tutor quando a nota foi apenas SUGERIDA (#139).
 * @param {{title?: string, suggested?: boolean, rel?: string, path?: string}} result
 * @returns {string}
 * @example noteText({title: 'Limites'}) // 'Nota “Limites” sugerida ao aluno…'
 */
export function noteText(result) {
  const title = result?.title || '';
  return `Nota “${title}” sugerida ao aluno. Ela só será gravada em Notas/ se ele clicar em Guardar; não diga que foi salva e aguarde a decisão dele.`;
}
