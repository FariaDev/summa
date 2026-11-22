// @ts-check
/* Plano de estudo da matéria (#110): tarefas com caixa de marcar, um PDF e uma
   página opcionais, e um bloco de Anotações livre. Fica em JS com teste, sem
   núcleo Bend (ADR 0003): nenhuma regra aqui custa algo ao aluno que o código
   não diga. Este arquivo é a fonte única: o renderer usa as funções e o main
   (CJS) carrega `sanitizeStudyPlan` por `require`, como faz com `model-picker`.

   Regras: o "agora" é a primeira tarefa não marcada, na ordem da lista; marcar
   avança o "agora"; Enter cria a tarefa seguinte; Backspace em tarefa vazia a
   remove; subir e descer reordenam. Cada operação devolve um plano novo. */

/** Teto de cada campo. O `sanitizeStudyPlan` do main usa o mesmo objeto: mudar aqui muda o saneador. */
export const PLAN_LIMITS = Object.freeze({tasks: 200, text: 500, notes: 20000, pdf: 4096, page: 99999, id: 64});

/** @typedef {{id: string, text: string, done: boolean, pdf: string, page: number}} PlanTask */
/** @typedef {{tasks: PlanTask[], notes: string}} StudyPlan */

/**
 * Plano vazio: nenhuma tarefa e Anotações em branco.
 * @returns {StudyPlan}
 * @example emptyStudyPlan() // {tasks: [], notes: ''}
 */
export function emptyStudyPlan() {
  return {tasks: [], notes: ''};
}

/**
 * Id novo de tarefa, curto e único o bastante para uma matéria.
 * @returns {string}
 * @example newTaskId() // 'lq3k9x2ab12c'
 */
export function newTaskId() {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* Texto que não é string vira vazio: um número no `desk.json` não pode virar
   anotação nem nome de tarefa. */
/** @param {unknown} value @param {number} max */
function clip(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** @param {number} page @returns {number} página inteira entre 1 e o teto */
function clampPage(page) {
  return Math.min(PLAN_LIMITS.page, Math.max(1, Math.trunc(Number(page) || 1)));
}

/** @param {StudyPlan} plan @param {string} id */
function indexOfTask(plan, id) {
  return plan.tasks.findIndex((task) => task.id === id);
}

/** @param {StudyPlan} plan @param {string} id @param {Partial<PlanTask>} patch */
function patchTask(plan, id, patch) {
  const index = indexOfTask(plan, id);
  if (index < 0) return plan;
  const tasks = plan.tasks.slice();
  tasks[index] = {...tasks[index], ...patch};
  return {...plan, tasks};
}

/**
 * O "agora": a primeira tarefa não marcada, na ordem da lista.
 * @param {StudyPlan} plan
 * @returns {string} id da tarefa, ou '' quando tudo está marcado (ou não há tarefa)
 * @example currentTaskId({tasks: [{id: 'a', text: 'Q1', done: true, pdf: '', page: 0}, {id: 'b', text: 'Q2', done: false, pdf: '', page: 0}], notes: ''}) // 'b'
 */
export function currentTaskId(plan) {
  return plan.tasks.find((task) => !task.done)?.id ?? '';
}

/**
 * Tarefa nova no fim da lista, ou logo depois de `afterId` (Enter no texto).
 * @param {StudyPlan} plan
 * @param {{afterId?: string, id?: string, text?: string}} [options]
 * @returns {StudyPlan} o mesmo plano se já estiver no teto de tarefas
 * @example addTask(emptyStudyPlan(), {id: 'a', text: 'Q1'}).tasks[0].text // 'Q1'
 */
export function addTask(plan, {afterId = '', id = newTaskId(), text = ''} = {}) {
  if (plan.tasks.length >= PLAN_LIMITS.tasks) return plan;
  const index = indexOfTask(plan, afterId);
  const task = {id: clip(id, PLAN_LIMITS.id), text: clip(text, PLAN_LIMITS.text), done: false, pdf: '', page: 0};
  const tasks = plan.tasks.slice();
  tasks.splice(index < 0 ? tasks.length : index + 1, 0, task);
  return {...plan, tasks};
}

/**
 * Troca o texto de uma tarefa (edição no lugar; sem diálogo) e reduz quebras
 * de linha a espaços.
 * @param {StudyPlan} plan
 * @param {string} id
 * @param {string} text
 * @returns {StudyPlan}
 * @example editTask(plan, 'a', 'Q1 corrigida').tasks[0].text
 */
export function editTask(plan, id, text) {
  return patchTask(plan, id, {text: clip(text.replace(/\s*[\r\n]+\s*/g, ' '), PLAN_LIMITS.text)});
}

/**
 * Marca ou desmarca uma tarefa pela caixa.
 * @param {StudyPlan} plan
 * @param {string} id
 * @param {boolean} done
 * @returns {StudyPlan}
 * @example setTaskDone(plan, 'a', true) // o "agora" passa para a próxima
 */
export function setTaskDone(plan, id, done) {
  return patchTask(plan, id, {done: done === true});
}

/**
 * Tira a tarefa e diz para onde o foco vai: a anterior, ou a seguinte.
 * @param {StudyPlan} plan
 * @param {string} id
 * @returns {{plan: StudyPlan, focusId: string}} `focusId` é '' quando não sobrou tarefa
 * @example removeTaskAt(plan, 'b') // {plan: ..., focusId: 'a'}
 */
export function removeTaskAt(plan, id) {
  const index = indexOfTask(plan, id);
  if (index < 0) return {plan, focusId: ''};
  const neighbour = plan.tasks[index - 1] ?? plan.tasks[index + 1];
  return {plan: {...plan, tasks: plan.tasks.filter((task) => task.id !== id)}, focusId: neighbour?.id ?? ''};
}

/**
 * Backspace em tarefa sem texto: remove e devolve o foco. Com texto (mesmo
 * que só de espaços não conte) a tarefa fica como está.
 * @param {StudyPlan} plan
 * @param {string} id
 * @returns {{plan: StudyPlan, focusId: string, removed: boolean}}
 * @example removeEmptyTask(plan, 'b').removed // true se 'b' estava vazia
 */
export function removeEmptyTask(plan, id) {
  const task = plan.tasks.find((entry) => entry.id === id);
  if (!task || task.text.trim() !== '') return {plan, focusId: id, removed: false};
  return {...removeTaskAt(plan, id), removed: true};
}

/**
 * Sobe (-1) ou desce (+1) uma tarefa. Nas pontas da lista, não faz nada.
 * @param {StudyPlan} plan
 * @param {string} id
 * @param {-1 | 1} step
 * @returns {StudyPlan}
 * @example moveTask(plan, 'b', -1) // 'b' vai para antes de 'a'
 */
export function moveTask(plan, id, step) {
  const from = indexOfTask(plan, id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= plan.tasks.length) return plan;
  const tasks = plan.tasks.slice();
  [tasks[from], tasks[to]] = [tasks[to], tasks[from]];
  return {...plan, tasks};
}

/**
 * Liga a tarefa a um PDF e uma página (o "ligar ao PDF aberto"). Sem PDF, desliga.
 * @param {StudyPlan} plan
 * @param {string} id
 * @param {{pdf?: string, page?: number}} [target]
 * @returns {StudyPlan}
 * @example linkTask(plan, 'a', {pdf: '/m/Lista.pdf', page: 2})
 */
export function linkTask(plan, id, {pdf = '', page = 1} = {}) {
  return patchTask(plan, id, pdf ? {pdf: clip(pdf, PLAN_LIMITS.pdf), page: clampPage(page)} : {pdf: '', page: 0});
}

/**
 * Desliga a tarefa do PDF ("desligar do PDF"): tira o caminho e a página. A
 * tarefa volta a oferecer "ligar ao PDF aberto"; as outras não mudam.
 * @param {StudyPlan} plan
 * @param {string} id
 * @returns {StudyPlan}
 * @example unlinkTask(plan, 'a').tasks[0].pdf // ''
 */
export function unlinkTask(plan, id) {
  return patchTask(plan, id, {pdf: '', page: 0});
}

/**
 * Troca o bloco de Anotações.
 * @param {StudyPlan} plan
 * @param {string} notes
 * @returns {StudyPlan}
 * @example setNotes(plan, 'Prova sexta').notes
 */
export function setNotes(plan, notes) {
  return {...plan, notes: clip(notes, PLAN_LIMITS.notes)};
}

/**
 * Saneia o plano que vem do `desk.json` ou do `save-state`. Forma inválida cai
 * em vazio; tarefa sem id some; id repetido fica só o primeiro; um PDF só
 * sobrevive se `allowed` o conhece (o que a Mesa já autorizou), como o `pdfs`.
 * @param {unknown} value
 * @param {{allowed?: Set<string>}} [options] sem `allowed` (leitura do disco) o PDF fica
 * @returns {StudyPlan}
 * @example sanitizeStudyPlan({tasks: [{id: 'a', text: 'Q1', pdf: '/x.pdf', page: 3}]}, {allowed: new Set()}).tasks[0].pdf // ''
 */
export function sanitizeStudyPlan(value, {allowed} = {}) {
  const source = value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {};
  const entries = Array.isArray(source.tasks) ? source.tasks : [];
  const seen = new Set();
  const tasks = [];
  for (const entry of entries) {
    if (tasks.length >= PLAN_LIMITS.tasks) break;
    const task = sanitizeTask(entry, allowed);
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(task);
  }
  return {tasks, notes: clip(source.notes, PLAN_LIMITS.notes)};
}

/** @param {unknown} entry @param {Set<string> | undefined} allowed @returns {PlanTask | null} */
function sanitizeTask(entry, allowed) {
  if (!entry || typeof entry !== 'object') return null;
  const raw = /** @type {Record<string, unknown>} */ (entry);
  if (typeof raw.id !== 'string' || !raw.id) return null;
  const pdf = clip(raw.pdf, PLAN_LIMITS.pdf);
  const linked = pdf !== '' && (!allowed || allowed.has(pdf));
  const page = Number.isInteger(raw.page) ? clampPage(/** @type {number} */ (raw.page)) : 1;
  return {
    id: clip(raw.id, PLAN_LIMITS.id),
    text: clip(raw.text, PLAN_LIMITS.text),
    done: raw.done === true,
    pdf: linked ? pdf : '',
    page: linked ? page : 0,
  };
}

/** Plano da matéria aberta. Não se muda por dentro: as operações devolvem um plano novo. */
let current = emptyStudyPlan();

/**
 * O plano em uso (o que o `save-state` leva ao main).
 * @returns {StudyPlan}
 * @example studyPlanSnapshot().tasks.length
 */
export function studyPlanSnapshot() {
  return current;
}

/**
 * Troca o plano em uso sem validar (quem chama já tem um plano).
 * @param {StudyPlan} next
 * @returns {void}
 * @example setStudyPlan(addTask(studyPlanSnapshot()))
 */
export function setStudyPlan(next) {
  current = next;
}

/**
 * Carrega o plano da matéria aberta (troca de matéria ou boot). Forma que não
 * é plano cai no vazio.
 * @param {unknown} value
 * @returns {void}
 * @example loadStudyPlan(data.state.studyPlan)
 */
export function loadStudyPlan(value) {
  current = sanitizeStudyPlan(value);
}
