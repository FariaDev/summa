// @ts-check
/* Envio só com imagem (#109): o aluno anexa uma imagem e manda sem escrever. O
   motor precisa de uma frase de pedido, então o texto que vai ao modelo abre com
   a marca `[Só imagem]` e a frase padrão do locale (`send.imageOnly`). A marca é
   o que a exibição corta: a bolha do aluno fica só com a imagem, também depois
   do reload, em qualquer idioma. Mesmo padrão dos blocos `[Contexto ...]`. */

export const IMAGE_ONLY_MARK = '[Só imagem]';

/**
 * Texto do pedido quando o aluno mandou só imagem.
 * @param {string} phrase a frase padrão já traduzida (`send.imageOnly`)
 * @returns {string}
 * @example imageOnlyPrompt('Responda de acordo com a imagem que mandei.')
 *   // '[Só imagem]\nResponda de acordo com a imagem que mandei.'
 */
export function imageOnlyPrompt(phrase) {
  return `${IMAGE_ONLY_MARK}\n${String(phrase ?? '')}`;
}

/**
 * Diz se o texto guardado é um envio só com imagem (o que a bolha não mostra).
 * @param {unknown} text
 * @returns {boolean}
 * @example isImageOnlyPrompt('[Só imagem]\nResponda...') // true
 */
export function isImageOnlyPrompt(text) {
  return typeof text === 'string' && text.startsWith(`${IMAGE_ONLY_MARK}\n`);
}
