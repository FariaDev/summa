/* Painel Backup e Compartilhar (Mesa) — módulo de UI independente.

   Exporta `initBackupPanel(documento, ipc, opções)` (e o par puro
   `buildBackupPanelView`/`renderBackupPanelView`, que o teste exercita sem
   navegador). O módulo:
     - injeta o próprio CSS escopado (`.mesa-bkp-*`, tokens do app com
       fallback) e o próprio `<dialog>`;
     - abre por conta própria (`abrir()`), sem depender do shell global;
     - as interfaces IPC são PROPOSTAS pelo host: o renderer nunca autoriza
       caminho — ele pede a pasta no diálogo nativo do main (`escolherPasta`)
       e o main confere/valida antes de ler ou escrever;
     - texto em português, tokens de cor atuais, botões com folga da borda
       (`--space-7`), foco preso no diálogo e `aria-*` para leitor de tela.

   Contrato do `ipc` (nomes dos canais na ponte `desk.*` em parênteses):

     status()                      → (backup-status)  {available, destination, auto, lastError, last, versions[]}
     listar()                      → (backup-list)    [{snapshotId, created, bytes, entries, valid, label}]
     escolherPasta()               → (backup-pick-folder) caminho
     definirConfig(patch)          → (backup-config)  a config gravada (inclui `destination`)
     rodar({reason,label})         → (backup-run)     resultado do snapshot (com `pruned`)
     verificar(id)                 → (backup-verify)  {ok, errors, checked, bytes}
     previaRestauracao(id)         → (backup-restore-preview) plano com `planId`, contagens, listas e `materials`
     aplicarRestauracao(planId, {materials}) → (backup-restore-apply) {applied, written, backupOfReplaced, materialsRemapped}
     cancelarRestauracao(planId)   → (backup-restore-cancel) {cancelled}
     enviarGit()                   → (backup-git-push) {pushed, remote, branch, error}
     exportar(destino, opções)     → (share-export-course) {file, bytes, features, counts}
     escolherArquivo()             → (share-pick-file) caminho do arquivo .mesa-materia
     previaImportacao(caminho, destino) → (share-import-preview) resumo, contagens e transcrição
     importar(caminho, destino)    → (share-import-course) {destination, courseId, files}
     abrirPasta(caminho)           → (open-folder)     abre no Finder/Explorer
     curso()                       → (backup-active-course) {id, name, path} da matéria ativa

   `opções`: {alvo, confirmar, abrirPasta, prefixoCss}. Nada aqui lê/escreve
   arquivo: quem faz isso é o main. */

import {t, formatDate, LANGUAGE_EVENT} from './ui-text.mjs';
import {ensureStyles} from './backup-panel-style.mjs';
export {ensureStyles};
import {displayCourseName} from './free-names.mjs';

const DIALOG_ID = 'mesa-backup-panel';


/* ---------- helpers puros (testáveis sem navegador) ---------- */

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let scaled = value / 1024;
  let index = 0;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index++;
  }
  return `${scaled.toFixed(scaled >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatWhen(iso, now = new Date()) {
  if (!iso) return '—';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '—';
  const date = formatDate(when, {day: '2-digit', month: '2-digit', year: 'numeric'});
  const time = formatDate(when, {hour: '2-digit', minute: '2-digit', hour12: false});
  const days = Math.floor((now.getTime() - when.getTime()) / 86400000);
  const rel = days <= 0 ? t('backup.when.today') : days === 1 ? t('backup.when.yesterday') : t('backup.when.daysAgo', {days});
  return `${date}, ${time} (${rel})`;
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

/* O rótulo do motivo é do domínio (`manual`, `auto`), não texto solto. */
export function reasonLabel(reason) {
  const key = {manual: 'backup.reason.manual', auto: 'backup.reason.auto', 'pre-update': 'backup.reason.preUpdate', import: 'backup.reason.import'}[String(reason || '')];
  return key ? t(key) : String(reason || '—');
}

/**
 * Modelo da prévia de importação (#140): resumo e texto da transcrição que o
 * tutor vai ler. Devolve SÓ dados — quem pinta usa `textContent`, porque o
 * texto vem de um pacote de outra pessoa e nunca é confiável.
 * @param {{destination?: {name?: string, dir?: string}, conversations?: object[]}} [preview]
 * @returns {{title: string, destination: string, summary: string, note: string,
 *   hasTranscript: boolean, conversations: {label: string, preview: string, text: string,
 *   messages: number, characters: number, truncated: boolean}[]}}
 * @example importPreviewView({conversations: []}).hasTranscript // false
 */
export function importPreviewView(preview = {}) {
  const found = Array.isArray(preview.conversations) ? preview.conversations : [];
  const conversations = found
    .filter((item) => item && item.transcript && typeof item.transcript.text === 'string' && item.transcript.text)
    .map((item) => ({
      label: String(item.originalName || item.archivePath || ''),
      preview: String(item.transcript.preview || ''),
      text: String(item.transcript.text || ''),
      messages: Number(item.transcript.messages) || 0,
      characters: Number(item.transcript.characters) || 0,
      truncated: item.transcript.truncated === true,
    }));
  const messages = conversations.reduce((sum, item) => sum + item.messages, 0);
  const characters = conversations.reduce((sum, item) => sum + item.characters, 0);
  return {
    title: t('backup.import.previewTitle'),
    destination: String(preview.destination?.name || preview.destination?.dir || ''),
    summary: conversations.length ? t('backup.import.transcript.summary', {count: messages, characters}) : t('backup.import.noTranscript'),
    note: conversations.length ? t('backup.import.transcript.note') : '',
    hasTranscript: conversations.length > 0,
    conversations,
  };
}

export function buildBackupPanelView({status = {}, versions = [], course = {}, config = {}, section = 'backup', now = new Date()} = {}) {
  const destination = status.destination || config.destination || '';
  const auto = {...(config.auto ? {auto: true} : {}), ...(status.auto || {})};
  const settings = {
    auto: config.auto === true || auto.auto === true,
    intervalHours: Number(config.intervalHours) > 0 ? Number(config.intervalHours) : 24,
    idleMinutes: Number(config.idleMinutes) > 0 ? Number(config.idleMinutes) : 30,
    keep: Number(config.keep) > 0 ? Number(config.keep) : 10,
    git: config.git === true,
    gitRoot: config.gitRoot || '',
    gitRemote: config.gitRemote || '',
  };
  const last = status.last || null;
  const gitInfo = {
    root: settings.gitRoot || '',
    remote: settings.gitRemote || '',
    error: status.gitError || '',
    at: status.gitAt ? formatWhen(status.gitAt, now) : '',
    ready: settings.git === true && !!settings.gitRoot,
  };
  const list = (Array.isArray(versions) ? versions : []).map((item) => ({
    id: item.snapshotId,
    when: formatWhen(item.created, now),
    reason: reasonLabel(item.reason || (last && last.id === item.snapshotId ? last.reason : '')),
    size: formatBytes(item.bytes),
    entries: Number(item.entries) || 0,
    valid: item.valid !== false,
  }));
  return {
    section,
    title: t('backup.title'),
    destination,
    hasDestination: !!destination,
    settings,
    git: gitInfo,
    status: {
      lastAt: last ? formatWhen(String(last.created || last.at || ''), now) : t('backup.noBackupYet'),
      lastId: last && last.id ? last.id : '',
      lastError: status.lastError || (last && last.error) || '',
      lastSize: last ? formatBytes(last.bytes) : '',
      autoAt: auto.attemptedAt ? formatWhen(auto.attemptedAt, now) : '',
      autoId: auto.snapshotId || '',
      autoError: auto.error || '',
    },
    course: {name: course ? displayCourseName(course) : '', hasCourse: !!(course && (course.name || course.id))},
    versions: list,
    versionCount: list.length,
  };
}

/* HTML do miolo (só o que o `initBackupPanel` injeta; nada de `<dialog>`
   aqui — o teste confere o markup e o host decide onde ele vive). */
export function renderBackupPanelView(view) {
  const v = view || buildBackupPanelView({});
  const git = v.git || {root: '', remote: '', error: '', at: '', ready: false};
  const nav = [
    ['backup', t('backup.nav.backup')],
    ['restaurar', t('backup.nav.restore')],
    ['compartilhar', t('backup.nav.share')],
  ].map(([id, label]) => `<button type="button" data-bkp-nav="${id}" aria-current="${v.section === id ? 'true' : 'false'}">${label}</button>`).join('');

  const backup = `
  <section class="mesa-bkp-sec ${v.section === 'backup' ? '' : 'mesa-bkp-hidden'}" data-bkp-sec="backup" aria-label="${t('backup.nav.backup')}">
    <h3>${t('backup.local.title')}</h3>
    <div class="mesa-bkp-field"><span>${t('backup.folder')}</span>
      <div class="mesa-bkp-row">
        <input id="mesa-bkp-dest" type="text" readonly value="${escapeHtml(v.destination)}" placeholder="${t('backup.noFolder')}" aria-label="${t('backup.folder')}">
        <button type="button" data-bkp-act="pasta">${t('backup.pickFolder')}</button>
      </div>
    </div>
    <label class="mesa-bkp-check"><input type="checkbox" id="mesa-bkp-auto" ${v.settings.auto ? 'checked' : ''}> ${t('backup.auto')}</label>
    <div class="mesa-bkp-row mesa-bkp-auto">
      <label class="mesa-bkp-check">${t('backup.every', {input: `<input type="number" id="mesa-bkp-intervalo" min="1" max="720" value="${v.settings.intervalHours}" aria-label="${t('backup.everyAria')}" ${v.settings.auto ? '' : 'disabled'}>`})}</label>
      <label class="mesa-bkp-check">${t('backup.idle', {input: `<input type="number" id="mesa-bkp-parado" min="5" max="1440" value="${v.settings.idleMinutes}" aria-label="${t('backup.idleAria')}" ${v.settings.auto ? '' : 'disabled'}>`})}</label>
      <label class="mesa-bkp-check">${t('backup.keep', {input: `<input type="number" id="mesa-bkp-guardar" min="1" max="200" value="${v.settings.keep}" aria-label="${t('backup.keepAria')}" ${v.settings.auto ? '' : 'disabled'}>`})}</label>
    </div>
    <label class="mesa-bkp-check" title="${t('backup.git.title')}"><input type="checkbox" id="mesa-bkp-git" ${v.settings.git ? 'checked' : ''}> ${t('backup.git')}</label>
    <div class="mesa-bkp-field" data-bkp-git-fields style="${v.settings.git ? '' : 'display:none'}"><span>${t('backup.gitFolder')}</span>
      <div class="mesa-bkp-row">
        <input id="mesa-bkp-gitroot" type="text" readonly value="${escapeHtml(v.settings.gitRoot)}" placeholder="${t('backup.noFolder')}" aria-label="${t('backup.gitFolder')}">
        <button type="button" data-bkp-act="pasta-git">${t('backup.pickFolder')}</button>
      </div>
      <span>${t('backup.gitRemoteNote')}</span>
      <input id="mesa-bkp-gitremote" type="text" value="${escapeHtml(v.settings.gitRemote)}" placeholder="git@github.com:usuario/mesa-backup.git" aria-label="${t('backup.gitRemoteAria')}">
      <div class="mesa-bkp-row">
        <button type="button" data-bkp-act="git-push" ${git.ready ? '' : 'disabled'} aria-label="${t('backup.gitPushAria')}">${t('backup.gitPush')}</button>
        <span class="mesa-bkp-map" data-bkp-gitmap>${t('backup.gitMap', {root: escapeHtml(git.root || '—'), remote: escapeHtml(git.remote || '—')})}</span>
      </div>
      ${git.error ? `<span class="mesa-bkp-warn">${t('backup.gitLastFailed', {error: escapeHtml(git.error)})}</span>` : git.at ? `<span>${t('backup.gitLastAt', {at: escapeHtml(git.at)})}</span>` : ''}
    </div>
    <div class="mesa-bkp-row">
      <button type="button" data-bkp-act="rodar" title="${t('backup.runNote', {keep: v.settings.keep})}" ${v.hasDestination ? '' : 'disabled'}>${t('backup.runNow')}</button>
    </div>
    <div class="mesa-bkp-status">
      <strong>${t('backup.lastBackup', {at: escapeHtml(v.status.lastAt)})}</strong>
      ${v.status.lastId ? `<span>${escapeHtml(v.status.lastId)} · ${escapeHtml(v.status.lastSize)}</span>` : ''}
      ${v.status.autoAt ? `<span>${t(v.status.autoError ? 'backup.autoAtFailed' : 'backup.autoAt', {at: escapeHtml(v.status.autoAt)})}</span>` : ''}
      ${v.status.autoError ? `<span class="mesa-bkp-error">${t('backup.autoError', {error: escapeHtml(v.status.autoError)})}</span>` : ''}
      ${v.status.lastError ? `<span class="mesa-bkp-error">${t('backup.lastError', {error: escapeHtml(v.status.lastError)})}</span>` : ''}
    </div>
  </section>`;

  const restore = `
  <section class="mesa-bkp-sec ${v.section === 'restaurar' ? '' : 'mesa-bkp-hidden'}" data-bkp-sec="restaurar" aria-label="${t('backup.nav.restore')}">
    <h3>${t('backup.restore.title')}</h3>
    <p>${t('backup.restore.lead')}</p>
    <div class="mesa-bkp-row"><button type="button" data-bkp-act="listar">${t('backup.restore.list')}</button><span data-bkp-restore-msg role="status" aria-live="polite"></span></div>
    <ul class="mesa-bkp-list" data-bkp-versions aria-label="${t('backup.restore.versionsAria')}">
      ${v.versions.length ? v.versions.map((item) => `
      <li>
        <span class="mesa-bkp-meta"><b>${escapeHtml(item.when)}</b><span>${t('backup.restore.meta', {id: escapeHtml(item.id), reason: escapeHtml(item.reason), count: item.entries, size: escapeHtml(item.size)})}${item.valid ? '' : t('backup.restore.invalidSuffix')}</span></span>
        <button type="button" data-bkp-act="verificar" data-bkp-id="${escapeHtml(item.id)}">${t('backup.restore.check')}</button>
        <button type="button" data-bkp-act="previa" data-bkp-id="${escapeHtml(item.id)}" ${item.valid ? '' : 'disabled'}>${t('backup.restore.preview')}</button>
      </li>`).join('') : `<li><span class="mesa-bkp-meta"><b>${t('backup.restore.noneTitle')}</b><span>${t('backup.restore.noneHint')}</span></span></li>`}
    </ul>
    <div class="mesa-bkp-preview mesa-bkp-hidden" data-bkp-preview role="region" aria-label="${t('backup.restore.previewAria')}"></div>
  </section>`;

  const share = `
  <section class="mesa-bkp-sec ${v.section === 'compartilhar' ? '' : 'mesa-bkp-hidden'}" data-bkp-sec="compartilhar" aria-label="${t('backup.nav.share')}">
    <h3>${t('backup.share.title')}</h3>
    <p>${t('backup.share.lead')}</p>
    <div class="mesa-bkp-status">
      <strong>${t('backup.share.activeCourse', {name: escapeHtml(v.course.name || t('backup.share.noCourse'))})}</strong>
      ${v.course.hasCourse ? '' : `<span>${t('backup.share.openCourse')}</span>`}
    </div>
    <label class="mesa-bkp-check"><input type="checkbox" id="mesa-bkp-conv" ${''}> ${t('backup.share.includeSessions')}</label>
    <div class="mesa-bkp-row">
      <button type="button" data-bkp-act="exportar" ${v.course.hasCourse ? '' : 'disabled'}>${t('backup.share.export')}</button>
      <button type="button" data-bkp-act="importar">${t('backup.share.import')}</button>
    </div>
    <span data-bkp-share-msg role="status" aria-live="polite"></span>
    <div class="mesa-bkp-import" data-bkp-import hidden></div>
  </section>`;

  return {nav, sections: `${backup}${restore}${share}`};
}

/* ---------- painel ---------- */

const DEFAULT_IPC = {
  status: async () => ({available: false, versions: []}),
  listar: async () => [],
  escolherPasta: async () => '',
  curso: async () => ({}),
  obterConfig: async () => ({}),
  definirConfig: async () => ({}),
  rodar: async () => ({}),
  verificar: async () => ({ok: true}),
  previaRestauracao: async () => ({}),
  aplicarRestauracao: async () => ({}),
  cancelarRestauracao: async () => ({cancelled: true}),
  exportar: async () => ({}),
  escolherArquivo: async () => '',
  previaImportacao: async () => ({conversations: []}),
  importar: async () => ({}),
  abrirPasta: async () => false,
  enviarGit: async () => ({pushed: false, error: t('backup.msg.gitNotConfigured')}),
};

export function initBackupPanel(documento, ipc = {}, options = {}) {
  if (!documento) throw Error('initBackupPanel precisa do document');
  const api = {...DEFAULT_IPC, ...ipc};
  const confirmar = typeof options.confirmar === 'function' ? options.confirmar : null;
  const target = options.alvo || documento.body;
  const prefix = String(options.prefixoCss || 'mesa-bkp');
  ensureStyles(documento);

  const dialog = documento.createElement('dialog');
  dialog.id = DIALOG_ID;
  dialog.className = prefix;
  dialog.setAttribute('aria-labelledby', 'mesa-bkp-titulo');
  dialog.innerHTML = `
    <form method="dialog" data-bkp-form>
      <div class="mesa-bkp-head">
        <h2 id="mesa-bkp-titulo"></h2>
        <button type="button" class="icon-btn dialog-close" data-bkp-act="fechar">×</button>
      </div>
      <div class="mesa-bkp-body">
        <nav class="mesa-bkp-nav"></nav>
        <div class="mesa-bkp-content" data-bkp-content></div>
      </div>
      <div class="mesa-bkp-actions">
        <span class="mesa-bkp-live" data-bkp-live role="status" aria-live="polite"></span>
        <button type="button" data-bkp-act="fechar" data-bkp-cancel></button>
        <button type="button" class="primary" data-bkp-act="salvar" data-bkp-save></button>
      </div>
    </form>`;
  target.appendChild(dialog);

  let state = {section: 'backup', view: buildBackupPanelView({}), planId: '', busy: false, destination: '', gitRoot: '', importPreview: null, importExpanded: false};

  const find = (selector) => dialog.querySelector(selector);
  const live = (message, kind = '') => {
    const el = find('[data-bkp-live]');
    if (el) {
      el.textContent = message || '';
      el.className = `mesa-bkp-live ${kind === 'error' ? 'mesa-bkp-error' : kind === 'ok' ? 'mesa-bkp-ok' : ''}`.trim();
    }
  };
  /* Cromo do diálogo (título, rótulos fixos) é montado uma vez; o idioma
     pode mudar com o diálogo aberto, então os textos são reaplicados aqui. */
  const paintChrome = () => {
    const set = (selector, text) => { const el = find(selector); if (el) el.textContent = text; };
    set('#mesa-bkp-titulo', t('backup.title'));
    set('[data-bkp-cancel]', t('backup.cancel'));
    set('[data-bkp-save]', t('backup.saveSettings'));
    const close = find('.dialog-close');
    if (close) { close.setAttribute('aria-label', t('backup.close')); close.setAttribute('title', t('backup.close')); }
    find('.mesa-bkp-nav')?.setAttribute('aria-label', t('backup.sections'));
  };
  const paint = () => {
    paintChrome();
    const rendered = renderBackupPanelView(state.view);
    const nav = find('.mesa-bkp-nav');
    const content = find('[data-bkp-content]');
    if (nav) nav.innerHTML = rendered.nav;
    if (content) content.innerHTML = rendered.sections;
    paintImportPreview();
    const gitFields = find('[data-bkp-git-fields]');
    if (gitFields) gitFields.style.display = state.view.settings.git ? '' : 'none';
    /* E4 (auditoria rodada 3): a aba Compartilhar só tem ações (Exportar e
       Importar; o "Incluir sessões" vale por exportação e o `backup-config`
       do main só aceita chaves da aba Backup) — nenhum campo dela passa pelo
       Salvar, então o botão some nessa aba. Nas outras segue como está. */
    const save = find('[data-bkp-save]');
    if (save) save.hidden = state.section === 'compartilhar';
  };
  /* A prévia (#140) é montada com `createElement`/`textContent`: o texto da
     transcrição vem de um pacote de outra pessoa e nunca vira HTML. */
  function paintImportPreview() {
    const box = find('[data-bkp-import]');
    if (!box) return;
    box.textContent = '';
    const view = state.importPreview ? importPreviewView(state.importPreview) : null;
    box.hidden = !view;
    if (!view) return;
    const add = (parent, tag, className, text) => {
      const el = documento.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      parent.appendChild(el);
      return el;
    };
    add(box, 'h3', '', view.title);
    if (view.destination) add(box, 'p', 'mesa-bkp-import-dest', t('backup.import.destination', {destination: view.destination}));
    add(box, 'p', 'mesa-bkp-import-summary', view.summary);
    if (view.note) add(box, 'p', 'mesa-bkp-import-note', view.note);
    for (const item of view.conversations) {
      const article = add(box, 'div', 'mesa-bkp-transcript');
      add(article, 'b', '', item.label);
      const text = add(article, 'pre', 'mesa-bkp-transcript-text', state.importExpanded ? item.text : item.preview);
      text.setAttribute('data-bkp-import-text', '');
      if (item.truncated) add(article, 'span', 'mesa-bkp-warn', t('backup.import.transcript.truncated'));
    }
    const actions = add(box, 'div', 'mesa-bkp-row');
    if (view.hasTranscript) {
      const toggle = add(actions, 'button', '', t(state.importExpanded ? 'backup.import.transcript.showLess' : 'backup.import.transcript.showAll'));
      toggle.setAttribute('type', 'button');
      toggle.setAttribute('data-bkp-act', 'importar-abrir');
    }
    const cancel = add(actions, 'button', '', t('backup.cancel'));
    cancel.setAttribute('type', 'button');
    cancel.setAttribute('data-bkp-act', 'importar-cancelar');
    const confirm = add(actions, 'button', 'primary', t('backup.import.confirm'));
    confirm.setAttribute('type', 'button');
    confirm.setAttribute('data-bkp-act', 'importar-confirmar');
  }
  const readSettings = () => ({
    auto: !!find('#mesa-bkp-auto')?.checked,
    intervalHours: Number(find('#mesa-bkp-intervalo')?.value) || 24,
    idleMinutes: Number(find('#mesa-bkp-parado')?.value) || 30,
    keep: Number(find('#mesa-bkp-guardar')?.value) || 10,
    git: !!find('#mesa-bkp-git')?.checked,
    gitRoot: state.gitRoot || find('#mesa-bkp-gitroot')?.value || '',
    gitRemote: find('#mesa-bkp-gitremote')?.value || '',
  });

  async function refresh() {
    try {
      const [status, versions, course, config] = await Promise.all([
        api.status(),
        api.listar(),
        api.curso(),
        api.obterConfig(),
      ]);
      state.view = buildBackupPanelView({
        status: {...status, destination: status.destination || state.destination},
        versions: Array.isArray(versions) ? versions : (status.versions || []),
        course,
        config: config && typeof config === 'object' ? config : {},
        section: state.section,
      });
      state.destination = state.view.destination;
      state.gitRoot = state.view.settings.gitRoot;
      paint();
    } catch (error) {
      live(t('backup.msg.readFail', {error: error.message}), 'error');
    }
  }

  async function runBackup() {
    live(t('backup.msg.running'));
    try {
      const result = await api.rodar({reason: 'manual', label: ''});
      const pruned = Array.isArray(result.pruned) && result.pruned.length ? t('backup.msg.pruned', {count: result.pruned.length}) : '';
      live(t('backup.msg.done', {count: result.entries, size: formatBytes(result.bytes), pruned}), 'ok');
      await refresh();
    } catch (error) {
      live(t('backup.msg.runFail', {error: error.message}), 'error');
    }
  }

  async function pickDestination() {
    const folder = await api.escolherPasta();
    if (!folder) return;
    state.destination = folder;
    const input = find('#mesa-bkp-dest');
    if (input) input.value = folder;
    live(t('backup.msg.folderPicked'), 'ok');
  }

  async function pickGitRoot() {
    const folder = await api.escolherPasta();
    if (!folder) return;
    state.gitRoot = folder;
    const input = find('#mesa-bkp-gitroot');
    if (input) input.value = folder;
    live(t('backup.msg.gitFolderPicked'), 'ok');
  }

  async function saveSettings() {
    live(t('backup.msg.saving'));
    try {
      const patch = {...readSettings(), destination: state.destination};
      const saved = await api.definirConfig(patch);
      state.destination = saved.destination || state.destination;
      live(t('backup.msg.saved'), 'ok');
      await refresh();
    } catch (error) {
      live(t('backup.msg.saveFail', {error: error.message}), 'error');
    }
  }

  async function loadVersions() {
    live(t('backup.msg.reading'));
    try {
      const versions = await api.listar();
      state.view = {...state.view, versions: buildBackupPanelView({versions, section: 'restaurar', config: {}}).versions, versionCount: versions.length};
      paint();
      live(versions.length ? t('backup.msg.versions', {count: versions.length}) : t('backup.msg.noVersions'), versions.length ? 'ok' : 'error');
    } catch (error) {
      live(t('backup.msg.listFail', {error: error.message}), 'error');
    }
  }

  async function previewRestore(snapshotId) {
    live(t('backup.msg.checking'));
    try {
      const plan = await api.previaRestauracao(snapshotId);
      state.planId = plan.planId || '';
      const materials = Array.isArray(plan.materials) ? plan.materials : [];
      const remapDefault = materials.some((item) => item.stale || item.currentExists === false);
      const materialBlock = materials.length
        ? `<span>${t('backup.preview.materials')}</span>`
          + materials.map((item) => `<code>${escapeHtml(item.name || item.courseId || item.archiveBase || t('backup.preview.courseFallback'))}: ${escapeHtml(item.from || t('backup.preview.unknownOrigin'))} → ${escapeHtml(item.to || '')}${item.files ? t('backup.preview.files', {count: item.files}) : ''}${item.stale ? t('backup.preview.stale') : item.currentExists === false ? t('backup.preview.currentMissing') : ''}</code>`).join('')
          + `<label class="mesa-bkp-check"><input type="checkbox" id="mesa-bkp-remap" ${remapDefault ? 'checked' : ''}> ${t('backup.preview.remap')}</label>`
          + (Array.isArray(plan.materialsChanges) && plan.materialsChanges.length ? `<span class="mesa-bkp-warn">${t('backup.preview.remapChanges', {files: escapeHtml(plan.materialsChanges.join(', '))})}</span>` : '')
        : '';
      const box = find('[data-bkp-preview]');
      if (box) {
        box.classList.remove('mesa-bkp-hidden');
        box.innerHTML = `
          <strong>${t('backup.preview.heading', {id: escapeHtml(snapshotId)})}</strong>
          <span>${t('backup.preview.size', {count: plan.entries, size: formatBytes(plan.bytes), created: plan.snapshotCreated ? formatWhen(plan.snapshotCreated) : ''})}</span>
          <span>${t('backup.preview.changes', {replaced: plan.replaced?.length || 0, created: plan.created?.length || 0})}${plan.external?.length ? t('backup.preview.external', {count: plan.external.length}) : ''}</span>
          ${plan.binariesIncluded === false ? `<span class="mesa-bkp-warn">${t('backup.preview.noBinaries')}</span>` : ''}
          ${Array.isArray(plan.excluded) && plan.excluded.length ? `<span class="mesa-bkp-warn">${t('backup.preview.excluded', {count: plan.excluded.length})}</span>` : ''}
          ${materialBlock}
          ${plan.configAvailable ? `<label class="mesa-bkp-check"><input type="checkbox" id="mesa-bkp-restore-config"> ${t('backup.preview.restoreConfig')}</label>` : ''}
          <code>${escapeHtml([...(plan.replaced || []).slice(0, 12)].join('\\n'))}${(plan.replaced || []).length > 12 ? '\\n…' : ''}</code>
          <div class="mesa-bkp-row"><button type="button" data-bkp-act="aplicar" class="mesa-bkp-danger">${t('backup.preview.restoreNow')}</button></div>`;
      }
      live(t('backup.msg.previewReady'), 'ok');
    } catch (error) {
      live(t('backup.msg.previewFail', {error: error.message}), 'error');
    }
  }

  async function applyRestore() {
    if (!state.planId) return;
    const remap = !!find('#mesa-bkp-remap')?.checked;
    const ok = confirmar ? await confirmar(t('backup.msg.confirmRestore')) : true;
    if (!ok) {
      await api.cancelarRestauracao(state.planId).catch(() => {});
      live(t('backup.msg.restoreCancelled'), '');
      return;
    }
    live(t('backup.msg.restoring'));
    try {
      const options={materials: remap ? 'remap' : 'auto'};
      if(find('#mesa-bkp-restore-config'))options.restoreConfig=!!find('#mesa-bkp-restore-config').checked;
      const result = await api.aplicarRestauracao(state.planId, options);
      state.planId = '';
      const remapped = Array.isArray(result.materialsRemapped) && result.materialsRemapped.length ? t('backup.msg.remapped', {count: result.materialsRemapped.length}) : '';
      const warnings=Array.isArray(result.restoreWarnings)?result.restoreWarnings.join(' · '):'';
      live(t('backup.msg.restored', {count: result.written, remapped, kept: result.backupOfReplaced ? t('backup.msg.previousKept') : '', warnings: warnings ? ` ${warnings}` : ''}), warnings ? 'warn' : 'ok');
      await refresh();
    } catch (error) {
      live(t('backup.msg.restoreFail', {error: error.message}), 'error');
    }
  }

  async function pushGit() {
    live(t('backup.msg.pushing'));
    try {
      const result = await api.enviarGit();
      await refresh();
      if (result && result.pushed) {
        const root = state.view.settings.gitRoot || result.gitRoot || '';
        const remote = result.remote || state.view.settings.gitRemote || t('backup.msg.configuredRemote');
        live(t('backup.msg.pushOk', {root: root || t('backup.msg.localRepo'), remote, branch: result.branch ? ` (${result.branch})` : ''}), 'ok');
      } else {
        live(t('backup.msg.pushIncomplete', {reason: result?.error || result?.reason || t('backup.msg.noRemote')}), 'error');
      }
    } catch (error) {
      live(t('backup.msg.pushFail', {error: error.message}), 'error');
    }
  }

  async function exportCourse() {
    if (!state.destination) {
      live(t('backup.msg.pickBeforeExport'), 'error');
      return;
    }
    live(t('backup.msg.exporting'));
    try {
      const includeConversations = !!find('#mesa-bkp-conv')?.checked;
      const result = await api.exportar(state.destination, {conversations: includeConversations});
      live(t('backup.msg.exported', {file: result.file, size: formatBytes(result.bytes)}), 'ok');
    } catch (error) {
      live(t('backup.msg.exportFail', {error: error.message}), 'error');
    }
  }

  /* #140: escolhe o pacote e o destino, mas NÃO importa ainda — mostra a
     prévia (com a transcrição que o tutor vai ler) e espera o Importar. */
  async function importCourse() {
    const file = await api.escolherArquivo();
    if (!file) return;
    const folder = await api.escolherPasta();
    if (!folder) return;
    live(t('backup.msg.preparingImport'));
    try {
      const preview = await api.previaImportacao(file, folder);
      state.importPreview = {...preview, file, folder};
      state.importExpanded = false;
      live(t('backup.msg.importPreviewReady'), 'ok');
      paint();
    } catch (error) {
      state.importPreview = null;
      paintImportPreview();
      live(t('backup.msg.importFail', {error: error.message}), 'error');
    }
  }

  async function confirmImport() {
    if (!state.importPreview) return;
    const {file, folder} = state.importPreview;
    live(t('backup.msg.importing'));
    try {
      const result = await api.importar(file, folder);
      state.importPreview = null;
      state.importExpanded = false;
      paint();
      live(t('backup.msg.imported', {destination: result.destination, count: result.files}), 'ok');
      if (typeof options.aoImportar === 'function') options.aoImportar(result);
    } catch (error) {
      live(t('backup.msg.importFail', {error: error.message}), 'error');
    }
  }

  function cancelImport() {
    if (!state.importPreview) return;
    state.importPreview = null;
    state.importExpanded = false;
    paint();
    live('');
  }

  async function verifyVersion(snapshotId) {
    live(t('backup.msg.verifying'));
    try {
      const result = await api.verificar(snapshotId);
      live(result.ok ? t('backup.msg.intact', {count: result.checked}) : t('backup.msg.problem', {errors: result.errors.join('; ')}), result.ok ? 'ok' : 'error');
    } catch (error) {
      live(t('backup.msg.verifyFail', {error: error.message}), 'error');
    }
  }

  async function onClick(event) {
    const target2 = event.target?.closest?.('[data-bkp-act],[data-bkp-nav]');
    if (!target2) return;
    const nav = target2.getAttribute('data-bkp-nav');
    if (nav) {
      state.section = nav;
      state.view = {...state.view, section: nav};
      paint();
      return;
    }
    switch (target2.getAttribute('data-bkp-act')) {
      case 'fechar': fechar(); break;
      case 'salvar': await saveSettings(); break;
      case 'pasta': await pickDestination(); break;
      case 'pasta-git': await pickGitRoot(); break;
      case 'rodar': await runBackup(); break;
      case 'git-push': await pushGit(); break;
      case 'listar': await loadVersions(); break;
      case 'previa': await previewRestore(target2.getAttribute('data-bkp-id')); break;
      case 'aplicar': await applyRestore(); break;
      case 'exportar': await exportCourse(); break;
      case 'importar': await importCourse(); break;
      case 'importar-abrir': state.importExpanded = !state.importExpanded; paintImportPreview(); break;
      case 'importar-cancelar': cancelImport(); break;
      case 'importar-confirmar': await confirmImport(); break;
      case 'verificar': await verifyVersion(target2.getAttribute('data-bkp-id')); break;
      default: break;
    }
  }

  const onChange = (event) => {
    if (event.target?.id === 'mesa-bkp-git') {
      state.view = {...state.view, settings: {...state.view.settings, git: !!event.target.checked}};
      paint();
    }
    /* B1 (auditoria rodada 8): desligar o automático desabilita na hora os
       três ajustes que dependem dele ("a cada", "parada há", "guardar"); o
       valor salvo não muda, só a edição. */
    if (event.target?.id === 'mesa-bkp-auto') {
      const on = !!event.target.checked;
      state.view = {...state.view, settings: {...state.view.settings, auto: on}};
      for (const id of ['#mesa-bkp-intervalo', '#mesa-bkp-parado', '#mesa-bkp-guardar']) {
        const input = find(id);
        if (!input) continue;
        if (on) input.removeAttribute('disabled');
        else input.setAttribute('disabled', '');
      }
    }
  };

  dialog.addEventListener('click', (event) => {
    onClick(event).catch((error) => live(t('backup.msg.unexpected', {error: error.message}), 'error'));
  });
  dialog.addEventListener('change', onChange);
  const onKeydown = (event) => {
    if (event.key === 'Escape' && dialog.open) {
      event.preventDefault();
      fechar();
    }
  };
  dialog.addEventListener('keydown', onKeydown);
  const onLanguage = () => {
    if (dialog.open) {
      refresh();
      return;
    }
    state.view = buildBackupPanelView({section: state.section});
    paint();
  };
  documento.defaultView?.addEventListener(LANGUAGE_EVENT, onLanguage);

  /* `abrir` devolve a promise da atualização: quem chama `await` recebe o
     painel já pintado (o shell pode usar sem corrida; o clique não espera). */
  async function abrir(section = 'backup') {
    state.section = ['backup', 'restaurar', 'compartilhar'].includes(section) ? section : 'backup';
    state.view = {...state.view, section: state.section};
    paint();
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.open = true;
    await refresh();
  }
  function fechar() {
    if (!dialog.open) return;
    if (state.planId) {
      api.cancelarRestauracao(state.planId).catch(() => {});
      state.planId = '';
    }
    /* Fechar cancela a aprovação pendente: reabrir não importa sozinho. */
    state.importPreview = null;
    state.importExpanded = false;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.open = false;
  }
  function destroy() {
    dialog.removeEventListener('keydown', onKeydown);
    documento.defaultView?.removeEventListener(LANGUAGE_EVENT, onLanguage);
    dialog.remove();
  }

  paint();

  return {
    element: dialog,
    abrir,
    abrirBackup: () => abrir('backup'),
    abrirRestaurar: () => abrir('restaurar'),
    abrirCompartilhar: () => abrir('compartilhar'),
    fechar,
    atualizar: refresh,
    destroy,
    get estado() {
      return {...state};
    },
  };
}

export {BACKUP_PANEL_CSS_ID} from './backup-panel-style.mjs';
export const BACKUP_PANEL_DIALOG_ID = DIALOG_ID;
