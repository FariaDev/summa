// @ts-check
import {icon} from '../icons.mjs';
import {t, LANGUAGE_EVENT} from './ui-text.mjs';
import {isChatFull, setChatFull} from './chat/chat-full.mjs';

/* Modo mini (passo 9, protótipo r7): a mesma janela da Mesa encolhe para só o
   chat do tutor, sempre por cima, e deixa o Ambitus (ou qualquer programa de
   escrita) à vista enquanto a pessoa escreve. A janela é do main
   (`mini-mode-host.cjs`: 360×480 no canto da tela, por cima, guarda lugar e
   tamanho); aqui mora o que é de interface:

   - `body.mini-mode` junto do `body.chat-full` (que já esconde os leitores):
     o CSS (`mini-mode.css`) tira o cabeçalho da Mesa, o cabeçalho do tutor, a
     calculadora e o chat lateral preso, e mostra o cabeçalho mini;
   - o cabeçalho mini: título da conversa (a matéria em cinza), o alfinete
     "Sempre por cima" e "Voltar à Mesa";
   - o atalho Ctrl/⌘+Shift+M e o item do ⋯ do tutor.

   Voltar restaura o chat na tela inteira SE ele já estava assim antes. O fluxo
   (`createMiniFlow`) é puro: janela e tela inteira entram por parâmetro, para o
   teste dirigir o liga/desliga sem Electron. */

/**
 * O liga/desliga do modo mini, sem DOM.
 * @param {{host: (request: {on?: boolean, alwaysOnTop?: boolean}) => Promise<{on: boolean, alwaysOnTop: boolean}>,
 *   chatFull: {get: () => boolean, set: (value: boolean) => unknown}, expandTutor?: () => void, prepare?: () => void, onChange?: () => void}} deps
 *   `host`: a janela (o canal `mini-mode`); `chatFull`: o chat na tela inteira; `expandTutor`: reabre a coluna recolhida; `prepare`: fecha menus abertos; `onChange`: repinta
 * @returns {{isOn: () => boolean, pinned: () => boolean, enter: () => Promise<boolean>, leave: () => Promise<boolean>, toggle: () => Promise<boolean>, togglePin: () => Promise<boolean>}}
 * @example const flow = createMiniFlow({host: window.desk.miniMode, chatFull: {get: isChatFull, set: setChatFull}}); await flow.enter();
 */
export function createMiniFlow({host, chatFull, expandTutor = () => {}, prepare = () => {}, onChange = () => {}}) {
  let on = false;
  let wasFull = false;
  let pinned = true;
  /** @type {Promise<boolean> | null} */
  let running = null;

  /** Entra no mini: a tela inteira liga (guardando se já estava), a janela encolhe; se a janela falhar, tudo volta como estava. */
  async function runEnter() {
    prepare();
    wasFull = chatFull.get();
    expandTutor();
    chatFull.set(true);
    on = true;
    onChange();
    try {
      const state = await host({on: true});
      pinned = state?.alwaysOnTop !== false;
    } catch (error) {
      on = false;
      chatFull.set(wasFull);
      onChange();
      throw error;
    }
    onChange();
    return true;
  }

  /** Sai do mini: a janela volta primeiro; o chat volta à tela inteira só se já estava assim. */
  async function runLeave() {
    prepare();
    await host({on: false});
    on = false;
    chatFull.set(wasFull);
    onChange();
    return false;
  }

  /** @param {() => Promise<boolean>} step @returns {Promise<boolean>} uma troca por vez; pedido durante a troca espera a dela */
  function serial(step) {
    if (running) return running;
    running = step().finally(() => { running = null; });
    return running;
  }

  return {
    isOn: () => on,
    pinned: () => pinned,
    enter: () => (on ? Promise.resolve(true) : serial(runEnter)),
    leave: () => (on ? serial(runLeave) : Promise.resolve(false)),
    toggle() { return on ? this.leave() : this.enter(); },
    async togglePin() {
      const state = await host({alwaysOnTop: !pinned});
      pinned = state?.alwaysOnTop !== false;
      onChange();
      return pinned;
    },
  };
}

/** @type {ReturnType<typeof createMiniFlow> | null} */
let flow = null;
/** @type {HTMLElement | null} */
let header = null;
/** @type {(error: unknown) => void} */
let fail = () => {};
let leavingByOthers = false;

/** Se o modo mini está ligado agora. @returns {boolean} @example isMiniMode() // false no boot */
export function isMiniMode() {
  return flow?.isOn() === true;
}

/** Liga ou desliga o modo (o botão, o atalho, o ⋯ e a paleta). Erro vai ao aviso. @returns {Promise<boolean>} o estado final @example await toggleMiniMode() */
export async function toggleMiniMode() {
  if (!flow) return false;
  try { return await flow.toggle(); } catch (error) { fail(error); return flow.isOn(); }
}

/** @param {string} selector @returns {string} o texto do nó da Mesa, ou vazio */
function textOf(selector) {
  return (document.querySelector(selector)?.textContent || '').trim();
}

function paintTitle() {
  if (!header) return;
  const title = header.querySelector('.mini-title-text');
  const course = header.querySelector('.mini-course');
  const name = textOf('#session-title .session-title-text');
  if (title) title.textContent = name;
  if (course) course.textContent = textOf('#course-menu-label');
  header.querySelector('.mini-title')?.setAttribute('title', [name, textOf('#course-menu-label')].filter(Boolean).join(' · '));
}

function paintLabels() {
  if (!header || !flow) return;
  const pin = /** @type {HTMLElement} */ (header.querySelector('#mini-pin'));
  pin.setAttribute('aria-pressed', String(flow.pinned()));
  pin.title = t('mini.pin');
  pin.setAttribute('aria-label', t('mini.pin'));
  const back = /** @type {HTMLElement} */ (header.querySelector('#mini-back'));
  back.title = t('mini.back');
  back.setAttribute('aria-label', t('mini.back'));
}

function paint() {
  document.body.classList.toggle('mini-mode', flow?.isOn() === true);
  paintTitle();
  paintLabels();
}

/** @returns {HTMLElement} o cabeçalho mini: título, alfinete e "Voltar à Mesa" (o CSS o mostra só no modo) */
function buildHeader() {
  const el = document.createElement('div');
  el.id = 'mini-head';
  const title = document.createElement('span');
  title.className = 'mini-title';
  const text = document.createElement('span');
  text.className = 'mini-title-text';
  const course = document.createElement('small');
  course.className = 'mini-course';
  title.append(text, course);
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.id = 'mini-pin';
  pin.className = 'icon-btn';
  pin.innerHTML = icon('pin');
  const back = document.createElement('button');
  back.type = 'button';
  back.id = 'mini-back';
  back.className = 'icon-btn';
  back.innerHTML = icon('maximize2');
  el.append(title, pin, back);
  pin.addEventListener('click', () => { flow?.togglePin().catch(fail); });
  back.addEventListener('click', () => { void toggleMiniMode(); });
  return el;
}

/** O item "Modo mini" do ⋯ do tutor (o clique é de quem monta o menu). @returns {HTMLButtonElement} @example morePop.append(miniMenuItem()) */
export function miniMenuItem() {
  const item = document.createElement('button');
  item.type = 'button';
  item.id = 'chat-mini-menu';
  item.setAttribute('role', 'menuitem');
  item.innerHTML = icon('pictureInPicture2');
  const label = document.createElement('span');
  label.textContent = t('mini.menu');
  item.append(' ', label);
  return item;
}

/* Ctrl/⌘+Shift+M alterna, como o Mod+Shift+E do chat na tela inteira: global,
   e diálogo aberto não alterna. O editor de atalhos reenvia o combo atual como
   esta mesma tecla (preload). */
function onKey(/** @type {KeyboardEvent} */ event) {
  if (event.defaultPrevented || event.isComposing || event.repeat || document.querySelector('dialog[open]')) return;
  if (!(event.ctrlKey || event.metaKey) || event.altKey || !event.shiftKey) return;
  if (String(event.key || '').toLowerCase() !== 'm') return;
  event.preventDefault();
  void toggleMiniMode();
}

/** Outro comando tirou o chat da tela inteira (⌘+Shift+E, recolher o tutor) com o mini ligado: o mini só existe com a tela inteira, então volta à Mesa. */
function onChatFullChanged(/** @type {Event} */ event) {
  const full = /** @type {CustomEvent} */ (event).detail?.full === true;
  if (full || !flow?.isOn() || leavingByOthers) return;
  leavingByOthers = true;
  flow.leave().catch(fail).finally(() => { leavingByOthers = false; });
}

/**
 * Liga o modo mini à página: o cabeçalho mini dentro do tutor, o atalho, os
 * rótulos e o título que acompanha a conversa. O botão do cabeçalho do tutor e o
 * item do ⋯ chamam `toggleMiniMode`.
 * @param {{expandTutor?: () => void, prepare?: () => void, onError?: (error: unknown) => void}} [deps] `expandTutor`: reabre a coluna recolhida; `prepare`: fecha menus abertos; `onError`: aviso de falha
 * @returns {void}
 * @example initMiniMode({expandTutor: () => setChatCollapsed(false), prepare: closeTutorPops, onError: toastFailure});
 */
export function initMiniMode({expandTutor, prepare, onError} = {}) {
  fail = onError || (() => {});
  flow = createMiniFlow({host: (request) => window.desk.miniMode(request), chatFull: {get: isChatFull, set: setChatFull}, expandTutor, prepare, onChange: paint});
  header = buildHeader();
  document.querySelector('#chat')?.prepend(header);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('desk-chat-full-changed', onChatFullChanged);
  window.addEventListener(LANGUAGE_EVENT, paint);
  if (typeof MutationObserver === 'function') {
    const watch = new MutationObserver(paintTitle);
    for (const selector of ['#session-title', '#course-menu-label']) {
      const node = document.querySelector(selector);
      if (node) watch.observe(node, {childList: true, characterData: true, subtree: true});
    }
  }
  paint();
}
