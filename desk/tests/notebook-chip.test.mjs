// @ts-check
/* O chip do caderno na bolha e o cartão compartilhado da bandeja: só nome e
   página chegam à tela; mensagens antigas, sem o campo ou sem o bloco, abrem
   sem chip. O cartão é o mesmo nó nos dois chats (`notebook-card.mjs`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {installDom} from './dom-shim.mjs';
import {notebookCardNode, notebookChipNode} from '../src/notebook-card.mjs';
import {attachedNotebooks, notebookFactsOf} from '../src/notebook-facts.mjs';
import {historyTurns} from '../src/worklog.mjs';

const require = createRequire(import.meta.url);
const {displayMessages} = require('../sidechat-store.cjs');

installDom();

const PT = 'por que posso cancelar?\n\n[Cadernos anexados à mensagem]\n- caderno “Limites — aula 3”, pág. 2, arquivo /c/Limites — aula 3.xopp (releia com ler_caderno)';
const EN = 'why can I cancel?\n\n[Notebooks attached to the message]\n- notebook “Limits”, p. 7, file /c/Limits.xopp (reread it with ler_caderno)';

test('o cartão compartilhado monta o mesmo nó nos dois chats, com × e nome/página', () => {
  let removed = 0;
  const card = notebookCardNode({nome: 'Limites', pagina: 2}, {key: 'notebook-/c/a.xopp#2', onRemove: () => { removed++; }});
  assert.equal(card.className, 'attachment');
  assert.equal(card.getAttribute('role'), 'group');
  assert.equal(card.getAttribute('aria-label'), 'Limites, pág. 2');
  assert.equal(card.dataset.key, 'notebook-/c/a.xopp#2');
  const file = card.children[0];
  assert.equal(file.className, 'file notebook-card');
  assert.equal(file.title, 'Limites · pág. 2');
  const thumb = file.children[0];
  assert.equal(thumb.className, 'notebook-thumb');
  assert.match(thumb.innerHTML, /<svg class="icon"/, 'sem miniatura, o ícone do caderno');
  const text = file.children[1];
  assert.equal(text.className, 'notebook-text');
  assert.equal(text.children[0].textContent, 'Limites');
  assert.equal(text.children[1].textContent, 'pág. 2');
  const remove = card.children[1];
  assert.equal(remove.getAttribute('aria-label'), 'Remover Limites');
  remove.click();
  assert.equal(removed, 1, 'o × chama o dono do estado');

  const withThumb = notebookCardNode({nome: 'Aula 3', pagina: 1, thumb: 'data:image/png;base64,iVBORw0KGgo='});
  assert.equal(withThumb.children[0].children[0].getAttribute('src'), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(withThumb.dataset.key, undefined, 'a bandeja do lateral não inventa chave');
});

test('o chip da bolha tem ícone, nome e página, sem o caminho', () => {
  const chip = notebookChipNode({nome: 'Limites', pagina: 2});
  assert.equal(chip.className, 'attachment message-file notebook-chip');
  const file = chip.children[0];
  assert.equal(file.className, 'file notebook-chip-file');
  assert.equal(file.title, 'Limites · pág. 2');
  assert.equal(file.children[0].className, 'notebook-icon');
  assert.match(file.children[0].innerHTML, /<svg class="icon"/);
  assert.equal(file.children[1].children[0].textContent, 'Limites');
  assert.equal(file.children[1].children[1].textContent, 'pág. 2');
  const shown = JSON.stringify({label: chip.getAttribute('aria-label'), title: file.title, text: file.children[1].children.map((item) => item.textContent)});
  assert.doesNotMatch(shown, /\.xopp|Limites —/i, 'a bolha não mostra o caminho nem o nome do arquivo');
});

test('os fatos guardam só nome e página; o bloco escondido é lido nos dois idiomas', () => {
  assert.deepEqual(notebookFactsOf([{caminho: '/c/a.xopp', pagina: 2, nome: 'A'}]), [{nome: 'A', pagina: 2}]);
  assert.deepEqual(notebookFactsOf([{nome: 'B', pagina: 0}, {nome: 'C', pagina: 1}]), [{nome: 'C', pagina: 1}]);
  assert.deepEqual(attachedNotebooks(PT), [{nome: 'Limites — aula 3', pagina: 2}]);
  assert.deepEqual(attachedNotebooks(EN), [{nome: 'Limits', pagina: 7}]);
  assert.deepEqual(attachedNotebooks('oi, sem caderno'), [], 'mensagem antiga não tem bloco');
});

test('o histórico do tutor devolve o chip sem o caminho; mensagem antiga fica sem caderno', () => {
  const [withNote] = historyTurns([{role: 'user', content: [{type: 'text', text: PT}], timestamp: 1}]);
  assert.equal(withNote.userText, 'por que posso cancelar?');
  assert.deepEqual(withNote.userNotebooks, [{nome: 'Limites — aula 3', pagina: 2}]);
  const [old] = historyTurns([{role: 'user', content: [{type: 'text', text: 'só a pergunta'}], timestamp: 1}]);
  assert.deepEqual(old.userNotebooks, [], 'sem o campo/bloco, nenhum chip');
});

test('o descritor do chat lateral: campo novo sobrevive e o envelope nativo vira chip sem o caminho', () => {
  const pi = displayMessages([{role: 'user', content: [{type: 'text', text: 'pergunta'}], notebooks: [{nome: 'Limites', pagina: 2}]}]);
  assert.deepEqual(pi[0].notebooks, [{nome: 'Limites', pagina: 2}]);
  assert.equal(pi[0].content[0].text, 'pergunta');

  const NOTE = '[Cadernos anexados à mensagem]\n- caderno “Limites — aula 3”, pág. 2, arquivo /c/Limites — aula 3.xopp (releia com ler_caderno)';
  const native = displayMessages([{role: 'user', content: [{type: 'text', text: `[Contexto do chat lateral]\n- conversa principal\n${NOTE}\n[Fim do contexto do chat lateral]\n\npor que posso cancelar?`}]}]);
  assert.deepEqual(native[0].notebooks, [{nome: 'Limites — aula 3', pagina: 2}]);
  assert.equal(native[0].content[0].text, 'por que posso cancelar?');
  assert.doesNotMatch(JSON.stringify(native[0]), /\.xopp/, 'o caminho não fica no que a tela recebe');

  const old = displayMessages([{role: 'user', content: [{type: 'text', text: 'mensagem antiga'}]}]);
  assert.equal('notebooks' in old[0], false, 'mensagem antiga continua abrindo sem o campo');
});
