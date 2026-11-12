// node tests/capture-ciclo2-xournal.mjs — capturas do ciclo 2 de UI/UX para a
// parte Xournal++ (#159, #133): menus/diálogos dos plugins Converter/Trocar
// fonte, estados da ponte (sucesso, erro, timeout, resposta inválida, ponte
// desligada, todos os motivos e resposta vazia), alvos e páginas do Trocar
// fonte, crescimento da página e montagem real com o chat solto (#157) ao
// lado do Xournal++, com e sem seleção. Fora do `npm run ui`. Tudo sintético:
// `.xopp` aqui, HOME/XDG temporários (nunca o ~/.config real), ponte com
// leitores falsos — nenhum motor nem chave. Saída padrão em
// `docs/design-loop/rodada-2/antes/xournal/`; `--out`/`CICLO2_OUT` troca. Só
// janelas de teste entram no recorte; intrusa impede a imagem e fica no JSON.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DESK, newRuntime, seedCourse, writeConfigJson, writeDeskJson, launchDesk,
  statusOnline, freezeMotion, tinyPdf,
} from './helpers.mjs';
import {
  DISPLAY, installX11Helper, makeX11, windowsOfPid, geometry, props, clients,
  processTree, captureState, captureWindow, primeXournalSettings, snapshot, xournalPopups,
} from './capture-ciclo2-xournal-kit.mjs';
import {addExtraPages, postBusyRequest} from './capture-ciclo2-xournal-estados.mjs';
import {openSidechat, sendSidechat, waitAssistant, detachSidechat} from './capture-ciclo2-chat-solto-kit.mjs';
import {
  sleep, waitFor, xournalBinary, install, launchXournal, killXournal,
  bridgeHost, writeBridge, closedPort, withStub,
} from './capture-ciclo2-xournal-fixtures.mjs';

const REPO = path.resolve(DESK, '..');
const DEFAULT_OUT = path.join(REPO, 'docs', 'design-loop', 'rodada-2', 'antes', 'xournal');
const OUT = path.resolve(argValue('--out') || process.env.CICLO2_OUT || DEFAULT_OUT);
const ONLY = new Set((process.env.CICLO2_ONLY || '').split(',').filter(Boolean));
const KEEP = process.env.CICLO2_KEEP === '1';
function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : '';
}

/* ------------------------------------------------------------------ */
/* Ações no Xournal++                                                   */
/* ------------------------------------------------------------------ */

async function waitDialog(pid, before, timeout = 6000) {
  return waitFor(() => windowsOfPid(pid).find((win) => !before.has(win.id) && win.w > 100 && win.h > 60), {timeout, what: 'diálogo do plugin'});
}

function currentWindows(pid, mainId) {
  return windowsOfPid(pid).map((win) => ({...win, papel: win.id === mainId ? 'xournal' : 'dialogo'}));
}

function clickButton(dialog, fraction) {
  return {x: Math.round(dialog.x + dialog.w * fraction), y: Math.round(dialog.y + dialog.h - 16)};
}

async function clickDialog(x11, dialog, fraction) {
  const at = clickButton(dialog, fraction);
  x11.click(at.x, at.y);
}

async function waitGone(pid, id, timeout = 5000) {
  await waitFor(() => !windowsOfPid(pid).some((win) => win.id === id), {timeout, what: 'diálogo fechar'});
}

async function shortcutDialog(x11, pid, mainId, combo, {captureName, outDir} = {}) {
  await x11.focus(mainId);
  const main = windowsOfPid(pid).find((win) => win.id === mainId);
  const images = snapshot(main);
  const before = new Set(windowsOfPid(pid).map((win) => win.id));
  x11.key(combo);
  const dialog = await waitDialog(pid, before);
  let meta = null;
  if (captureName) meta = captureState({name: captureName, outDir, ours: currentWindows(pid, mainId), x11, images});
  return {dialog, meta, before, images};
}

/* Aviso de sucesso do Trocar fonte sem a faixa preta que o `snapshot(main)`
   com o aviso aberto deixa: o aviso é capturado vivo, o OK fecha, e a janela
   principal limpa (com a fonte já aplicada) entra por baixo, como no 12b. */
async function captureNotice(x11, pid, mainId, notice, name, outDir) {
  await sleep(300);
  const noticeWin = windowsOfPid(pid).find((win) => win.id === notice.id) || notice;
  const noticeImage = captureWindow(notice.id);
  await clickDialog(x11, notice, 0.5);
  await waitGone(pid, notice.id);
  const main = windowsOfPid(pid).find((win) => win.id === mainId);
  await x11.raise(mainId);
  await sleep(300);
  const mainImage = captureWindow(mainId);
  const images = new Map([
    [mainId, {x: main.x, y: main.y, image: mainImage}],
    [notice.id, {x: noticeWin.x, y: noticeWin.y, image: noticeImage}],
  ]);
  return captureState({name, outDir, ours: [...currentWindows(pid, mainId), {...noticeWin, papel: 'dialogo'}], x11, images, raise: false});
}

async function confirmConversion(x11, pid, mainId, dialog, fraction, opts = {}) {
  let frozen = null;
  await clickDialog(x11, dialog, fraction);
  if (opts.frozenName) {
    await sleep(700);
    frozen = captureState({name: opts.frozenName, outDir: opts.outDir, ours: currentWindows(pid, mainId), x11});
    await sleep(opts.afterFrozen || 4000);
  }
  await waitGone(pid, dialog.id);
  return frozen;
}

/* Confirma a conversão e captura o diálogo de erro que vem depois. */
async function conversionError(x11, pid, mainId, name, outDir) {
  await x11.focus(mainId);
  x11.key('ctrl+a');
  await sleep(300);
  const main = windowsOfPid(pid).find((win) => win.id === mainId);
  const images = snapshot(main);
  const before = new Set(windowsOfPid(pid).map((win) => win.id));
  x11.key('ctrl+shift+k');
  const confirm = await waitDialog(pid, before);
  await clickDialog(x11, confirm, 0.25);
  const error = await waitFor(() => windowsOfPid(pid).find((win) => !before.has(win.id) && win.id !== confirm.id && win.w > 100 && win.h > 60), {timeout: 8000, what: 'diálogo de erro'});
  const meta = captureState({name, outDir, ours: currentWindows(pid, mainId), x11, images});
  await clickDialog(x11, error, 0.5);
  await waitGone(pid, error.id);
  return meta;
}

/* Ponte ausente (#159): a ponte é conferida ANTES do aviso de congelamento,
   então o primeiro (e único) diálogo já é o erro, sem confirmação. */
async function bridgeMissingError(x11, pid, mainId, name, outDir) {
  await x11.focus(mainId);
  x11.key('ctrl+a');
  await sleep(300);
  const main = windowsOfPid(pid).find((win) => win.id === mainId);
  const images = snapshot(main);
  const before = new Set(windowsOfPid(pid).map((win) => win.id));
  x11.key('ctrl+shift+k');
  const error = await waitFor(() => windowsOfPid(pid).find((win) => !before.has(win.id) && win.w > 100 && win.h > 60), {timeout: 8000, what: 'diálogo de ponte ausente'});
  const meta = captureState({name, outDir, ours: currentWindows(pid, mainId), x11, images});
  await clickDialog(x11, error, 0.5);
  await waitGone(pid, error.id);
  return meta;
}

async function gotoPage(x11, mainId, state, target) {
  await x11.focus(mainId);
  while (state.page < target) { x11.key('ctrl+page_down'); state.page += 1; await sleep(350); }
  while (state.page > target) { x11.key('ctrl+page_up'); state.page -= 1; await sleep(350); }
  await sleep(400);
}

/* Montagem real (Xournal++ + chat solto lado a lado) */
function electronWindow(app, titulo, papel) {
  const pids = processTree(app.process().pid);
  return waitFor(() => {
    for (const id of clients()) {
      try {
        const info = {...props(id), ...geometry(id)};
        if (info.mapeada && info.classe.toLowerCase().includes('electron') && info.titulo === titulo && (!info.pid || pids.has(info.pid))) return {id, ...info, papel};
      } catch { /* sumiu */ }
    }
    return null;
  }, {timeout: 30000, what: `janela ${titulo}`});
}

/* Cliente 420×650 em (941, 56): o `setBounds` do Electron posiciona o cliente
   em x e o topo da área útil (27 do painel) em y; a moldura soma 29. */
const CHAT_BOUNDS = {x: 941, y: 27, width: 420, height: 650};

async function montage(outDir, x11, xournal) {
  /* O colormap de 32 bits da janela Electron faz o xwd do Xournal++ falhar
     com BadColor: o Xournal++ é capturado antes de a Mesa abrir (sem seleção
     e com Ctrl+A, a seleção que o Converter lê em `app.getStrokes("selection")`). */
  await gotoPage(x11, xournal.mainId, xournal.page, 1);
  x11.move(xournal.mainId, 0, 0, 900, 650);
  await sleep(900);
  const semSelecaoWin = windowsOfPid(xournal.pid).find((win) => win.id === xournal.mainId);
  const semSelecao = new Map([[semSelecaoWin.id, {x: semSelecaoWin.x, y: semSelecaoWin.y, image: captureWindow(semSelecaoWin.id)}]]);
  await x11.focus(xournal.mainId);
  x11.key('ctrl+a');
  await sleep(900);
  const comSelecaoWin = windowsOfPid(xournal.pid).find((win) => win.id === xournal.mainId);
  const comSelecao = new Map([[comSelecaoWin.id, {x: comSelecaoWin.x, y: comSelecaoWin.y, image: captureWindow(comSelecaoWin.id)}]]);
  /* 18 mostra o Xournal++ durante a conversão: o diálogo de confirmação (o
     aviso de congelamento de até 20 s do 03) sobre a seleção. O cliente do
     diálogo é capturado agora, antes da Mesa abrir (o colormap do Electron
     quebra o xwd do Xournal++); o Cancelar evita uma conversão que a montagem
     não precisa esperar. */
  const before = new Set(windowsOfPid(xournal.pid).map((win) => win.id));
  x11.key('ctrl+shift+k');
  const dialog = await waitDialog(xournal.pid, before);
  await sleep(300);
  const conversao = new Map(comSelecao);
  conversao.set(dialog.id, {x: dialog.x, y: dialog.y, image: captureWindow(dialog.id)});
  await clickDialog(x11, dialog, 0.75);
  await waitGone(xournal.pid, dialog.id);

  const runtime = newRuntime('ciclo2-xournal-mesa'), course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf'); fs.writeFileSync(pdf, tinyPdf('Limites'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  const app = await launchDesk({runtime});
  const page = await app.firstWindow();
  try {
    await statusOnline(page); await freezeMotion(page);
    await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
    await openSidechat(page);
    await sendSidechat(page, 'Explique o limite fundamental em uma linha.');
    await waitAssistant(page);
    await detachSidechat(page, app);
    await app.evaluate(({BrowserWindow}, bounds) => BrowserWindow.getAllWindows().find((win) => win.getTitle() === 'Chat lateral')?.setBounds(bounds), CHAT_BOUNDS);
    const chat = await electronWindow(app, 'Chat lateral', 'chat');
    if (chat.x !== 941 || chat.y !== 56 || chat.w !== 420 || chat.h !== 650) throw Error(`janela solta em (${chat.x}, ${chat.y}) ${chat.w}×${chat.h}; esperado (941, 56) 420×650`);
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find((win) => win.getTitle().startsWith('Summa'))?.minimize());
    await waitFor(() => !windowsOfPid(app.process().pid).some((win) => win.titulo.startsWith('Summa')), {timeout: 5000, what: 'Mesa principal minimizar'});
    const montagem = {xournal: '900×650 à esquerda', chat: '420×650 à direita', mesaPrincipal: 'minimizada'};
    /* `raise:false` (como o delegado da rodada 1 documentou): nesta sessão o
       XRaiseWindow da janela do Electron devolve BadWindow e o xwd da moldura
       falha. As duas janelas não se sobrepõem, então a composição não muda. */
    const meta17 = captureState({name: '17-montagem-real', outDir, ours: [{...semSelecaoWin, papel: 'xournal'}, chat], x11, images: semSelecao, raise: false,
      extra: {descricao: 'Xournal++ com o caderno sintético à esquerda; janela solta do chat lateral com a resposta do tutor falso à direita; Mesa principal minimizada; sem sobreposição', montagem}});
    const meta18 = captureState({name: '18-montagem-real-convertendo', outDir, ours: [{...comSelecaoWin, papel: 'xournal'}, {...dialog, papel: 'dialogo'}, chat], x11, images: conversao, raise: false,
      extra: {descricao: 'Xournal++ com a tinta e o texto selecionados (Ctrl+A) e o diálogo de confirmação da conversão (aviso de congelamento de até 20 s) à esquerda; chat lateral solto à direita; Mesa principal minimizada; sem sobreposição', conversao: 'diálogo de confirmação (o mesmo aviso do 03)', montagem}});
    return [meta17, meta18];
  } finally {
    await app.close();
  }
}

/* Roteiro */
async function main() {
  fs.mkdirSync(OUT, {recursive: true});
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ciclo2-xournal-'));
  const paths = install(base);
  addExtraPages(paths);
  const helper = installX11Helper(base);
  const x11 = makeX11(helper);
  const falhas = [];
  const estados = [];
  let xournal = null;
  let host = null;
  const runState = async (nome, fn) => {
    if (ONLY.size && !ONLY.has(nome)) return;
    try {
      const meta = await fn();
      estados.push({nome, json: meta ? path.basename(`${nome}.json`) : null, seguro: meta ? meta.seguro : null});
      console.log(`ok ${nome}${meta && !meta.seguro ? ' (SEM IMAGEM: janela alheia)' : ''}`);
      return meta;
    } catch (error) {
      falhas.push({nome, erro: String(error?.message || error).split('\n')[0]});
      console.log(`FALHOU ${nome}: ${String(error?.message || error).split('\n')[0]}`);
      return null;
    }
  };
  const startHost = async (overrides = {}) => {
    if (host) { await host.close(); host = null; }
    fs.rmSync(path.join(paths.runtime, 'ink-convert-bridge.json'), {force: true});
    host = bridgeHost(paths.runtime, overrides);
    const {port} = await host.start();
    if (!port) throw Error('a ponte falsa não subiu');
  };
  const stopHost = async () => {
    if (host) { await host.close(); host = null; }
    fs.rmSync(path.join(paths.runtime, 'ink-convert-bridge.json'), {force: true});
  };

  try {
    await primeXournalSettings({base, config: paths.config, home: paths.home, xopp: paths.xopp, binary: xournalBinary(), env: {...process.env, DISPLAY}, waitFor});
    xournal = await launchXournal(base, paths, {display: DISPLAY});
    xournal.page = 1;
    const pid = xournal.pid;
    const mainId = xournal.mainId;
    x11.move(mainId, 0, 0, 800, 650);
    await sleep(800);

    await runState('01-menu-plugin', async () => {
      await x11.focus(mainId);
      const main = windowsOfPid(pid).find((win) => win.id === mainId);
      const images = snapshot(main);
      x11.click(main.x + 440, main.y + 11);
      const popup = await waitFor(() => xournalPopups().find((win) => win.w > 200 && win.w < 500 && win.h > 50 && win.h < 300), {timeout: 5000, what: 'menu do plugin'});
      return captureState({name: '01-menu-plugin', outDir: OUT, ours: [...currentWindows(pid, mainId), {...popup, papel: 'menu'}], x11, images, raise: false});
    });
    await x11.tap('Escape');

    await runState('02-converter-sem-selecao', async () => {
      await x11.focus(mainId);
      x11.tap('Escape');
      const {dialog, meta} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+k', {captureName: '02-converter-sem-selecao', outDir: OUT});
      await clickDialog(x11, dialog, 0.5);
      await waitGone(pid, dialog.id);
      return meta;
    });

    let meta04 = null;
    await runState('03-converter-confirmacao', async () => {
      await startHost({readText: async () => { await sleep(4000); return {text: 'texto convertido sintético', reason: null}; }});
      await x11.focus(mainId);
      x11.key('ctrl+a');
      await sleep(400);
      const {dialog, meta} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+k', {captureName: '03-converter-confirmacao', outDir: OUT});
      meta04 = await confirmConversion(x11, pid, mainId, dialog, 0.25, {frozenName: '04-converter-convertendo', outDir: OUT, afterFrozen: 4200});
      return meta;
    });
    if (meta04) estados.push({nome: '04-converter-convertendo', json: '04-converter-convertendo.json', seguro: meta04.seguro});

    await runState('05-converter-sucesso', async () => captureState({name: '05-converter-sucesso', outDir: OUT, ours: currentWindows(pid, mainId), x11}));

    await runState('06-converter-ponte-desligada', async () => {
      await stopHost();
      await gotoPage(x11, mainId, xournal, 2);
      return bridgeMissingError(x11, pid, mainId, '06-converter-ponte-desligada', OUT);
    });

    await runState('07-converter-erro-quota', async () => {
      await startHost({readText: async () => ({reason: 'quota'})});
      await gotoPage(x11, mainId, xournal, 3);
      return conversionError(x11, pid, mainId, '07-converter-erro-quota', OUT);
    });

    await runState('08-converter-resposta-invalida', async () => {
      await stopHost();
      return withStub(paths.runtime, '{}', async () => {
        await gotoPage(x11, mainId, xournal, 4);
        return conversionError(x11, pid, mainId, '08-converter-resposta-invalida', OUT);
      });
    });

    await runState('09-converter-erro-conexao', async () => {
      await stopHost();
      writeBridge(paths.runtime, await closedPort());
      await gotoPage(x11, mainId, xournal, 5);
      return conversionError(x11, pid, mainId, '09-converter-erro-conexao', OUT);
    });

    await runState('10-converter-timeout', async () => {
      await startHost({requestTimeoutMs: 800, readText: () => new Promise(() => {})});
      await gotoPage(x11, mainId, xournal, 6);
      return conversionError(x11, pid, mainId, '10-converter-timeout', OUT);
    });

    /* Motivos da ponte que a ponte falsa devolve direto (#159). Cada um usa a
       página 6 (só tinta) e o mesmo diálogo de erro; o texto exato vem do
       `Ponte.reasonMessage`. */
    const motivos = [
      ['19-converter-erro-no-model', {pickModel: () => null}],
      ['20-converter-erro-no-vision', {pickModel: () => ({model: null, reason: 'no-vision'})}],
      ['21-converter-erro-free', {pickModel: () => ({model: null, reason: 'free'})}],
      ['24-converter-erro-too-large', {readText: async () => ({reason: 'too-large'})}],
      ['25-converter-erro-bad-request', {readText: async () => ({reason: 'bad-request'})}],
      ['26-converter-erro-forbidden', {readText: async () => ({reason: 'forbidden'})}],
      ['27-converter-erro-desconhecido', {readText: async () => ({reason: 'motivo-novo'})}],
      ['28-converter-resposta-vazia', {readText: async () => ({text: ''})}],
    ];
    for (const [nome, overrides] of motivos) {
      await runState(nome, async () => {
        await startHost(overrides);
        await gotoPage(x11, mainId, xournal, 6);
        return conversionError(x11, pid, mainId, nome, OUT);
      });
    }

    await runState('22-converter-erro-disabled', async () => {
      /* A ponte só sobe com a leitura ligada; o `disabled` aparece quando ela
         é desligada depois, entre a subida e a conversão. */
      const leitura = {ligada: true};
      await startHost({deskState: () => ({inkReading: leitura.ligada})});
      leitura.ligada = false;
      await gotoPage(x11, mainId, xournal, 6);
      return conversionError(x11, pid, mainId, '22-converter-erro-disabled', OUT);
    });

    await runState('23-converter-erro-busy', async () => {
      /* Um pedido direto à ponte (sem o Xournal++) fica em voo no `readText`;
         a conversão do plugin chega enquanto o host está ocupado. */
      await startHost({readText: () => new Promise(() => {})});
      const emVoo = postBusyRequest(paths.runtime);
      await sleep(500);
      await gotoPage(x11, mainId, xournal, 6);
      const meta = await conversionError(x11, pid, mainId, '23-converter-erro-busy', OUT);
      emVoo.destroy();
      await sleep(300);
      return meta;
    });

    let fonteNotice = null;
    await runState('11-trocar-fonte-dialogo', async () => {
      await stopHost();
      await gotoPage(x11, mainId, xournal, 7);
      const {dialog, meta} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+j', {captureName: '11-trocar-fonte-dialogo', outDir: OUT});
      const before = new Set(windowsOfPid(pid).map((win) => win.id));
      await clickDialog(x11, dialog, 0.255);
      await waitGone(pid, dialog.id);
      fonteNotice = await waitFor(() => windowsOfPid(pid).find((win) => !before.has(win.id) && win.id !== dialog.id && win.w > 100 && win.h > 60), {timeout: 8000, what: 'aviso de fonte trocada'});
      return meta;
    });
    await runState('12-trocar-fonte-sucesso', async () => {
      if (!fonteNotice) throw Error('o aviso de "Fonte trocada em N textos" não abriu');
      return captureNotice(x11, pid, mainId, fonteNotice, '12-trocar-fonte-sucesso', OUT);
    });
    await runState('12b-trocar-fonte-aplicada', async () => captureState({name: '12b-trocar-fonte-aplicada', outDir: OUT, ours: currentWindows(pid, mainId), x11}));

    await runState('13-trocar-fonte-sem-texto', async () => {
      await gotoPage(x11, mainId, xournal, 8);
      const {dialog, meta} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+j', {captureName: '13-trocar-fonte-sem-texto', outDir: OUT});
      await clickDialog(x11, dialog, 0.5);
      await waitGone(pid, dialog.id);
      return meta;
    });

    /* Alvos e páginas do Trocar fonte (#159): fontes mistas, segunda página
       ("Mais…" → "Voltar"), a fonte atual escolhida e o alvo por seleção. A
       seleção fica no estado do Xournal++ entre páginas, então o Ctrl+A entra
       por último para não contaminar os outros diálogos. */
    await runState('31-trocar-fonte-fontes-mistas', async () => {
      await gotoPage(x11, mainId, xournal, 10);
      const {dialog, meta} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+j', {captureName: '31-trocar-fonte-fontes-mistas', outDir: OUT});
      await clickDialog(x11, dialog, 0.917);
      await waitGone(pid, dialog.id);
      return meta;
    });
    await runState('32-trocar-fonte-segunda-pagina', async () => {
      await gotoPage(x11, mainId, xournal, 7);
      const {dialog, images} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+j');
      const before = new Set(windowsOfPid(pid).map((win) => win.id));
      await clickDialog(x11, dialog, 0.75);
      const segunda = await waitDialog(pid, before);
      const meta = captureState({name: '32-trocar-fonte-segunda-pagina', outDir: OUT, ours: currentWindows(pid, mainId), x11, images});
      await clickDialog(x11, segunda, 0.929);
      await waitGone(pid, segunda.id);
      return meta;
    });
    await runState('33-trocar-fonte-atual', async () => {
      const {dialog} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+j');
      const before = new Set(windowsOfPid(pid).map((win) => win.id));
      await clickDialog(x11, dialog, 0.255);
      await waitGone(pid, dialog.id);
      const notice = await waitFor(() => windowsOfPid(pid).find((win) => !before.has(win.id) && win.id !== dialog.id && win.w > 100 && win.h > 60), {timeout: 8000, what: 'aviso "Os textos já estão em"'});
      return captureNotice(x11, pid, mainId, notice, '33-trocar-fonte-atual', OUT);
    });
    await runState('30-trocar-fonte-selecao', async () => {
      await gotoPage(x11, mainId, xournal, 7);
      await x11.focus(mainId);
      x11.key('ctrl+a');
      await sleep(400);
      const {dialog, meta} = await shortcutDialog(x11, pid, mainId, 'ctrl+shift+j', {captureName: '30-trocar-fonte-selecao', outDir: OUT});
      await clickDialog(x11, dialog, 0.917);
      await waitGone(pid, dialog.id);
      return meta;
    });

    await runState('14-pagina-antes', async () => {
      await gotoPage(x11, mainId, xournal, 9);
      return captureState({name: '14-pagina-antes', outDir: OUT, ours: currentWindows(pid, mainId), x11});
    });
    await runState('15-pagina-direita', async () => {
      await x11.focus(mainId);
      x11.key('ctrl+alt+r');
      await sleep(900);
      return captureState({name: '15-pagina-direita', outDir: OUT, ours: currentWindows(pid, mainId), x11});
    });
    await runState('16-pagina-abaixo', async () => {
      await x11.focus(mainId);
      x11.key('ctrl+alt+b');
      await sleep(900);
      return captureState({name: '16-pagina-abaixo', outDir: OUT, ours: currentWindows(pid, mainId), x11});
    });
    await runState('17-montagem-real', async () => {
      /* O 18 lê o diálogo de confirmação; a ponte precisa existir (é o mesmo
         caminho do 03), mesmo sem chegar a converter. */
      await startHost({readText: async () => { await sleep(4000); return {text: 'texto convertido sintético', reason: null}; }});
      const [meta17, meta18] = await montage(OUT, x11, xournal);
      estados.push({nome: '18-montagem-real-convertendo', json: '18-montagem-real-convertendo.json', seguro: meta18.seguro});
      return meta17;
    });
  } finally {
    try { await stopHost(); } catch { /* já fechou */ }
    killXournal(xournal?.child);
    if (!KEEP) fs.rmSync(base, {recursive: true, force: true});
    const resumo = {
      geradoEm: new Date().toISOString(),
      ambiente: {display: DISPLAY, tela: '1366x768', xournalpp: '1.3.8'},
      saida: path.relative(REPO, OUT),
      estados, falhas,
      naoCapturado: [
        {estado: 'Windows: "A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS."', motivo: 'sem máquina Windows neste ciclo; mensagem no inventário por main.lua'},
        {estado: 'Falha de preparo: "Não consegui preparar a conversão." e "Não consegui preparar a conversão (<motivo>)."', motivo: 'exigiriam os.tmpname/io.open falhando ou buildCurlCommand recusando caminho; não foram forçadas'},
        {estado: 'Falha ao criar textos com a fonte nova: "Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam."', motivo: 'exigiria app.addTexts falhando; não foi forçado'},
        {estado: '"Nenhum traço desenhável na seleção. Selecione a tinta a converter."', motivo: 'a API do Xournal++ só devolve traços com pontos válidos, e o pad de 10 pt do SVG cobre bbox de largura/altura zero; não é provocável sem mexer no plugin'},
      ],
      privacidade: 'as imagens são composições só das janelas de teste; cada JSON lista o recorte, as janelas e se havia intrusa',
    };
    fs.writeFileSync(path.join(OUT, 'capturas.json'), `${JSON.stringify(resumo, null, 2)}\n`);
  }
  if (falhas.length) {
    console.error(`capturas com ${falhas.length} falha(s) em ${OUT}`);
    process.exitCode = 1;
  } else {
    console.log(`capturas do ciclo 2 (Xournal++) em ${OUT}`);
  }
}
await main();
