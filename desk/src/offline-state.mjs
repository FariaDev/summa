/* Estado de rede do renderer (#142): `navigator.onLine` mais os eventos
   `online`/`offline` bastam. Sem polling e sem consultar o main — o sinal do
   navegador é o que o aluno vê (Wi-Fi cabo, modo avião) e é o que o teste
   simula. O estado é só de exibição: nada aqui bloqueia PDFs, notas, revisão,
   Conferir ou o rascunho, e o aviso some sozinho no evento `online`.
   O `createOfflineWatch` existe para o teste unitário injetar a fonte do
   estado sem DOM; as duas funções de pintura ficam aqui para o indicador não
   crescer além do teto de linhas. */
import {t} from './ui-text.mjs';

/**
 * Observa o estado de rede e avisa uma vez por transição.
 * @param {{isOnline?: () => boolean}} [options] `isOnline` responde o estado agora; por padrão, `navigator.onLine`.
 * @returns {{isOffline: () => boolean, onChange: (listener: (offline: boolean) => void) => () => void, sync: () => boolean}}
 *   `sync` relê a fonte e devolve se houve transição; `onChange` devolve a função que desassina.
 * @example
 * const watch = createOfflineWatch({isOnline: () => false});
 * watch.onChange((offline) => console.log(offline)); // true na primeira chamada de sync()
 */
export function createOfflineWatch({isOnline = () => globalThis.navigator?.onLine !== false} = {}) {
  let offline = isOnline() === false;
  const listeners = new Set();
  function sync() {
    const next = isOnline() === false;
    if (next === offline) return false;
    offline = next;
    for (const listener of [...listeners]) listener(offline);
    return true;
  }
  return {
    isOffline: () => offline,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sync,
  };
}

const watch = createOfflineWatch();

/** @returns {boolean} o renderer está sem rede agora. */
export const isOffline = () => watch.isOffline();

/** @param {(offline: boolean) => void} listener chamado a cada transição. */
export const onOfflineChange = (listener) => watch.onChange(listener);

let wired = false;

/**
 * Liga os eventos `online`/`offline` do renderer uma vez; sem janela, não faz nada.
 * @param {Window | undefined} [target] a janela; o teste pode passar um alvo falso.
 * @returns {ReturnType<typeof createOfflineWatch>} o observador ligado.
 */
export function initOfflineState(target = globalThis.window) {
  if (!wired && target && typeof target.addEventListener === 'function') {
    wired = true;
    target.addEventListener('online', () => { watch.sync(); });
    target.addEventListener('offline', () => { watch.sync(); });
    watch.sync();
  }
  return watch;
}

let live = null;

/** Escreve o aviso na região ao vivo só na transição (sem anúncio em loop). */
export function syncOfflineLive() {
  const text = isOffline() ? t('composer.offline') : '';
  if (!live) {
    live = document.createElement('span');
    live.id = 'offline-live';
    live.className = 'visually-hidden';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.querySelector('#composer')?.append(live);
  }
  if (live.textContent !== text) live.textContent = text;
}

/**
 * Troca o texto do indicador pelo aviso de rede, se estiver offline.
 * @param {HTMLElement} node o botão recém-montado pelo núcleo.
 * @returns {boolean} se o aviso entrou (o host põe `data-offline` no botão).
 * @example paintOfflineIndicator(built) // true e o texto vira "Sem internet"
 */
export function paintOfflineIndicator(node) {
  if (!isOffline()) return false;
  const text = t('composer.offline');
  const kids = node.querySelector('.mi-text');
  if (kids) {
    kids.replaceChildren();
    const span = document.createElement('span');
    span.className = 'mi-model';
    span.textContent = text;
    kids.append(span);
  }
  const hint = t('indicator.hint.offline');
  node.setAttribute('aria-label', hint);
  node.setAttribute('data-tip', hint);
  return true;
}
