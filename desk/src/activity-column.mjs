// @ts-check
/* A largura útil de `#messages` é um fato de partida para as prévias do tutor
   (#42): o host mede nela quando o quadro não pede largura. Fica num módulo
   pequeno para o observador existir desde o começo mesmo com o renderer de
   atividades sob demanda (#desempenho). */

/**
 * Observa a largura da coluna de resposta e a reporta ao host.
 * @param {Document} doc
 * @param {{activityColumn?: (width: number) => any}} desk
 * @returns {ResizeObserver | null} observer para desligar no `detach` do host
 * @example const observer = watchActivityColumn(document, window.desk);
 */
export function watchActivityColumn(doc, desk) {
  if (!desk || typeof desk.activityColumn !== 'function' || typeof ResizeObserver !== 'function') return null;
  const messages = doc.querySelector('#messages');
  if (!messages) return null;
  let lastColumn = 0;
  const report = () => {
    const style = getComputedStyle(messages);
    const width = Math.round(messages.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
    if (!width || Math.abs(width - lastColumn) < 4) return;
    lastColumn = width;
    Promise.resolve(desk.activityColumn(width)).catch(() => {});
  };
  const observer = new ResizeObserver(report);
  observer.observe(messages);
  report();
  return observer;
}
