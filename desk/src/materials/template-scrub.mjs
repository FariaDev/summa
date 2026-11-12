// @ts-check
/* Tira a língua do CSS do template do HTML cru do modelo ANTES de
   `structureMaterialTokens` acrescentar os envoltórios da casa (quarta
   contraprova, #seg-markup). O `class="pdf-resposta"` forjado com
   `--ans:200mm` lia `height:var(--ans,36mm)` e abria 34 páginas; o
   `class="pdf-run"` forjado caía no `display:none` do impresso e escondia no
   papel o texto que a prévia mostrava; o `class="pdf-title"` forjado sumia no
   `display:none` da lista. `--ans` só existe quando a casa o gera
   (`structure.mjs`, validado em `template-sanitize.mjs`), então tirar os dois
   do modelo fecha a classe inteira de uma vez — nenhuma outra classe forjada
   (`pdf-q`, `pdf-gabarito`, `pdf-def`, `pdf-regra`, `pdf-cols`, `hl`…)
   encontra mais regra. `id` fica (contrato do H1 cru, com teste próprio) e o
   resto do `style` segue para o `sanitizePrintHtml`. Roda sobre os tokens do
   `marked` (o código cercado é token `code`, não `html`, e não é tocado); o
   parser decide o que é elemento, como em `model-attrs.mjs`. Precisa de DOM. */

import {cssomDeclarations} from '../figures/svg-guard.mjs';

function scrubModelStyle(style) {
  const parsed = typeof cssomDeclarations === 'function' ? cssomDeclarations(style) : null;
  if (!parsed) return String(style ?? '');
  const out = [];
  for (const {property, value, important} of parsed) {
    if (String(property).toLowerCase() === '--ans') continue;
    const text = String(value).trim();
    if (!text) continue;
    out.push(`${property}:${text}${important ? ' !important' : ''}`);
  }
  return out.join(';');
}

/* Índice do `<` que abre a tag que fica sem `>` no fim do token, ou -1. O
   estado do atributo importa: aspa só abre valor depois de `=` (o `1"` de um
   nome de atributo não é aspa), senão um token completo com `a="…"` seria
   tratado como incompleto. */
function incompleteTagStart(source) {
  let open = -1;
  let quote = '';
  let afterEquals = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (open < 0) {
      if (char === '<') open = index;
      continue;
    }
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '>') {
      open = -1;
      afterEquals = false;
    } else if (char === '=') {
      afterEquals = true;
    } else if (afterEquals && (char === '"' || char === "'")) {
      quote = char;
      afterEquals = false;
    } else if (afterEquals && !/\s/.test(char)) {
      afterEquals = false;
    }
  }
  return open;
}

/* Tag incompleta no EOF do token (`<div class="pdf-run" data-pdf-house-`) some
   do `<template>` (o parser descarta o token), mas no HTML concatenado do
   `marked` ela continua até o `>` da tag seguinte e engole os atributos da
   casa — inclusive a marca sorteada, que faz a allowlist da prévia poupar o
   elemento (#216). Escapa o `<` da cauda sem `>` antes de devolver: a tag
   incompleta vira texto e não abre elemento na junção. */
function escapeIncompleteTag(source) {
  const open = incompleteTagStart(source);
  if (open < 0) return source;
  return source.slice(0, open) + source.slice(open).replace(/</g, '&lt;');
}

function scrubModelFragment(fragment) {
  const source = String(fragment);
  /* Caminho barato e sem normalização: sem `class`/`--ans` no texto, o HTML
     honesto (`<details open>`, tabela crua) volta byte a byte — a foto honesta
     (`markup-attrs-honest.json`) não muda. Mesmo aqui a tag incompleta é
     escapada: ela não abre elemento sozinha, mas abriria na junção (#216). */
  if (!/class|--ans/i.test(source)) return escapeIncompleteTag(source);
  const holder = document.createElement('template');
  holder.innerHTML = source;
  let changed = false;
  const scrubRoot = (root) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.hasAttribute('class')) {
        element.removeAttribute('class');
        changed = true;
      }
      if (element.hasAttribute('style')) {
        const kept = scrubModelStyle(element.getAttribute('style') ?? '');
        if (!kept) element.removeAttribute('style');
        else element.setAttribute('style', kept);
        changed = true;
      }
      if (element instanceof HTMLTemplateElement) scrubRoot(element.content);
    }
  };
  scrubRoot(holder.content);
  return escapeIncompleteTag(changed ? holder.innerHTML : source);
}

function scrubModelToken(token) {
  if (!token || typeof token !== 'object') return;
  if (token.type === 'html' && typeof token.text === 'string') token.text = scrubModelFragment(token.text);
  if (Array.isArray(token.tokens)) for (const child of token.tokens) scrubModelToken(child);
  if (Array.isArray(token.items)) for (const item of token.items) scrubModelToken(item);
  if (Array.isArray(token.header)) for (const cell of token.header) scrubModelToken(cell);
  if (Array.isArray(token.rows)) {
    for (const row of token.rows) {
      if (Array.isArray(row)) for (const cell of row) scrubModelToken(cell);
    }
  }
}

/**
 * Tokens do `marked` sem a língua do CSS do template no HTML cru do modelo:
 * `class` some e `--ans` sai do `style` (a casa gera os dois depois). Precisa
 * de DOM (o caminho real roda no Electron); sem DOM devolve os tokens
 * intactos em vez de fingir.
 * @param {Array} tokens lista do `marked.lexer`, com o HTML cru do modelo
 * @returns {Array} a mesma lista, com o HTML do modelo sem `class`/`--ans`
 * @example scrubModelTokens([{type:'html',text:'<div class="pdf-run">x</div>'}])
 * // [{type:'html',text:'<div>x</div>'}]
 */
export function scrubModelTokens(tokens) {
  if (!Array.isArray(tokens) || typeof document === 'undefined') return tokens;
  for (const token of tokens) scrubModelToken(token);
  return tokens;
}
