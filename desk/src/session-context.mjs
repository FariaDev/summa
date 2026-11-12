/* Linha de contexto do cabeçalho do tutor (r2, "Cabeçalho e Contexto"): o PDF
   que vai com a mensagem e a página, mais a questão ativa. A matéria e a
   contagem de referências saíram — a aba já diz a matéria e o nome do PDF já
   diz quantos materiais vão. Puro: quem lê o DOM e o estado é o
   `context-dock.mjs`; este módulo só decide o texto. ADR 0003: apresentação em
   JS com teste, sem lei no núcleo. */
import {t} from './ui-text.mjs';

/**
 * Nome do primeiro PDF com a página ("Limites.pdf, p. 1"), mais "+N" quando
 * há outros PDFs no mesmo envio. Página ausente não vira "p. 0".
 * @param {{name?: string, page?: number}} pdf
 * @param {number} [others] quantidade de PDFs além do primeiro
 * @returns {string}
 * @example pdfGoesName({name: 'Limites.pdf', page: 1}, 1) // 'Limites.pdf, p. 1 +1'
 */
export function pdfGoesName({name = '', page = 0} = {}, others = 0) {
  const file = String(name || '').trim();
  if (!file) return '';
  const at = Math.max(0, Math.trunc(Number(page) || 0));
  const extra = Math.max(0, Math.trunc(Number(others) || 0));
  const where = at > 0 ? `, ${t('session.context.page', {page: at})}` : '';
  return `${file}${where}${extra > 0 ? ` +${extra}` : ''}`;
}

/**
 * Texto da linha de baixo do cabeçalho: o primeiro PDF (e "+N") e a questão
 * ativa, separados por " · "; vazio quando não há nenhum dos dois.
 * @param {{pdfs?: Array<{name?: string, page?: number}>, exercise?: string}} facts
 * @returns {string}
 * @example sessionContextLine({pdfs: [{name: 'Limites.pdf', page: 1}], exercise: 'Lista 3, questão 2'}) // 'Limites.pdf, p. 1 · Lista 3, questão 2'
 */
export function sessionContextLine({pdfs = [], exercise = ''} = {}) {
  const list = Array.isArray(pdfs) ? pdfs.filter((pdf) => pdf && String(pdf.name || '').trim()) : [];
  const parts = [];
  if (list.length) parts.push(pdfGoesName(list[0], list.length - 1));
  const title = String(exercise || '').trim();
  if (title) parts.push(title);
  return parts.filter(Boolean).join(' · ');
}
