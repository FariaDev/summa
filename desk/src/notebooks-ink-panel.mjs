// @ts-check
import {t, LANGUAGE_EVENT} from './ui-text.mjs';

/* Interruptor da leitura da tinta no painel de cadernos (#158, #159).
   Carregado por `import()` quando o popover abre: a opção desligada não paga
   bytes na partida do renderer. A decisão de mostrar "sem modelo com visão"
   vem do `notebooks-ink-status` do vigia; aqui só se pinta o estado. */

const MISSING_MODEL = new Set(['no-model', 'no-vision', 'free']);
const CLAUDE_UNAVAILABLE = 'claude-unavailable';
const BLOCKED = new Set([...MISSING_MODEL, CLAUDE_UNAVAILABLE]);
const POLL_MS = 1500;

/** Texto do estado quando a leitura está ligada. Status desconhecido ou de
 *  erro não pode virar "Em dia": vira o texto de erro. @param {string} status
 *  @returns {string} */
function stateText(status) {
  if (status === 'reading') return t('notebooks.ink.state.reading');
  if (status === 'quota') return t('notebooks.ink.state.quota');
  if (status === 'idle') return t('notebooks.ink.state.idle');
  return t('notebooks.ink.state.error');
}

/** Chave do aviso para o motivo devolvido pelo `notebooks-ink-set`; guardar a
 *  chave (e não o texto) deixa o erro ser repintado na troca de idioma (N1).
 *  @param {string} reason @returns {string} */
function failureKey(reason) {
  if (reason === CLAUDE_UNAVAILABLE) return 'notebooks.ink.claudeUnavailable';
  if (MISSING_MODEL.has(reason)) return 'notebooks.ink.noVision';
  if (reason === 'stop') return 'notebooks.ink.fail.stop';
  return 'notebooks.ink.fail.start';
}

/**
 * Monta o interruptor "Buscar também na escrita à mão" e seu estado. `notify` continua
 * aceito pela chamada, mas não é chamado: o erro inline é a mensagem única (A2).
 * @param {{status: () => Promise<{status?: string, pagesRead?: number, enabled?: boolean}>,
 *   set: (on: boolean) => Promise<unknown>, notify?: (text: string) => void}} deps
 * @returns {{element: HTMLElement, refresh: () => Promise<void>, repaint: () => void, setActive: (active: boolean) => void}}
 * @example const ink = initNotebooksInk({status: () => window.desk.notebooksInkStatus(), set: on => window.desk.notebooksInkSet({on})});
 */
export function initNotebooksInk({status, set, notify: _notify = () => {}}) {
  const element = document.createElement('section');
  element.className = 'notebooks-ink';
  const row = document.createElement('div');
  row.className = 'notebooks-ink-row';
  const copy = document.createElement('div');
  copy.className = 'notebooks-ink-copy';
  const label = document.createElement('span');
  label.className = 'notebooks-ink-switch-text';
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'notebooks-ink-switch';
  button.className = 'notebooks-ink-switch';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('aria-describedby', 'notebooks-ink-desc');
  const track = document.createElement('span');
  track.className = 'notebooks-ink-track';
  track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('span');
  thumb.className = 'notebooks-ink-thumb';
  track.append(thumb);
  button.append(track);
  const description = document.createElement('p');
  description.className = 'notebooks-ink-desc';
  description.id = 'notebooks-ink-desc';
  copy.append(label, description);
  row.append(copy, button);
  const statusLine = document.createElement('p');
  statusLine.className = 'notebooks-ink-status';
  statusLine.setAttribute('aria-live', 'polite');
  const count = document.createElement('span');
  count.className = 'notebooks-ink-count';
  const state = document.createElement('span');
  state.className = 'notebooks-ink-state';
  /* Vigia em erro (A1): o "Tentar ler de novo" religa a leitura pelo mesmo
     `set(true)` do host, sem a pessoa ter de desligar e ligar o interruptor. */
  const readRetry = document.createElement('button');
  readRetry.type = 'button';
  readRetry.className = 'notebooks-ink-read-retry';
  readRetry.id = 'notebooks-ink-read-retry';
  readRetry.hidden = true;
  statusLine.append(count, state, readRetry);
  /* Falha do `notebooks-ink-set` fica na própria linha do interruptor (F19),
     com o motivo e "Tentar de novo"; o inline é a mensagem única (A2). */
  const errorLine = document.createElement('p');
  errorLine.className = 'notebooks-ink-error';
  errorLine.setAttribute('role', 'alert');
  errorLine.hidden = true;
  const errorText = document.createElement('span');
  errorText.className = 'notebooks-ink-error-text';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'notebooks-ink-retry';
  errorLine.append(errorText, retry);
  element.append(row, statusLine, errorLine);

  /** @type {{status?: string, pagesRead?: number, enabled?: boolean}} */
  let snapshot = {};
  let busy = false;
  let active = false;
  /** @type {ReturnType<typeof setInterval>|null} */
  let pollTimer = null;
  /* O erro inline guarda a chave do catálogo (ou a mensagem crua de uma
     exceção) e o estado que a ação tentou alcançar: sem isso ele sobrevive à
     troca de idioma, ao fechar/reabrir e ao estado já ter mudado (N1). */
  let errorKey = '';
  /** @type {boolean|null} */
  let errorIntent = null;
  /** Ação que falhou: o interruptor repete o liga/desliga; a leitura repete o
   *  `set(true)` (A1). @type {'toggle'|'read'} */
  let errorAction = 'toggle';

  /** Mostra/limpa o erro inline do interruptor. @param {string} [key] chave do catálogo @param {string} [raw] mensagem de exceção @param {boolean|null} [intent] estado que a ação pedia @param {'toggle'|'read'} [action] ação que falhou @returns {void} */
  function paintError(key = '', raw = '', intent = null, action = 'toggle') {
    errorKey = key;
    errorIntent = intent;
    errorAction = action;
    errorLine.hidden = !(key || raw);
    errorText.textContent = key ? t(key) : raw;
  }

  function repaintErrorText() {
    if (errorKey) errorText.textContent = t(errorKey);
  }

  function repaint() {
    const statusKey = String(snapshot.status || 'idle');
    const blocked = BLOCKED.has(statusKey);
    const stateKnown = statusKey === 'reading' || statusKey === 'quota' || statusKey === 'idle';
    /* O opt-in salvo manda no interruptor: mesmo sem modelo, ele fica ligado e
       habilitado para o aluno DESLIGAR; só ligar é que exige modelo válido. */
    const on = snapshot.enabled === true;
    label.textContent = t('notebooks.ink.label');
    button.setAttribute('aria-label', t('notebooks.ink.label'));
    description.textContent = statusKey === CLAUDE_UNAVAILABLE
      ? t('notebooks.ink.claudeUnavailable')
      : blocked ? t('notebooks.ink.noVision') : t('notebooks.ink.description');
    /* Desabilitar durante o IPC tiraria o foco do botão e o popover fecharia
       (`focusout` do painel); o guarda de `busy` já impede o clique duplo. */
    button.disabled = blocked && !on;
    button.setAttribute('aria-busy', String(busy));
    button.setAttribute('aria-checked', String(on));
    statusLine.hidden = !on;
    count.hidden = !on;
    count.textContent = on ? t('notebooks.ink.pages', {count: Math.max(0, Number(snapshot.pagesRead) || 0)}) : '';
    state.hidden = !on;
    state.textContent = on ? stateText(statusKey) : '';
    state.classList.toggle('notebooks-ink-state-error', on && !stateKnown);
    /* A1: o erro do vigia ganha uma ação só, "Tentar ler de novo". Quando a
       própria retentativa falha, o inline assume a ação (sem dois iguais). */
    const watchError = on && !stateKnown && !blocked;
    readRetry.hidden = !watchError || (!errorLine.hidden && errorAction === 'read');
    readRetry.textContent = t('notebooks.ink.retryRead');
    retry.textContent = t(errorAction === 'read'
      ? 'notebooks.ink.retryRead'
      : snapshot.enabled === true ? 'notebooks.ink.retryStop' : 'notebooks.ink.retryStart');
  }

  /** Relê o estado do vigia e repinta. O erro de uma ação some quando o
   *  estado já chegou ao que ela pedia — não fica de fantasma (N1).
   *  @returns {Promise<void>} */
  async function refresh() {
    try {
      const next = await status();
      snapshot = next && typeof next === 'object' ? next : {};
      if (!errorLine.hidden && errorIntent !== null && (snapshot.enabled === true) === errorIntent) paintError('');
    } catch { /* painel segue com o último estado conhecido */ }
    repaint();
  }

  /** Liga/desliga o poll do contador com o painel aberto (B6a). @param {boolean} next @returns {void} */
  function setActive(next) {
    active = next === true;
    if (!active) {
      if (pollTimer !== null) clearInterval(pollTimer);
      pollTimer = null;
      paintError('');
      return;
    }
    if (pollTimer === null) pollTimer = setInterval(() => { void refresh(); }, POLL_MS);
    void refresh();
  }

  async function toggle(fromRetry = false) {
    if (busy || (!fromRetry && button.disabled)) return;
    busy = true;
    paintError('');
    repaint();
    const intent = snapshot.enabled !== true;
    try {
      const result = await set(intent);
      if (result && typeof result === 'object' && /** @type {{ok?: unknown}} */ (result).ok === false) {
        const key = failureKey(String(/** @type {{reason?: unknown}} */ (result).reason || ''));
        /* A2: o erro inline é a mensagem única; o toast repetido saiu. */
        paintError(key, '', intent);
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      paintError('', message, intent);
    } finally {
      busy = false;
      repaint();
    }
  }

  /** Relê a tinta pelo `set(true)` do host (A1), sem passar pelo desligamento.
   *  @returns {Promise<void>} */
  async function retryRead() {
    if (busy) return;
    busy = true;
    paintError('');
    repaint();
    try {
      const result = await set(true);
      if (result && typeof result === 'object' && /** @type {{ok?: unknown}} */ (result).ok === false) {
        const key = failureKey(String(/** @type {{reason?: unknown}} */ (result).reason || ''));
        /* Intent nulo: `enabled` já era true e não diz se a leitura voltou. */
        paintError(key, '', null, 'read');
        /* O botão do estado some quando o inline assume a ação; sem passar o
           foco, o `focusout` do popover o fecharia. */
        if (document.activeElement === readRetry) retry.focus();
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      paintError('', message, null, 'read');
      if (document.activeElement === readRetry) retry.focus();
    } finally {
      busy = false;
      repaint();
    }
  }

  button.addEventListener('click', () => { void toggle(); });
  readRetry.addEventListener('click', () => { void retryRead(); });
  retry.addEventListener('click', () => { void (errorAction === 'read' ? retryRead() : toggle(true)); });
  window.addEventListener(LANGUAGE_EVENT, () => { repaint(); repaintErrorText(); });
  repaint();
  return {element, refresh, repaint, setActive};
}
