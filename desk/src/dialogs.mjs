import dialogsCore from './generated/dialogsview.core.js';
import {build, htmlNode, renderChildren, renderInto} from './view-host.mjs';
import {t} from './ui-text.mjs';

/* Aplicadores dos diálogos da Mesa (o núcleo é `core/dialogsview.bend`).
   O casco estático (`<dialog>`/`<form method=dialog>`, inputs de caminho,
   seções de aparência/avisos, corpo da ajuda) continua no `index.html`; aqui
   só se troca o que é dinâmico: linhas de matéria, o formulário do Encerrar,
   a versão da ajuda e os fatos de flag que escondem itens.

   Convenções do aplicador: ids/classes/aria/valores preservados; `on:<evento>`
   cai em `dialogsHandlers` (ou na tabela de quem chama); o IPC continua com
   quem abre/fecha o diálogo (`main.mjs`, `chat.mjs`). */

const $ = (selector) => document.querySelector(selector);
const Nil = {$: 'Nil'};
const bendList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const courseFacts = (course = {}) => ({
  $: 'SettingsCourse',
  id: String(course.id ?? ''),
  name: String(course.name ?? ''),
  path: String(course.path ?? ''),
});

/* Handlers das linhas de matéria: a pasta sai do diálogo do sistema e a
   remoção tira a linha do DOM (o `readSettingsForm` do main lê o resto). */
export const dialogsHandlers = {
  BrowseCourse: async (event) => {
    const row = event.currentTarget?.closest?.('.cfg-course');
    if (!row) return;
    const folder = await window.desk.pickFolder();
    if (folder) row.querySelector('.cfg-path').value = folder;
  },
  RemoveCourse: (event) => {
    event.currentTarget?.closest?.('.cfg-course')?.remove();
  },
};

/* ---------- end-day-dialog (main.mjs) ---------- */

/* Filhos do `#end-day-form`: rótulos, textareas (com o valor digitado) e ações.
   O `<form>` e o listener de submit são do main — re-renderizar o miolo não
   derruba nenhum dos dois. */
export function renderEndDay(where = '', next = '') {
  const form = $('#end-day-form');
  if (!form) return;
  renderChildren(form, dialogsCore.endDayChildren(String(where), String(next)), dialogsHandlers);
}

/* Depois de salvar: o formulário volta vazio (como o `value=''` antigo). */
export function clearEndDay() {
  renderEndDay('', '');
}

/* ---------- bookmark-dialog (nav.mjs) ---------- */

/* Filhos do `#bookmark-form`: título, dica (documento + página), campo do nome
   já preenchido e ações. O `<form>` e o submit são do main; o nav.mjs só abre o
   diálogo com o nome sugerido e lê o campo depois. */
export function renderBookmark(name = '', hint = '') {
  const form = $('#bookmark-form');
  if (!form) return;
  renderChildren(form, dialogsCore.bookmarkChildren(String(name), String(hint)), dialogsHandlers);
}

/* O miolo do `#review-dialog` mudou para o `review-dialog.mjs` (#desempenho):
   só o caderno o usa, e ele agora carrega sob demanda, levando junto o
   `review.core.js` (85 KiB) que estava preso à partida por este módulo. */

/* ---------- settings-dialog (main.mjs) ---------- */

/* Linhas de matéria: lista vazia vira uma linha em branco (decisão do núcleo). */
export function renderCourseRows(courses) {
  const box = $('#cfg-courses');
  if (!box) return;
  const list = bendList((Array.isArray(courses) ? courses : []).map(courseFacts));
  renderChildren(box, dialogsCore.courseList(list), dialogsHandlers);
}

/* Trocar o idioma com as Configurações abertas refaz as linhas (rótulos e
   botões vêm do núcleo) com o que já foi digitado: nada se perde. */
export function relabelCourseRows() {
  const rows = [...document.querySelectorAll('#cfg-courses .cfg-course')];
  if (!rows.length) return;
  renderCourseRows(rows.map((row) => ({
    id: row.dataset.id,
    name: row.querySelector('.cfg-name')?.value,
    path: row.querySelector('.cfg-path')?.value,
  })));
}

/* O "+" de Adicionar matéria acrescenta uma linha em branco. */
export function appendCourseRow() {
  const box = $('#cfg-courses');
  if (!box) return;
  box.append(build(dialogsCore.courseRow(dialogsCore.emptyCourse()), dialogsHandlers));
}

/* ---------- help-dialog / about-dialog (main.mjs) ---------- */

/* `#help-version`: "Mesa de Estudos X.Y.Z" ou vazio. */
export function renderHelpVersion(version) {
  const el = $('#help-version');
  if (!el) return;
  renderInto(el, dialogsCore.helpVersionNode(String(version ?? '')));
}

/* Fatos de flag (do `desk` normalizado): esconde os itens do texto da ajuda.
   A decisão vem do núcleo (`helpChrome`); aqui só se aplica `hidden`. */
export function applyHelpFlags(flags = {}) {
  const chrome = dialogsCore.helpChrome(
    '',
    dialogsCore.helpFlags(!!flags.studyContext, !!flags.endDay, !!flags.refsToggle, flags.conferir !== false)
  );
  const hide = (selector, hidden) => {
    const el = $(selector);
    if (el) el.hidden = hidden;
  };
  hide('#help-study-li', chrome.studyHidden);
  hide('#help-endday-li', chrome.endDayHidden);
  hide('#help-refs-li', chrome.refsHidden);
  /* Conferir Xournal++: some a linha de atalho e as duas menções quando o
     a flag `conferir` desliga o recurso em qualquer plataforma. */
  hide('#help-check-row', chrome.conferirHidden);
  hide('#help-conferir-step', chrome.conferirHidden);
  hide('#help-conferir-li', chrome.conferirHidden);
}

/* Origem das atualizações (#109): fatos do host (`update-origin`) viram a
   variante do núcleo. Rodando do código (`source`) a linha não aparece, como
   antes do ticket. */
const aboutOriginFacts = (origin = {}) => {
  const kind = String(origin.kind ?? 'source');
  if (kind === 'development') return {$: 'OriginDev', worktree: !!origin.worktree, path: String(origin.path ?? '')};
  if (kind === 'unavailable') return {$: 'OriginUnavailable', path: String(origin.path ?? '')};
  if (kind === 'normal') return {$: 'OriginNormal'};
  return {$: 'OriginSource'};
};
let lastAboutOrigin = aboutOriginFacts();
function paintAboutOrigin() {
  const el = $('#about-origin');
  if (!el) return;
  el.hidden = !dialogsCore.originShown(lastAboutOrigin);
  renderChildren(el, dialogsCore.originChildren(lastAboutOrigin), dialogsHandlers);
}

/* O host manda `{kind, path, worktree}`; o núcleo decide rótulo e caminho. */
export function renderAboutOrigin(origin) {
  lastAboutOrigin = aboutOriginFacts(origin);
  paintAboutOrigin();
}

/* O lead do Sobre carrega a versão; sem versão o texto estático fica. */
export function renderAboutLead(version) {
  /* O primeiro `.help-lead` do corpo é o da versão (o outro é o do link). */
  const el = $('#about-lead');
  /* A versão chega como "0.5.0 9dca5d3" (número + commit); a linha separa
     os dois com o mesmo ponto médio do resto. */
  const text = String(version ?? '').trim().replace(/\s+/g, ' · ');
  const lead = dialogsCore.aboutLead(text);
  if (el && lead) renderInto(el, dialogsCore.aboutLeadNode(text));
  /* Troca de idioma: o main chama de novo, e a origem guardada acompanha. */
  paintAboutOrigin();
}

/* ---------- about: linha de atualização + painel de componentes ---------- */

/* A linha do updater vem do núcleo (`aboutUpdateChildren`): o estado é uma
   variante de `UpdateState` (o main.mjs mapeia o IPC) e os cliques
   (CheckUpdate / OpenLink / ApplyUpdate) caem na tabela de handlers do host. */
export function renderAboutUpdate(state, handlers = {}) {
  const box = $('#about-update');
  if (!box) return;
  renderChildren(box, dialogsCore.aboutUpdateChildren(state || {$: 'UpdateIdle'}), handlers);
}

/* A ação da linha é decisão do host + núcleo: Claude Code = "Atualizar" (com
   confirmação); instalação que a Mesa não reconhece = só o comando com
   "Copiar". Com o tutor respondendo a ação fica desligada (`ToolWait`). */
function toolActionFacts(row = {}, busy = false) {
  const command = String(row.command ?? '');
  if (row.state !== 'outdated' || !command) return {$: 'ToolNone'};
  if (busy) return {$: 'ToolWait', command};
  return row.copyOnly ? {$: 'ToolCopy', command} : {$: 'ToolAsk', command};
}

/* Fatos de uma linha de componente: o estado vira a variante de
   `ComponentState`, a ação a de `ToolAction`, a execução a de `ToolRun` e os
   opcionais (dica/link) entram crus. */
const componentFacts = (row = {}, context = {}) => ({
  $: 'ComponentRow',
  id: String(row.id ?? ''),
  label: String(row.label ?? ''),
  version: String(row.version ?? ''),
  state: componentStateFacts(row),
  hint: String(row.hint ?? ''),
  link: String(row.link ?? ''),
  linkLabel: String(row.linkLabel ?? ''),
  action: toolActionFacts(row, !!context.busy),
  ahead: !!row.ahead,
  run: context.runs?.get?.(String(row.id ?? '')) ?? {$: 'RunNone'},
});
function componentStateFacts(row = {}) {
  if (row.state === 'outdated') return {$: 'CompOutdated', latest: String(row.latest ?? '')};
  if (row.state === 'warn') return {$: 'CompWarn', note: String(row.note ?? '')};
  if (row.state === 'ok') return {$: 'CompOk'};
  if (row.state === 'checking') return {$: 'CompChecking'};
  if (row.state === 'offline') return {$: 'CompOffline'};
  return {$: 'CompUnknown'};
}

/* C3: painel aberto ≠ carregando vazio — as 4 linhas nascem imediatamente com
   "Verificando…" e a checagem real
   substitui no mesmo lugar. */
export function renderComponentChecking() {
  renderComponentRows([
    {id: 'claude', label: 'Claude Code', version: '', state: 'checking'},
    {id: 'node', label: 'Node (sistema)', version: '', state: 'checking'},
    {id: 'xournal', label: 'Xournal++', version: '', state: 'checking'},
  ]);
}

/* Plugin MesaPagina (#133): o estado (não instalado / instalado / versão
   diferente) e o botão de instalação moram no aplicador da linha do Xournal++,
   porque a decisão do núcleo (`ToolAction`) é a do Claude Code — isto é texto
   e posição, não invariante de domínio, então fica em JS com teste [ADR 0003].
   O clique vai ao `about-update.mjs` por evento (sem ciclo de imports). */
const PLUGIN_STATE_KEY = {
  missing: 'component.plugin.missing',
  installed: 'component.plugin.installed',
  different: 'component.plugin.different',
  foreign: 'component.plugin.foreign',
  modified: 'component.plugin.modifiedError',
  symlink: 'component.plugin.symlink',
};
const PLUGIN_DOT_STATE = {
  installed: 'ok',
  different: 'new',
  modified: 'warn',
  foreign: 'warn',
  symlink: 'warn',
};
/* Estados em que instalar seria uma tentativa fadada (#133, N5/N6): a recusa
   fica na linha e a ação não é oferecida. */
const PLUGIN_BLOCKED_STATE = new Set(['modified', 'foreign', 'symlink']);
/* A3: a recusa diz o motivo e o próximo passo; a ação desabilitada some. */
const PLUGIN_NEXT_KEY = {
  modified: 'component.plugin.next.modified',
  foreign: 'component.plugin.next.foreign',
  symlink: 'component.plugin.next.symlink',
};
/* Estado da linha do plugin que sobrevive à repintura do painel: o pedido em
   voo (F1) e o erro inline até "Tentar de novo" (F3). */
let pluginUi = {status: 'missing', busy: false, error: ''};
function paintXournalPluginLine() {
  const box = document.querySelector('#component-rows .component-row[data-id="xournal"] .component-plugin');
  if (!box) return;
  const status = pluginUi.status;
  const state = box.querySelector('.component-plugin-state');
  if (state) state.textContent = t(PLUGIN_STATE_KEY[status] ?? 'component.plugin.missing');
  const dot = box.querySelector('.component-dot');
  if (dot) dot.dataset.state = pluginUi.busy ? 'busy' : (PLUGIN_DOT_STATE[status] ?? 'muted');
  /* N4: o estado `different` diz qual versão está na pasta, quando o host
     publica `plugin.version`; sem versão, só o rótulo da ação muda. */
  const version = box.querySelector('.component-plugin-version');
  if (version) {
    const installedVersion = status === 'different' ? String(pluginUi.version ?? '').trim() : '';
    version.textContent = installedVersion ? t('component.plugin.differentVersion', {version: installedVersion}) : '';
    version.hidden = !installedVersion;
  }
  /* N11: o aviso de reiniciar fica na linha, não só no toast passageiro. */
  const restart = box.querySelector('.component-plugin-restart');
  if (restart) {
    restart.textContent = status === 'installed' ? t('component.plugin.restart') : '';
    restart.hidden = status !== 'installed';
  }
  /* A3: a recusa explica o que fazer na linha seguinte; sem botão morto. */
  const refusal = PLUGIN_BLOCKED_STATE.has(status);
  const next = box.querySelector('.component-plugin-next');
  if (next) {
    const nextKey = PLUGIN_NEXT_KEY[status];
    next.textContent = nextKey ? t(nextKey) : '';
    next.hidden = !nextKey;
  }
  const button = box.querySelector('.component-plugin-install');
  if (button) {
    /* N5/N6/N12: com recusa no estado ou erro inline, a linha não repete a
       tentativa; "Tentar de novo" (ou a frase) é a ação única. */
    const blocked = refusal || (!!pluginUi.error && !pluginUi.busy);
    const label = pluginUi.busy
      ? t('component.plugin.installing')
      : status === 'installed' ? t('component.plugin.reinstall')
      : status === 'different' ? t('component.plugin.update') : t('component.plugin.install');
    button.hidden = refusal;
    button.disabled = pluginUi.busy || blocked;
    button.setAttribute('aria-busy', String(pluginUi.busy));
    button.setAttribute('aria-disabled', String(button.disabled));
    if (pluginUi.error && !pluginUi.busy) button.setAttribute('aria-describedby', 'component-plugin-error-xournal');
    else button.removeAttribute('aria-describedby');
    if (pluginUi.busy) {
      const spinner = document.createElement('span');
      spinner.className = 'ts-dots component-plugin-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      spinner.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
      button.replaceChildren(spinner, document.createTextNode(label));
    } else button.textContent = label;
  }
  box.querySelector('.component-plugin-error')?.remove();
  if (pluginUi.error && !pluginUi.busy) {
    const error = document.createElement('div');
    error.id = 'component-plugin-error-xournal';
    error.className = 'component-run component-plugin-error';
    error.dataset.phase = 'failed';
    error.setAttribute('role', 'alert');
    const line = document.createElement('p');
    line.className = 'run-line';
    const lead = document.createElement('strong');
    lead.className = 'run-result';
    lead.textContent = t('component.plugin.error');
    line.append(lead, document.createTextNode(` ${pluginUi.error}`));
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'component-update component-plugin-retry';
    retry.textContent = t('component.plugin.retry');
    retry.onclick = () => window.dispatchEvent(new CustomEvent('desk-xournal-plugin-install'));
    error.append(line, retry);
    box.append(error);
  }
}
export function setXournalPluginUi(patch) {
  pluginUi = {...pluginUi, ...patch};
  paintXournalPluginLine();
}
function paintXournalPlugin(rows) {
  const row = (Array.isArray(rows) ? rows : []).find((entry) => entry?.id === 'xournal' && entry?.plugin);
  const main = document.querySelector('#component-rows .component-row[data-id="xournal"] .component-main');
  if (!row || !main) return;
  pluginUi = {...pluginUi, status: String(row.plugin.status ?? 'missing'), version: String(row.plugin.version ?? '')};
  const box = document.createElement('div');
  box.className = 'component-plugin';
  const dot = document.createElement('span');
  dot.className = 'component-dot';
  dot.setAttribute('aria-hidden', 'true');
  const state = document.createElement('span');
  state.className = 'component-plugin-state';
  state.id = 'component-plugin-state-xournal';
  const version = document.createElement('span');
  version.className = 'component-plugin-version';
  version.hidden = true;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'component-update component-plugin-install';
  button.onclick = () => window.dispatchEvent(new CustomEvent('desk-xournal-plugin-install'));
  const next = document.createElement('span');
  next.className = 'component-plugin-next';
  next.id = 'component-plugin-next-xournal';
  next.hidden = true;
  const restart = document.createElement('span');
  restart.className = 'component-plugin-restart';
  restart.hidden = true;
  box.append(dot, state, version, button, next, restart);
  main.append(box);
  paintXournalPluginLine();
}

/* Painel "Componentes": Claude Code, Node e Xournal++ (a ordem é do núcleo). `context` traz o que não vem do host de arquivos: tutor ocupado e a
   execução em curso de cada ferramenta. */
export function renderComponentRows(rows, handlers = {}, context = {}) {
  const box = $('#component-rows');
  if (!box) return;
  const list = bendList((Array.isArray(rows) ? rows : []).map((row) => componentFacts(row, context)));
  renderChildren(box, dialogsCore.componentRows(list), handlers);
  paintXournalPlugin(rows);
}

/* ---------- pi-dialog / image-dialog (onda da Conversa) ---------- */

/* `#pi-dialog`: título/mensagem entram crus e o `inline` de quem chama resolve
   markdown/KaTeX (`markupInline` do chat); os campos vêm do núcleo. */
export function renderPiDialog({title = '', message = '', field = null} = {}, {inline = (s) => s, handlers = {}} = {}) {
  const titleEl = $('#dialog-title');
  const messageEl = $('#dialog-message');
  const box = $('#dialog-fields');
  if (titleEl) renderInto(titleEl, htmlNode(inline(dialogsCore.piTitle(String(title ?? '')))));
  if (messageEl) renderInto(messageEl, htmlNode(inline(dialogsCore.piMessage(String(message ?? '')))));
  if (box) renderChildren(box, dialogsCore.piFields(bendList(field ? [field] : [])), handlers);
}

/* `#image-dialog`: título pelo nome do arquivo, ações e o caminho no `dataset`
   (o mesmo `#image-dialog` + `#image-preview.src` do chat). Copiar/abrir
   continuam handlers de quem chama (clipboard/Preview são do host). */
export function renderImageChrome({file = '', hasFile} = {}, handlers = {}) {
  const dialog = $('#image-dialog');
  const title = $('#image-title');
  const actions = $('#image-dialog .dialog-actions');
  const path = String(file ?? '');
  if (title) renderInto(title, dialogsCore.imageTitleNode(path));
  if (actions) renderChildren(actions, dialogsCore.imageActions(hasFile ?? !!path), handlers);
  if (dialog) dialog.dataset.path = path;
}
