// @ts-check
'use strict';

/* O modelo que pode ler a tinta do caderno (#158), peça pura: o modelo
   escolhido pelo aluno no OpenCode só serve se o catálogo diz que ele recebe
   imagem na entrada — a mesma regra de "visão" do seletor
   (`desk/src/model-picker.mjs`) — e se não é o grátis do Zen, que o catálogo
   marca pelo custo zero (o `firstCost` de `opencode-catalog.cjs`). Sem
   leitura comprovada, o índice fica só com o texto digitado; o motivo volta
   para a interface dizer isso. Sem rede, sem timer, sem IPC. */

const {normalizeSelection, parseModelKey, findModel} = require('./src/agents/opencode-catalog.cjs');
const {factsOf} = require('./src/model-picker.mjs');

/**
 * @typedef {'no-model'|'no-vision'|'free'} InkModelReason
 * @typedef {{model: string|null, effort: string|null, reason: InkModelReason|null}} InkModelPick
 */

/** Custo zero no catálogo: o grátis do Zen (`cost` de `sanitizeModel`). */
function isFreeModel(model) {
  const cost = /** @type {{cost?: unknown}} */ (model).cost;
  if (!cost || typeof cost !== 'object') return false;
  const {input, output} = /** @type {{input?: unknown, output?: unknown}} */ (cost);
  return Number.isFinite(input) && Number.isFinite(output) && input === 0 && output === 0;
}

/**
 * O modelo do aluno que pode ler a tinta de uma página do caderno, ou o
 * motivo de não poder. `model` volta com a escolha quando `reason` é `null`;
 * `effort` é o esforço verificado nas variantes do modelo, para a ponte usar
 * exatamente o que foi conferido (nunca a seleção viva, #158/M3).
 * @param {{model?: unknown, effort?: unknown}|null} selection escolha guardada (`provider/id`)
 * @param {import('./src/agents/opencode-catalog.cjs').CatalogModel[]} catalog catálogo sanitizado do `/api/model`
 * @returns {InkModelPick}
 * @example selectInkModel({model: 'xai/grok-vision'}, catalog) // {model: 'xai/grok-vision', effort: null, reason: null}
 * @example selectInkModel({model: 'opencode/big-pickle'}, catalog) // {model: null, effort: null, reason: 'free'}
 */
function selectInkModel(selection, catalog) {
  const wanted = normalizeSelection(selection);
  if (!wanted.model) return {model: null, effort: null, reason: 'no-model'};
  const parsed = parseModelKey(wanted.model);
  const model = parsed ? findModel(Array.isArray(catalog) ? catalog : [], parsed) : null;
  if (!model) return {model: null, effort: null, reason: 'no-model'};
  if (!factsOf(model, false).vision) return {model: null, effort: null, reason: 'no-vision'};
  /* Sem `cost`, segue como pago: o grátis do Zen sempre traz custo zero no
     catálogo sanitizado (`opencode-catalog.cjs:123-124`) e a leitura é opt-in. */
  if (isFreeModel(model)) return {model: null, effort: null, reason: 'free'};
  /* Só o esforço que o catálogo declara para ESTE modelo vai para a ponte. */
  const effort = wanted.effort && Array.isArray(model.variants) && model.variants.includes(wanted.effort) ? wanted.effort : null;
  return {model: wanted.model, effort, reason: null};
}

module.exports = {selectInkModel};
