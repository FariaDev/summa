// @ts-check
/* O trecho da página que o Ambitus manda (`recorte`, em pontos PDF, origem no
   canto superior esquerdo): a forma que é só dele, o cartão e a bandeja que o
   carregam, o bloco escondido que o tutor lê (linha de trecho e a antiga) e as
   linhas que o histórico relê. As rotas HTTP ficam em ambitus-send-page e
   ambitus-page-routes; o corte da página recarregada fica em notebook-images. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {notebookRecorte, attachedNotebooks} from '../src/notebook-facts.mjs';
import {notebookCardOf, notebookSendFacts} from '../src/ambitus-page.mjs';
import {createNotebookTray} from '../src/tutor-notebooks.mjs';
import {createI18n, message} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const require = createRequire(import.meta.url);
const {notebookNote} = require('../notebook-note.cjs');

const XOPP = '/c/Limites — aula 3.xopp';
const EXCERPT = {x: 0, y: 286, largura: 595, altura: 555};
const ALLOWED = new Set([XOPP]);

/** O `t` do catálogo no idioma pedido: é o que o `tutorT` do main faz com as frases do bloco. @param {'pt-BR'|'en'} language */
function tutorTIn(language) {
  const i18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language});
  return (/** @type {string} */ key, /** @type {object} */ args) => i18n.t(key, args);
}

test('o trecho é só quatro medidas numéricas, com x e y ≥ 0 e largura e altura > 0', () => {
  assert.deepEqual(notebookRecorte(EXCERPT), EXCERPT);
  assert.deepEqual(notebookRecorte({x: 88.0, y: 0, largura: 595, altura: 0.5}), {x: 88, y: 0, largura: 595, altura: 0.5}, 'inteiro que chega como 88.0 é 88');
  assert.deepEqual(notebookRecorte({...EXCERPT, extra: 'ignorado'}), EXCERPT, 'campo a mais não entra');
  const bad = [null, [], 'x', {x: 0, y: 0, largura: 1}, {...EXCERPT, x: '0'}, {...EXCERPT, largura: '595'}, {...EXCERPT, y: Number.NaN},
    {...EXCERPT, altura: Infinity}, {...EXCERPT, x: -1}, {...EXCERPT, y: -0.5}, {...EXCERPT, largura: 0}, {...EXCERPT, altura: -3}, {...EXCERPT, x: null}];
  for (const value of bad) assert.equal(notebookRecorte(value), null, String(JSON.stringify(value)));
});

test('o cartão guarda o trecho válido; o inválido não entra, e sem trecho a chave nem aparece', () => {
  assert.deepEqual(notebookCardOf({caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT}), {caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT});
  assert.equal('recorte' in /** @type {object} */ (notebookCardOf({caminho: XOPP, pagina: 2, nome: 'Limites'})), false);
  assert.equal('recorte' in /** @type {object} */ (notebookCardOf({caminho: XOPP, pagina: 2, nome: 'Limites', recorte: {x: 0}})), false);
});

test('o envio leva o trecho só quando o cartão é um trecho', () => {
  assert.deepEqual(notebookSendFacts({caminho: XOPP, pagina: 2, nome: 'Limites', thumb: 'data:image/png;base64,AA', full: true, recorte: EXCERPT}),
    {caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT});
  assert.equal('recorte' in notebookSendFacts({caminho: XOPP, pagina: 2, nome: 'Limites', thumb: ''}), false);
});

test('a bandeja leva o trecho no envio e no que se guarda; o disco antigo volta como página inteira', () => {
  const tray = createNotebookTray();
  assert.equal(tray.add({caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT}), true);
  assert.deepEqual(tray.snapshot(), [{caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT}]);
  assert.deepEqual(tray.persisted(), [{caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT, thumb: ''}]);

  const restored = createNotebookTray();
  restored.restore([{caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT, thumb: ''}, {caminho: XOPP, pagina: 3, nome: 'Limites', thumb: ''}]);
  assert.deepEqual(restored.snapshot(), [{caminho: XOPP, pagina: 2, nome: 'Limites', recorte: EXCERPT}, {caminho: XOPP, pagina: 3, nome: 'Limites'}]);

  tray.add({caminho: XOPP, pagina: 2, nome: 'Limites'});
  assert.deepEqual(tray.snapshot(), [{caminho: XOPP, pagina: 2, nome: 'Limites'}], 'a página inteira que chega depois troca o trecho da mesma página');
});

test('o bloco escondido diz que a imagem é só o trecho, com as medidas arredondadas; a linha de página inteira não muda', () => {
  const card = {caminho: XOPP, pagina: 2, nome: 'Limites — aula 3', recorte: {x: 0, y: 285.6, largura: 594.9, altura: 555}};
  assert.equal(notebookNote([card], {allowedXopp: ALLOWED, tutorT: tutorTIn('pt-BR')}),
    `[Cadernos anexados à mensagem]\n- caderno “Limites — aula 3”, pág. 2, trecho x=0 y=286 largura=595 altura=555 pt, arquivo ${XOPP} (a imagem anexada é só esse trecho; releia com ler_caderno só se precisar do resto da página)`);
  assert.equal(notebookNote([card], {allowedXopp: ALLOWED, tutorT: tutorTIn('en')}),
    `[Notebooks attached to the message]\n- notebook “Limites — aula 3”, p. 2, excerpt x=0 y=286 width=595 height=555 pt, file ${XOPP} (the attached image is only this excerpt; reread it with ler_caderno only if you need the rest of the page)`);
  assert.equal(notebookNote([{caminho: XOPP, pagina: 2, nome: 'Limites — aula 3'}], {allowedXopp: ALLOWED, tutorT: tutorTIn('pt-BR')}),
    `[Cadernos anexados à mensagem]\n- caderno “Limites — aula 3”, pág. 2, arquivo ${XOPP}; a imagem anexada é esta página (use ler_caderno para reler esta ou outras páginas)`);
});

test('um trecho inválido recusa o envio inteiro, antes de montar o bloco', () => {
  const broken = {...EXCERPT, largura: 0};
  assert.throws(() => notebookNote([{caminho: XOPP, pagina: 2, nome: 'Limites', recorte: broken}], {allowedXopp: ALLOWED, tutorT: tutorTIn('pt-BR')}), (error) => {
    assert.equal(/** @type {Error} */ (error).message, message('err.sidechat.notebookRecorte', {received: JSON.stringify(broken)}));
    return true;
  });
});

test('o histórico relê a linha de trecho e a antiga, nos dois idiomas, e o chip segue só com nome e página', () => {
  const excerpt = notebookNote([{caminho: XOPP, pagina: 2, nome: 'Limites — aula 3', recorte: EXCERPT}], {allowedXopp: ALLOWED, tutorT: tutorTIn('pt-BR')});
  assert.deepEqual(attachedNotebooks(`por que?\n\n${excerpt}`), [{nome: 'Limites — aula 3', pagina: 2}]);
  const excerptEn = notebookNote([{caminho: XOPP, pagina: 7, nome: 'Limits', recorte: EXCERPT}], {allowedXopp: ALLOWED, tutorT: tutorTIn('en')});
  assert.deepEqual(attachedNotebooks(`why?\n\n${excerptEn}`), [{nome: 'Limits', pagina: 7}]);

  const oldPt = `[Cadernos anexados à mensagem]\n- caderno “Limites — aula 3”, pág. 2, arquivo ${XOPP}; a imagem anexada é esta página (use ler_caderno para reler esta ou outras páginas)`;
  assert.deepEqual(attachedNotebooks(oldPt), [{nome: 'Limites — aula 3', pagina: 2}], 'a linha antiga continua lendo');
  const oldEn = '[Notebooks attached to the message]\n- notebook “Limits”, p. 7, file /c/Limits.xopp; the attached image is this page (use ler_caderno to reread this or other pages)';
  assert.deepEqual(attachedNotebooks(oldEn), [{nome: 'Limits', pagina: 7}]);

  const mixed = `[Cadernos anexados à mensagem]\n- caderno “A”, pág. 1, trecho x=0 y=0 largura=10 altura=10 pt, arquivo /c/A.xopp (…)\n- caderno “B”, pág. 4, arquivo /c/B.xopp; a imagem anexada é esta página`;
  assert.deepEqual(attachedNotebooks(mixed), [{nome: 'A', pagina: 1}, {nome: 'B', pagina: 4}], 'linha de trecho e linha inteira na mesma mensagem');
});
