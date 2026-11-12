// @ts-check
/* Altura do campo do tutor: o fio de cima do composer puxa, as setas andam uma
   linha e o duplo clique volta às três linhas. As contas (piso, teto e passo)
   são puras, em `composer-height.mjs`; aqui ficam o ponteiro, o teclado e a
   aplicação no campo. A altura lembrada é a mesma do `layoutSnapshot` do
   `state.mjs` (estado de interface, nunca o `config.json`). */
import {bindPointerDrag} from './pointer-drag.mjs';
import {
  COMPOSER_DEFAULT_LINES,
  clampComposerHeight,
  composerHeightForLines,
  composerHeightLimits,
  stepComposerHeight,
} from './composer-height.mjs';

/** Mede as linhas e a coluna que definem os limites da altura.
 *  @param {HTMLElement} field @param {HTMLElement|null} column
 *  @returns {{lineHeight:number, columnHeight:number}}
 *  @example composerHeightFacts(document.querySelector('#prompt'), document.querySelector('#chat'))
 */
export function composerHeightFacts(field, column) {
  const line = Number.parseFloat(getComputedStyle(field).lineHeight);
  return {
    lineHeight: Number.isFinite(line) && line > 0 ? line : 0,
    columnHeight: Number(column?.clientHeight) || 0,
  };
}

/** Aplica a altura lembrada (ou volta ao padrão de três linhas) no campo.
 *  @param {HTMLElement} field @param {HTMLElement|null} column @param {number|null|undefined} value
 *  @returns {number} a altura aplicada
 *  @example applyComposerHeight(prompt, chat, 96)
 */
export function applyComposerHeight(field, column, value) {
  const facts = composerHeightFacts(field, column);
  const stored = Number(value);
  if (!Number.isFinite(stored) || stored <= 0) {
    field.style.removeProperty('height');
    return composerHeightForLines(COMPOSER_DEFAULT_LINES, facts.lineHeight);
  }
  const height = clampComposerHeight(stored, facts);
  field.style.height = `${height}px`;
  return height;
}

/**
 * Liga o fio de cima do composer ao campo do tutor. O arrasto mede a partir
 * da altura e do ponteiro do `pointerdown`; ↑ sobe e ↓ desce uma linha; o
 * duplo clique volta ao padrão. O teto acompanha a coluna (metade dela) quando
 * a janela muda de tamanho.
 * @param {{field:HTMLElement|null, grip:HTMLElement|null, column:HTMLElement|null, save:()=>void}} deps
 * @returns {{reset:()=>void, set:(value:number)=>number}}
 * @example initComposerResize({field:prompt, grip:grip, column:chat, save});
 */
export function initComposerResize({field, grip, column, save}) {
  if (!field || !grip || !column) return {reset() {}, set: () => 0};
  const current = () => field.getBoundingClientRect().height;
  let startHeight = 0;
  let startY = 0;
  const set = (value) => applyComposerHeight(field, column, value);
  const reset = () => {
    const facts = composerHeightFacts(field, column);
    field.style.height = `${composerHeightForLines(COMPOSER_DEFAULT_LINES, facts.lineHeight)}px`;
    save();
  };
  grip.addEventListener('pointerdown', (event) => {
    startHeight = current();
    startY = event.clientY;
  });
  bindPointerDrag(grip, (event) => {
    const facts = composerHeightFacts(field, column);
    set(clampComposerHeight(startHeight + (startY - event.clientY), facts));
  }, save);
  grip.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const facts = composerHeightFacts(field, column);
    set(stepComposerHeight(current(), event.key === 'ArrowUp' ? 1 : -1, facts));
    save();
  });
  grip.addEventListener('dblclick', reset);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const facts = composerHeightFacts(field, column);
      const height = current();
      const limits = composerHeightLimits(facts);
      if (height > limits.max + 0.5 || height < limits.min - 0.5) set(height);
    }).observe(column);
  }
  return {reset, set};
}
