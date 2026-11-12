/* #135 no diário real: o passo do `ler_caderno` mostra o resumo humano, o
   nome acessível é curto, o bloco técnico fica separado e a cabeça de um turno
   só com a ferramenta falha vira "Não consegui ler o caderno". Histórico
   sintético (sem motor real), como nas capturas do ciclo 2. */
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,resizeWindow} from './helpers.mjs';

const now = Date.now();
const workMessages = [
 {role: 'user', content: [{type: 'text', text: 'Leia a página 1 do caderno.'}], timestamp: now - 60000},
 {role: 'assistant', content: [
  {type: 'toolCall', id: 'caderno-ok', name: 'mesa_ler_caderno', arguments: {caminho: '/tmp/ciclo2-caderno-x/aula-nova.xopp', pagina: 1}},
 ], timestamp: now - 50000},
 {role: 'toolResult', toolCallId: 'caderno-ok', content: [
  {type: 'text', text: 'aula-nova.xopp (página 1 de 2, conteúdo do documento)\n\n--- texto ---\nEquação do primeiro grau'},
 ], isError: false, timestamp: now - 40000},
 {role: 'user', content: [{type: 'text', text: 'Leia a página 2 do caderno.'}], timestamp: now - 30000},
 {role: 'assistant', content: [
  {type: 'toolCall', id: 'caderno-erro', name: 'mesa_ler_caderno', arguments: {caminho: 'aula-nova.xopp', pagina: 2}},
 ], timestamp: now - 20000},
 {role: 'toolResult', toolCallId: 'caderno-erro', content: [
  {type: 'text', text: 'Página 2 não existe (o caderno tem 1).'},
 ], isError: true, timestamp: now - 10000},
 {role: 'user', content: [{type: 'text', text: 'Leia o PDF da aula.'}], timestamp: now - 9000},
 {role: 'assistant', content: [
  {type: 'toolCall', id: 'pdf-ok', name: 'mesa_ler_pdf', arguments: {caminho: '/tmp/limites.pdf', pagina: 1}},
 ], timestamp: now - 8000},
 {role: 'toolResult', toolCallId: 'pdf-ok', content: [
  {type: 'text', text: 'Limites.pdf, página 1'},
 ], isError: false, timestamp: now - 7000},
 {role: 'user', content: [{type: 'text', text: 'Quanto é 2+2?'}], timestamp: now - 6000},
 {role: 'assistant', content: [
  {type: 'toolCall', id: 'calc-ok', name: 'mesa_calcular', arguments: {expressao: '2+2'}},
 ], timestamp: now - 5000},
 {role: 'toolResult', toolCallId: 'calc-ok', content: [
  {type: 'text', text: '4'},
 ], isError: false, timestamp: now - 4000},
];

const facts = (page) => page.evaluate(() => {
 const works = [...document.querySelectorAll('article.work')];
 const read = (work) => {
  const step = work.querySelector('.work-step[data-kind="tool"]');
  const toggle = step?.querySelector('.step-toggle');
  return {
   title: work.querySelector('.work-title')?.textContent?.trim() ?? '',
   failed: work.getAttribute('data-failed'),
   label: step?.querySelector('.step-label')?.textContent?.trim() ?? '',
   aria: toggle?.getAttribute('aria-label') ?? '',
   text: step?.querySelector('.step-text')?.textContent?.trim() ?? '',
   tech: step?.querySelector('.step-tech')?.textContent?.trim() ?? '',
   techLabel: step?.querySelector('.step-tech-label')?.textContent?.trim() ?? '',
   detail: step?.dataset.detail ?? '',
   icon: step?.querySelector('.step-icon')?.dataset.slotIcon ?? '',
   markColor: getComputedStyle(work.querySelector('.work-mark')).color,
  };
 };
 return {works: works.map(read)};
});

await withArtifacts('worklog-caderno', async (ctx) => {
 const runtime = ctx.runtime = newRuntime('worklog-caderno');
 const course = seedCourse(runtime, 'calc');
 writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
 const session = seedNativeSession(runtime, workMessages, {courseId: 'calc', started: now - 60000, preview: 'caderno'});
 writeDeskJson(runtime, {courseId: 'calc', session, courseStates: {calc: {session, sessions: [{path: session, started: now - 60000}], pdfs: [], study: {title: '', xopp: ''}}}});
 const app = ctx.app = await launchDesk({runtime});
 const page = await app.firstWindow();
 const errors = [];
 page.on('pageerror', (error) => errors.push(String(error)));
 await resizeWindow(app, page, 1440, 900);
 await statusOnline(page, {timeout: 60000});
 await page.waitForSelector('article.work', {timeout: 30000});
 await page.waitForFunction(() => document.querySelectorAll('article.work').length >= 4, undefined, {timeout: 30000});

 const before = await facts(page);
 assert.equal(before.works.length, 4, 'quatro turnos no histórico');
 const [ok, failed, pdf, calc] = before.works;
 assert.equal(pdf.label, 'Ler o PDF', 'o mapa de exibição serve às outras ferramentas da Mesa');
 assert.equal(calc.label, 'Calcular', 'a ferramenta fora da leitura mantém o nome do catálogo');

 /* F8/F10/F11: resumo humano, alvo no passo e nome acessível curto. */
 assert.equal(ok.label, 'Ler o caderno: aula-nova.xopp, página 1');
 assert.equal(ok.aria, ok.label, 'o nome acessível é o rótulo curto');
 assert.ok(!ok.aria.includes('caminho') && !ok.aria.includes('/tmp'), `sem JSON/caminho no nome acessível: ${ok.aria}`);
 /* N9 (rodada 2): o corpo repetia o rótulo inteiro; o detalhe fica só com o
    bloco técnico. */
 assert.equal(ok.text, '', 'o corpo não repete o rótulo');
 assert.equal(ok.detail, 'true', 'o detalhe técnico continua abrindo');
 assert.ok(!ok.tech.includes('--- texto ---'), 'o delimitador de máquina sai do texto humano');
 assert.equal(ok.techLabel, 'Detalhes técnicos');
 assert.match(ok.tech, /^Entrada: \{"caminho":/);

 /* N14 (rodada 2): as ferramentas de leitura usam o livro; as outras, a chave. */
 assert.equal(ok.icon, 'book', 'ler_caderno usa o ícone de livro');
 assert.equal(pdf.icon, 'book', 'ler_pdf usa o ícone de livro');
 assert.equal(calc.icon, 'wrench', 'as outras ferramentas mantêm a chave');

 /* F12: a cabeça do turno que só falhou muda e a marca fica vermelha. */
 assert.equal(failed.title, 'Não consegui ler o caderno');
 assert.equal(failed.failed, 'true', 'a cabeça carrega a marca de falha');
 assert.equal(failed.markColor, 'rgb(189, 28, 103)', 'a marca de falha usa --danger-text no claro (rosa aprovado do r2)');
 assert.equal(failed.aria, 'Ler o caderno: aula-nova.xopp, página 2');
 assert.equal(failed.text, 'Página 2 não existe (o caderno tem 1).', 'o motivo do erro continua no corpo');

 /* N9 (rodada 2): ao vivo a cabeça leva o verbo e o passo mostra só o alvo. */
 const live = () => page.evaluate(async () => {
  const {workRowFrom} = await import('./src/worklog-view.mjs');
  const log = {startedAt: Date.now() - 1000, endedAt: 0, reason: '', text: '', steps: [
   {id: 'live-caderno', kind: 'tool', status: 'running', toolName: 'mesa_ler_caderno', args: {caminho: '/tmp/x/aula-nova.xopp', pagina: 1}},
  ]};
  const row = workRowFrom(log, {live: true});
  return {title: row.title, label: row.steps.head.label};
 });
 const livePt = await live();
 assert.equal(livePt.title, 'Lendo o caderno', 'a cabeça leva o verbo');
 assert.equal(livePt.label, 'aula-nova.xopp, página 1', 'o passo ao vivo mostra só o alvo');
 assert.ok(!livePt.label.includes('Lendo'), `sem repetir o verbo no passo: ${livePt.label}`);

 /* F9: com a interface em inglês, o resumo e o bloco técnico seguem o idioma. */
 await page.evaluate(async () => {
  const {setUiLanguage} = await import('./src/ui-text.mjs');
  setUiLanguage('en');
 });
 await page.waitForFunction(() => document.documentElement.lang === 'en', undefined, {timeout: 10000});
 for (const work of await page.locator('article.work').all()) {
  const head = work.locator('.work-head');
  await head.click();
  await head.click();
 }
 const english = (await facts(page)).works;
 assert.equal(english[0].label, 'Read the notebook: aula-nova.xopp, page 1');
 assert.equal(english[0].text, '', 'o corpo não repete o rótulo em inglês');
 assert.equal(english[0].techLabel, 'Technical details');
 assert.match(english[0].tech, /^Input: /);
 assert.equal(english[0].icon, 'book');
 assert.equal(english[1].title, "Couldn't read the notebook");
 assert.equal(english[2].label, 'Read the PDF');
 assert.equal(english[2].icon, 'book');
 assert.equal(english[3].label, 'Calculate');
 assert.equal(english[3].icon, 'wrench');
 const liveEn = await live();
 assert.equal(liveEn.title, 'Reading the notebook');
 assert.equal(liveEn.label, 'aula-nova.xopp, page 1');
 assert.deepEqual(errors, []);
});
