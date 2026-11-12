import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {DRAFT_TTL_MS, MAX_DRAFTS, isDraftId, createActivityPreviewDrafts} = require('../activity-preview-drafts.cjs');

const CONTENT = {html: '<p>x</p>', css: 'p{color:red}', js: 'mesa.ready();', katex: false, kind: 'visualizacao', charts: true, title: 'não entra', objective: 'não entra'};

test('rascunho: id opaco, conteúdo da prévia e escopo da conversa', () => {
  const drafts = createActivityPreviewDrafts();
  const id = drafts.remember({conversationId: 'conversa-a'}, CONTENT);
  assert.equal(isDraftId(id), true);
  assert.match(id, /^prv-[a-z0-9]{8,24}$/);
  const content = drafts.resolve({conversationId: 'conversa-a'}, id);
  assert.deepEqual(content, {html: CONTENT.html, css: CONTENT.css, js: CONTENT.js, katex: false, kind: 'visualizacao', charts: true});
  assert.equal(drafts.resolve({conversationId: 'conversa-b'}, id), null, 'não cruza conversa');
  assert.equal(drafts.resolve({conversationId: 'conversa-a'}, 'inventado'), null);
  assert.equal(drafts.size(), 1);
});

test('rascunho: 30 minutos por padrão e o mais antigo sai quando o teto aperta', () => {
  let clock = 1000;
  const drafts = createActivityPreviewDrafts({ttlMs: 100, max: 2, now: () => clock});
  const first = drafts.remember({conversationId: 'c'}, CONTENT);
  clock += 50;
  const second = drafts.remember({conversationId: 'c'}, CONTENT);
  clock += 50;
  const third = drafts.remember({conversationId: 'c'}, CONTENT);
  assert.equal(drafts.resolve({conversationId: 'c'}, first), null, 'o mais antigo saiu');
  assert.notEqual(drafts.resolve({conversationId: 'c'}, second), null);
  assert.notEqual(drafts.resolve({conversationId: 'c'}, third), null);
  clock += 101;
  assert.equal(drafts.resolve({conversationId: 'c'}, second), null, 'venceu');
  drafts.clear();
  assert.equal(drafts.size(), 0);
  assert.equal(DRAFT_TTL_MS, 30 * 60 * 1000, 'meia hora cobre montar, pré-visualizar e corrigir');
  assert.ok(MAX_DRAFTS >= 8);
});

test('rascunho: sem conversa não há id; cópia não muda o guardado', () => {
  const drafts = createActivityPreviewDrafts();
  assert.throws(() => drafts.remember({}, CONTENT), /conversationId/);
  const id = drafts.remember({conversationId: 'c'}, CONTENT);
  const copy = drafts.resolve({conversationId: 'c'}, id);
  copy.html = '<p>mudou</p>';
  assert.equal(drafts.resolve({conversationId: 'c'}, id).html, CONTENT.html);
});

/* H4: o tutor pré-visualiza e não publica. A publicação de fim de turno usa o
   conteúdo E os textos opcionais que a prévia recebeu; `resolve` (publicação
   normal) continua devolvendo só o conteúdo, porque o modelo reenvia os
   textos na chamada. */
test('rascunho: draftSpec leva conteúdo e textos da prévia; resolve não muda', () => {
  const drafts = createActivityPreviewDrafts();
  const id = drafts.remember({conversationId: 'conversa-a'}, {...CONTENT, title: 'A prévia', objective: 'Objetivo', alternativeMarkdown: 'Texto alternativo'});
  assert.deepEqual(drafts.draftSpec({conversationId: 'conversa-a'}, id), {
    html: CONTENT.html, css: CONTENT.css, js: CONTENT.js, katex: false, kind: 'visualizacao', charts: true,
    title: 'A prévia', objective: 'Objetivo', alternativeMarkdown: 'Texto alternativo',
  });
  assert.equal(drafts.resolve({conversationId: 'conversa-a'}, id).title, undefined, 'resolve segue só com o conteúdo');
  assert.equal(drafts.draftSpec({conversationId: 'conversa-b'}, id), null, 'não cruza conversa');
  assert.equal(drafts.draftSpec({conversationId: 'conversa-a'}, 'inventado'), null);
});
