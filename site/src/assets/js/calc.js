// A calculadora do rodapé do tutor. Sem DOM, para o teste em Node importar.

/**
 * A calculadora do rodapé do tutor. Aceita números, + − * / ^, parênteses e as
 * funções da lista; o resto dá "—". A vírgula de entrada vale como ponto.
 * @param {string} src @param {string} decimal
 * @returns {string}
 * @example calc('sqrt(16) + sin(pi/2)', ',') // → '5'
 */
export function calc(src, decimal) {
  if (!/^[\d\s+\-*/^().,a-z]*$/i.test(src)) return '—';
  const ok = ['sqrt', 'sin', 'cos', 'tan', 'log', 'exp', 'abs', 'pi', 'e', 'ln'];
  let bad = false;
  const js = src.replace(/,/g, '.').replace(/\^/g, '**').replace(/[a-z]+/gi, (w) => {
    if (!ok.includes(w)) bad = true;
    return w === 'pi' ? 'Math.PI' : w === 'e' ? 'Math.E' : w === 'ln' ? 'Math.log' : 'Math.' + w;
  });
  if (bad) return '—';
  try {
    // Seguro: a regex acima só deixa passar dígitos, operadores e os nomes da lista.
    const v = Function(`"use strict";return (${js})`)();
    return Number.isFinite(v) ? String(+v.toFixed(6)).replace('.', decimal) : '—';
  } catch { return '—'; }
}
