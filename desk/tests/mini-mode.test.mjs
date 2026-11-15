// @ts-check
/* Modo mini no renderer, sem janela: o fluxo liga/desliga (`createMiniFlow`),
   o roteamento da página do Ambitus (tutor no mini, chat lateral fora dele), o
   estado da bandeja de cadernos do tutor e o bloco escondido que leva o caminho
   ao motor. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createMiniFlow} from '../src/mini-mode.mjs';
import {createAmbitusPage} from '../src/ambitus-page.mjs';
import {createNotebookTray} from '../src/tutor-notebooks.mjs';
import {displayUserText} from '../text.mjs';

const require = createRequire(import.meta.url);
const {notebookNote, MAX_NOTEBOOKS} = require('../notebook-note.cjs');

/** Janela e tela inteira de mentira: anotam o que o fluxo pediu. */
function setup({full = false, hostFails = false, pinned = true} = {}) {
  const calls = [];
  const state = {full, pinned, painted: 0, expanded: 0, prepared: 0};
  const flow = createMiniFlow({
    host: async (request) => {
      calls.push(request);
      if (hostFails && request.on === true) throw Error('a janela recusou');
      if (typeof request.alwaysOnTop === 'boolean') state.pinned = request.alwaysOnTop;
      return {on: request.on === true, alwaysOnTop: state.pinned};
    },
    chatFull: {get: () => state.full, set: (value) => { state.full = value; }},
    expandTutor: () => { state.expanded++; },
    prepare: () => { state.prepared++; },
    onChange: () => { state.painted++; },
  });
  return {flow, calls, state};
}

test('entrar liga a tela inteira, reabre o tutor, fecha menus e pede a janela; voltar desliga a tela inteira que o mini ligou', async () => {
  const {flow, calls, state} = setup();
  assert.equal(await flow.enter(), true);
  assert.deepEqual(calls, [{on: true}]);
  assert.equal(state.full, true, 'o mini usa a tela inteira (que esconde os leitores)');
  assert.equal(state.expanded, 1, 'coluna recolhida volta antes');
  assert.ok(state.prepared >= 1, 'menus abertos fecham');
  assert.ok(state.painted >= 1);
  assert.equal(flow.isOn(), true);
  assert.equal(await flow.leave(), false);
  assert.deepEqual(calls, [{on: true}, {on: false}]);
  assert.equal(state.full, false, 'a tela inteira que o mini ligou sai com ele');
  assert.equal(flow.isOn(), false);
});

test('voltar restaura a tela inteira se ela já estava ligada antes do mini', async () => {
  const {flow, state} = setup({full: true});
  await flow.enter();
  assert.equal(state.full, true);
  await flow.leave();
  assert.equal(state.full, true, 'estava na tela inteira: continua');
});

test('a janela que recusa desfaz a entrada, devolve a tela inteira de antes e avisa', async () => {
  for (const wasFull of [false, true]) {
    const {flow, state} = setup({hostFails: true, full: wasFull});
    await assert.rejects(() => flow.enter(), /a janela recusou/);
    assert.equal(flow.isOn(), false);
    assert.equal(state.full, wasFull, 'a tela inteira volta como estava');
  }
});

test('o alfinete alterna e vem ligado por padrão; a escolha guardada vem da janela', async () => {
  const {flow, calls} = setup({pinned: false});
  await flow.enter();
  assert.equal(flow.pinned(), false, 'a janela diz que a escolha guardada era desligado');
  assert.equal(await flow.togglePin(), true);
  assert.equal(await flow.togglePin(), false);
  assert.deepEqual(calls.slice(1), [{alwaysOnTop: true}, {alwaysOnTop: false}]);
  assert.equal(setup().flow.pinned(), true, 'antes de qualquer resposta: ligado');
});

test('toggle alterna e entrar duas vezes pede a janela uma vez só', async () => {
  const {flow, calls} = setup();
  const [a, b] = await Promise.all([flow.enter(), flow.enter()]);
  assert.deepEqual([a, b], [true, true]);
  assert.equal(calls.filter((call) => call.on === true).length, 1);
  assert.equal(await flow.toggle(), false);
  assert.equal(await flow.toggle(), true);
  assert.equal(await flow.leave(), false);
  assert.equal(await flow.leave(), false, 'voltar sem estar no mini não pede nada');
  assert.equal(calls.filter((call) => call.on === false).length, 2);
});

const PAGE = {caminho: '/c/Limites — aula 3.xopp', pagina: 2, nome: 'Limites — aula 3'};

function routing({mini}) {
  const log = {opened: 0, sidechat: [], tutor: [], toasts: []};
  const receive = createAmbitusPage({
    ready: () => log.ready !== false,
    open: () => { log.opened++; },
    attach: async (card) => { log.sidechat.push(card); return true; },
    attachTutor: (card) => { log.tutor.push(card); return log.tutorOk !== false; },
    mini: () => mini,
    toast: (text) => log.toasts.push(text),
    wait: async () => {},
    tries: 2,
  });
  return {receive, log};
}

test('a página do Ambitus com o modo mini ligado vai ao tutor e não abre o chat lateral', async () => {
  const {receive, log} = routing({mini: true});
  assert.equal(await receive(PAGE), true);
  assert.deepEqual(log.tutor, [{caminho: PAGE.caminho, pagina: 2, nome: 'Limites — aula 3'}]);
  assert.deepEqual(log.sidechat, [], 'o lateral não recebe');
  assert.equal(log.opened, 0, 'e não abre');
});

test('fora do modo mini nada muda: a página abre o chat lateral e vira cartão na bandeja dele', async () => {
  const {receive, log} = routing({mini: false});
  assert.equal(await receive({caminho: '/c/Limites.xopp', pagina: 1, nome: ''}), true);
  assert.equal(log.opened, 1);
  assert.deepEqual(log.sidechat, [{caminho: '/c/Limites.xopp', pagina: 1, nome: 'Limites'}], 'nome vem do arquivo, sem .xopp');
  assert.deepEqual(log.tutor, []);
});

test('sem matéria aberta avisa nos dois destinos; pedido que não é página não faz nada; tutor que recusa avisa', async () => {
  for (const mini of [true, false]) {
    const {receive, log} = routing({mini});
    log.ready = false;
    assert.equal(await receive(PAGE), false);
    assert.equal(log.toasts.length, 1);
    assert.deepEqual([log.tutor.length, log.sidechat.length, log.opened], [0, 0, 0]);
  }
  const {receive, log} = routing({mini: true});
  assert.equal(await receive({caminho: '', pagina: 0}), false);
  assert.deepEqual(log.toasts, []);
  log.tutorOk = false;
  assert.equal(await receive(PAGE), false);
  assert.equal(log.toasts.length, 1, 'o tutor que não aceitou diz que falhou');
});

test('bandeja de cadernos do tutor: a mesma página não repete, o teto tira o mais antigo e a miniatura pode chegar antes', () => {
  const tray = createNotebookTray();
  assert.equal(tray.add({caminho: '/c/a.xopp', pagina: 1}), true);
  assert.equal(tray.add({caminho: '/c/a.xopp', pagina: 1, nome: 'A'}), true);
  assert.deepEqual(tray.snapshot(), [{caminho: '/c/a.xopp', pagina: 1, nome: 'A'}], 'a mesma página substitui, não repete');
  assert.equal(tray.add({caminho: '', pagina: 1}), false, 'sem caminho não é página');
  assert.equal(tray.add({caminho: '/c/a.xopp', pagina: 0}), false);
  for (let page = 2; page <= 6; page++) tray.add({caminho: '/c/a.xopp', pagina: page});
  assert.deepEqual(tray.snapshot().map((item) => item.pagina), [3, 4, 5, 6], 'quatro cartões: sai o mais antigo');

  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(tray.setThumb({caminho: '/c/a.xopp', pagina: 6, thumb: png}), true);
  assert.equal(tray.list().find((item) => item.pagina === 6)?.thumb, png);
  assert.equal(tray.setThumb({caminho: '/c/a.xopp', pagina: 5, thumb: 'data:text/html;base64,PGI+'}), false, 'só PNG em data URL');
  assert.deepEqual(tray.snapshot()[3], {caminho: '/c/a.xopp', pagina: 6, nome: 'a'}, 'a miniatura não vai ao envio');

  assert.equal(tray.setThumb({caminho: '/c/b.xopp', pagina: 1, thumb: png}), false, 'miniatura sem cartão fica guardada');
  tray.add({caminho: '/c/b.xopp', pagina: 1});
  assert.equal(tray.list().find((item) => item.caminho === '/c/b.xopp')?.thumb, png, 'e o cartão que chega depois a recebe');
});

test('bandeja de cadernos: o envio tira o que levou e o que chegou durante o envio fica', () => {
  const tray = createNotebookTray();
  tray.add({caminho: '/c/a.xopp', pagina: 1});
  const sent = tray.snapshot();
  tray.add({caminho: '/c/a.xopp', pagina: 2});
  tray.release(sent);
  assert.deepEqual(tray.snapshot().map((item) => item.pagina), [2]);
  tray.clear();
  assert.deepEqual(tray.snapshot(), []);
});

const tutorT = (key, args = {}) => (key === 'sidechatctx.notebookHead' ? '[Cadernos anexados à mensagem]' : `- caderno “${args.name}”, pág. ${args.page}, arquivo ${args.path} (releia com ler_caderno)`);

test('o bloco escondido leva o caminho ao motor; só caderno autorizado, até o teto', () => {
  const allowedXopp = new Set(['/c/Limites.xopp', '/c/Outro.xopp']);
  assert.equal(notebookNote([], {allowedXopp, tutorT}), '', 'sem caderno, sem bloco');
  assert.equal(notebookNote(undefined, {allowedXopp, tutorT}), '');
  const block = notebookNote([{caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites  —\naula 3'}, {caminho: '/c/Outro.xopp', pagina: 0}], {allowedXopp, tutorT});
  assert.equal(block, '[Cadernos anexados à mensagem]\n- caderno “Limites — aula 3”, pág. 2, arquivo /c/Limites.xopp (releia com ler_caderno)\n- caderno “Outro”, pág. 1, arquivo /c/Outro.xopp (releia com ler_caderno)', 'nome numa linha, página inválida vira 1, nome vazio vem do arquivo');
  assert.throws(() => notebookNote([{caminho: '/c/Fora.xopp', pagina: 1}], {allowedXopp, tutorT}), /\/c\/Fora\.xopp/, 'caderno desconhecido recusa o envio e a mensagem diz qual');
  assert.throws(() => notebookNote([{pagina: 1}], {allowedXopp, tutorT}), Error);
  const many = Array.from({length: 7}, () => ({caminho: '/c/Limites.xopp', pagina: 1}));
  assert.equal(notebookNote(many, {allowedXopp, tutorT}).split('\n').length, 1 + MAX_NOTEBOOKS);
});

test('o histórico não mostra o bloco de cadernos (nem o caminho do arquivo) na bolha', () => {
  const pt = 'por que posso cancelar?\n\n[Cadernos anexados à mensagem]\n- caderno “Limites”, pág. 2, arquivo /c/Limites.xopp (releia com ler_caderno)';
  assert.equal(displayUserText(pt), 'por que posso cancelar?');
  const en = 'why can I cancel?\n\n[Notebooks attached to the message]\n- notebook “Limits”, p. 2, file /c/Limits.xopp (reread it with ler_caderno)';
  assert.equal(displayUserText(en), 'why can I cancel?');
  const withContext = 'oi\n\n[Contexto da Mesa]\nmatéria: Cálculo\n\n[Cadernos anexados à mensagem]\n- caderno “A”, pág. 1, arquivo /c/A.xopp (releia com ler_caderno)';
  assert.equal(displayUserText(withContext), 'oi');
});
