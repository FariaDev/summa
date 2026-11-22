// @ts-check
/* Plano de estudo na barra de cima (#110): o gatilho "Plano · agora: …" ao lado
   de Caderno e GeoGebra, e a lista suspensa da matéria aberta (tarefas editáveis
   no lugar e o bloco de Anotações). As regras estão em `study-plan.mjs`; aqui
   só o DOM e os eventos. O gatilho e a lista são o `#study-plan-menu` do
   index.html: o clique fora e o fechamento com os outros menus são do
   `nav-menus.mjs`. */
import {$, S, save, pageRefs, toast} from '../state.mjs';
import {setMenuOpen} from '../nav-menus.mjs';
import {openRef} from '../nav-loader.mjs';
import {FREE_COURSE_ID} from './free-study-base.mjs';
import {icon} from '../../icons.mjs';
import {t} from '../ui-text.mjs';
import * as plan from './study-plan.mjs';

/** @typedef {{id: string, action: string}} FocusTarget controle a focar depois de repintar (`data-id` + `data-action`) */

/** @type {HTMLElement | null} */
let menu = null;
/** @type {HTMLElement | null} */
let pop = null;

/**
 * O Plano vale só numa matéria: no Livre e sem matéria o gatilho some.
 * @returns {boolean}
 * @example planAvailable() // false no Livre
 */
function planAvailable() {
  return Boolean(S.currentCourseId) && S.currentCourseId !== FREE_COURSE_ID && S.workspace?.kind !== 'free';
}

/**
 * Cria um elemento. Texto entra como nó de texto; `value` e `checked` são
 * propriedades (o valor do usuário nunca vira HTML).
 * @param {string} tag
 * @param {Record<string, string | boolean | number>} [props]
 * @param {Array<Node | string | null | undefined | false>} [children]
 * @returns {HTMLElement}
 * @example make('button', {type: 'button', 'data-action': 'add'}, 'Nova tarefa')
 */
function make(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'value' || key === 'checked') Object.assign(node, {[key]: value});
    else node.setAttribute(key, String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

/**
 * Ícone do host dentro de um nó (o SVG é constante do `icons.mjs`).
 * @param {string} name
 * @returns {HTMLElement}
 * @example iconNode('close')
 */
function iconNode(name) {
  const span = make('span', {class: 'study-plan-icon', 'aria-hidden': 'true'});
  span.innerHTML = icon(name);
  return span;
}

/** @param {string} path @returns {string} só o nome do arquivo */
function baseName(path) {
  return path.split(/[\\/]/).pop() || path;
}

/**
 * Pinta o gatilho: o rótulo e o "agora" (a primeira tarefa não marcada).
 * @returns {void}
 * @example paintTrigger()
 */
function paintTrigger() {
  if (!menu) return;
  menu.hidden = !planAvailable();
  const cur = plan.studyPlanSnapshot();
  const now = cur.tasks.find((task) => task.id === plan.currentTaskId(cur));
  const label = menu.querySelector('.study-plan-now');
  if (label) label.textContent = now ? ` ${t('plan.now', {text: now.text})}` : '';
}

/**
 * Uma tool de linha (subir, descer, apagar): ícone com nome acessível.
 * @param {string} action
 * @param {string} key chave do catálogo do rótulo
 * @param {string} iconName
 * @param {string} id
 * @returns {HTMLElement}
 */
function toolButton(action, key, iconName, id) {
  const label = t(key);
  const button = make('button', {type: 'button', class: `study-plan-tool ${action}`, 'data-action': action, 'data-id': id, title: label, 'aria-label': label});
  button.append(iconNode(iconName));
  return button;
}

/**
 * Uma linha de tarefa: caixa, texto editável no lugar, PDF e página quando ligados, e as tools.
 * @param {plan.PlanTask} task
 * @param {string} nowId
 * @returns {HTMLElement}
 */
function taskRow(task, nowId) {
  const classes = ['study-plan-row', task.done ? 'done' : '', task.id === nowId ? 'now' : ''].filter(Boolean).join(' ');
  const meta = [];
  if (task.pdf) {
    meta.push(make('span', {class: 'study-plan-ref'}, [t('plan.linked', {name: baseName(task.pdf), page: task.page})]));
    meta.push(make('button', {type: 'button', 'data-action': 'open', 'data-id': task.id}, [t('plan.open')]));
  }
  if (pageRefs().length) meta.push(make('button', {type: 'button', 'data-action': 'link', 'data-id': task.id}, [t(task.pdf ? 'plan.relink' : 'plan.link')]));
  if (task.pdf) meta.push(make('button', {type: 'button', 'data-action': 'unlink', 'data-id': task.id}, [t('plan.unlink')]));
  return make('div', {class: classes}, [
    make('input', {type: 'checkbox', checked: task.done, 'data-action': 'done', 'data-id': task.id, 'aria-label': t('plan.done')}),
    make('div', {class: 'study-plan-main'}, [
      make('input', {type: 'text', class: 'study-plan-text', value: task.text, maxlength: String(plan.PLAN_LIMITS.text), 'data-action': 'text', 'data-id': task.id, 'aria-label': t('plan.task')}),
      make('div', {class: 'study-plan-meta'}, meta),
    ]),
    make('div', {class: 'study-plan-tools'}, [
      toolButton('up', 'plan.up', 'arrowUp', task.id),
      toolButton('down', 'plan.down', 'arrowUp', task.id),
      toolButton('remove', 'plan.remove', 'close', task.id),
    ]),
  ]);
}

/**
 * Repinta a lista suspensa inteira (tarefas, contagem, Anotações).
 * @returns {void}
 * @example renderPop()
 */
function renderPop() {
  if (!pop) return;
  const cur = plan.studyPlanSnapshot();
  const done = cur.tasks.filter((task) => task.done).length;
  const nowId = plan.currentTaskId(cur);
  const notes = make('textarea', {'data-action': 'notes', rows: '4', maxlength: String(plan.PLAN_LIMITS.notes), 'aria-label': t('plan.notes')});
  /** @type {HTMLTextAreaElement} */ (notes).value = cur.notes;
  pop.replaceChildren(
    make('div', {class: 'study-plan-head'}, [
      make('span', {}, [t('plan.title')]),
      cur.tasks.length ? make('span', {class: 'study-plan-count'}, [t('plan.count', {done, total: cur.tasks.length})]) : null,
    ]),
    make('div', {class: 'study-plan-list'}, cur.tasks.map((task) => taskRow(task, nowId))),
    make('button', {type: 'button', class: 'study-plan-add', 'data-action': 'add'}, [t('plan.add')]),
    make('div', {class: 'study-plan-notes'}, [make('span', {class: 'study-plan-label'}, [t('plan.notes')]), notes]),
  );
}

/**
 * Leva o foco ao controle pedido, se ele existe depois da repintura.
 * @param {FocusTarget | null} target
 * @returns {void}
 * @example focusControl({id: 'a', action: 'text'})
 */
function focusControl(target) {
  if (!pop || !target) return;
  const idPart = target.id ? `[data-id="${CSS.escape(target.id)}"]` : '';
  /** @type {HTMLElement | null} */
  const node = pop.querySelector(`[data-action="${target.action}"]${idPart}`);
  node?.focus();
}

/** @param {HTMLElement} node @returns {FocusTarget} */
function focusOf(node) {
  return {id: node.dataset.id || '', action: node.dataset.action || ''};
}

/**
 * Grava o plano e repinta tudo; o foco volta ao controle `focus`.
 * @param {plan.StudyPlan} next
 * @param {FocusTarget | null} [focus]
 * @returns {void}
 * @example commitPlan(addTask(cur), {id: 'x', action: 'text'})
 */
function commitPlan(next, focus = null) {
  plan.setStudyPlan(next);
  save();
  paintTrigger();
  renderPop();
  focusControl(focus);
}

/**
 * Cria uma tarefa vazia depois de `afterId` (ou no fim) e leva o foco a ela.
 * @param {string} afterId
 * @returns {void}
 * @example addTaskAt('')
 */
function addTaskAt(afterId) {
  const id = plan.newTaskId();
  const cur = plan.studyPlanSnapshot();
  commitPlan(plan.addTask(cur, {afterId, id}), {id, action: 'text'});
}

/** @param {string} id @returns {plan.PlanTask | undefined} */
function taskOf(id) {
  return plan.studyPlanSnapshot().tasks.find((task) => task.id === id);
}

/**
 * Liga a tarefa ao PDF e à página abertos agora (sem seletor novo nesta versão).
 * @param {string} id
 * @returns {void}
 * @example linkToOpenPdf('a')
 */
function linkToOpenPdf(id) {
  const ref = pageRefs()[0];
  if (!ref) return;
  commitPlan(plan.linkTask(plan.studyPlanSnapshot(), id, {pdf: ref.path, page: ref.page}), {id, action: 'link'});
}

/**
 * Desliga a tarefa do PDF. O foco vai para "ligar ao PDF aberto" se há PDF
 * aberto (o "desligar" some); senão, para o texto da tarefa.
 * @param {string} id
 * @returns {void}
 * @example unlinkFromPdf('a')
 */
function unlinkFromPdf(id) {
  const focus = pageRefs().length ? {id, action: 'link'} : {id, action: 'text'};
  commitPlan(plan.unlinkTask(plan.studyPlanSnapshot(), id), focus);
}

/**
 * Abre o PDF da tarefa na página dela e fecha a lista.
 * @param {string} id
 * @returns {void}
 * @example openTaskPage('a')
 */
function openTaskPage(id) {
  const task = taskOf(id);
  if (!task?.pdf || !menu) return;
  setMenuOpen(menu, false);
  openRef(baseName(task.pdf), task.page, task.pdf).catch((error) => toast(error.message));
}

/**
 * Subir, descer, apagar: reordena ou tira a tarefa e leva o foco ao vizinho.
 * @param {string} action
 * @param {string} id
 * @returns {void}
 * @example moveOrRemove('down', 'a')
 */
function moveOrRemove(action, id) {
  const cur = plan.studyPlanSnapshot();
  if (action === 'remove') {
    const {plan: next, focusId} = plan.removeTaskAt(cur, id);
    commitPlan(next, focusId ? {id: focusId, action: 'text'} : {id: '', action: 'add'});
    return;
  }
  commitPlan(plan.moveTask(cur, id, action === 'up' ? -1 : 1), {id, action});
}

/**
 * Cliques da lista: os botões de linha e o "Nova tarefa".
 * @param {Event} event
 * @returns {void}
 */
function onPopClick(event) {
  const button = /** @type {HTMLElement} */ (event.target)?.closest?.('button[data-action]');
  if (!(button instanceof HTMLElement)) return;
  const action = button.dataset.action || '';
  const id = button.dataset.id || '';
  if (action === 'add') addTaskAt('');
  else if (action === 'link') linkToOpenPdf(id);
  else if (action === 'open') openTaskPage(id);
  else if (action === 'unlink') unlinkFromPdf(id);
  else if (action === 'up' || action === 'down' || action === 'remove') moveOrRemove(action, id);
}

/**
 * Caixa de marcar: o "agora" anda. Anotações e texto não passam por aqui.
 * @param {Event} event
 * @returns {void}
 */
function onPopChange(event) {
  const box = /** @type {HTMLInputElement} */ (event.target);
  if (box?.dataset.action !== 'done') return;
  const cur = plan.studyPlanSnapshot();
  commitPlan(plan.setTaskDone(cur, box.dataset.id || '', box.checked), focusOf(box));
}

/**
 * Digitação: texto da tarefa e Anotações gravam sem repintar a lista (o cursor fica).
 * @param {Event} event
 * @returns {void}
 */
function onPopInput(event) {
  const field = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (event.target);
  const cur = plan.studyPlanSnapshot();
  if (field?.dataset.action === 'text') plan.setStudyPlan(plan.editTask(cur, field.dataset.id || '', field.value));
  else if (field?.dataset.action === 'notes') plan.setStudyPlan(plan.setNotes(cur, field.value));
  else return;
  save();
  paintTrigger();
}

/**
 * Enter cria a tarefa seguinte; Backspace em texto vazio a remove; Esc fecha.
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function onPopKey(event) {
  const field = /** @type {HTMLElement} */ (event.target);
  if (field?.dataset.action !== 'text') return;
  const id = field.dataset.id || '';
  if (event.key === 'Enter') {
    event.preventDefault();
    addTaskAt(id);
  } else if (event.key === 'Backspace') {
    const result = plan.removeEmptyTask(plan.studyPlanSnapshot(), id);
    if (!result.removed) return;
    event.preventDefault();
    commitPlan(result.plan, result.focusId ? {id: result.focusId, action: 'text'} : {id: '', action: 'add'});
  } else if (event.key === 'Escape' && menu) {
    setMenuOpen(menu, false, {blur: true});
  }
}

/**
 * Liga a lista e os avisos de troca de matéria. Chamado uma vez no boot, pelo
 * `initHeaderTabs`.
 * @returns {void}
 * @example initStudyPlanView()
 */
export function initStudyPlanView() {
  menu = $('#study-plan-menu');
  pop = $('#study-plan-pop');
  if (!menu || !pop) return;
  /* O ícone do gatilho vem do `icons.mjs`, como o do GeoGebra; o HTML só reserva o lugar. */
  const triggerIcon = menu.querySelector('.study-plan-trigger .study-plan-icon');
  if (triggerIcon && !triggerIcon.firstChild) triggerIcon.innerHTML = icon('listChecks');
  pop.addEventListener('click', onPopClick);
  pop.addEventListener('change', onPopChange);
  pop.addEventListener('input', onPopInput);
  pop.addEventListener('keydown', onPopKey);
  /* Trocar o idioma repinta o Plano: a lista já desenhada guardava o texto antigo (#110). */
  window.addEventListener('desk-language', () => {
    paintTrigger();
    renderPop();
  });
  window.addEventListener('desk-study-plan-changed', () => {
    paintTrigger();
    renderPop();
  });
  paintTrigger();
  renderPop();
}
