/* Ensaio "Mesa aberta" do update no Windows (#6). A versão de partida é o
   código deste checkout marcado com a versão do input; o alvo é a release
   assinada publicada. A Mesa sobe com runtime de ensaio, um processo filho com
   ELECTRON_RUN_AS_NODE segura o `electron.exe` do `node_modules` (o papel do
   MCP da Mesa) e o update é disparado pelo MESMO IPC do clique em "Atualizar e
   reiniciar" no Sobre. Roda só no `ensaio-windows.yml`: não é teste do
   `npm test` nem do `npm run ui`.

   Por que a partida é o código do PR e não a tag publicada: até a #47 nenhuma
   versão tinha a espera pelos processos do Electron, e o `update-apply` recusa
   em `DESK_TEST` em todas as tags. Rodar a tag antiga exercitaria o updater
   velho (sem o #47), então o ensaio desfaria justamente a correção que ele
   precisa provar. O `ensaio-windows.yml` instala uma cópia deste checkout com
   a versão do input e aponta só as URLs de release para o repositório que
   ainda tem os assets assinados (mesa-de-estudos; a ponte da 1.3.0 troca para
   o summa).

   Uso: node scripts/update-open-rehearsal.mjs
        DESK_DIR=... FROM_VERSION=1.1.0 TO_VERSION=1.2.0 node ... */
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from '@playwright/test';

const require = createRequire(import.meta.url);
const {listElectronProcesses} = require('../updater-npm-ci.cjs');

const DESK = path.resolve(process.env.DESK_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const ELECTRON = process.env.ELECTRON_BIN || path.join(DESK, 'node_modules', 'electron', 'dist', 'electron.exe');
const RUNTIME = path.resolve(process.env.ENSAIO_RUNTIME || path.join(DESK, '.runtime-mesa-aberta'));
const LOG = path.join(RUNTIME, 'desk.log');
const SENTINEL = path.join(DESK, 'node_modules', '.ensaio-mesa-aberta');
const RELEASE_API = 'https://api.github.com/repos/FariaDev/mesa-de-estudos/releases/latest';
const MCP_GRACE_MS = 6000;
const UPDATE_TIMEOUT_MS = 15 * 60 * 1000;

const log = (line) => console.log(`mesa-aberta: ${line}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function readLog() {
  try { return fs.readFileSync(LOG, 'utf8'); } catch { return ''; }
}

function logTail() {
  const lines = readLog().trim().split('\n');
  return lines.slice(-40).join('\n') || '(sem desk.log)';
}

function semver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value || '').trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

function isNewer(next, current) {
  const left = semver(next), right = semver(current);
  if (!left || !right) return false;
  const at = left.findIndex((part, index) => part !== right[index]);
  return at >= 0 && left[at] > right[at];
}

/** Release assinada mais recente do repositório que ainda publica os assets. */
async function latestVersion() {
  const headers = {'User-Agent': 'summa-ensaio-windows'};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(RELEASE_API, {headers});
  if (!response.ok) throw Error(`GitHub respondeu ${response.status} em ${RELEASE_API}`);
  const version = String((await response.json()).tag_name || '').replace(/^v/, '');
  if (!semver(version)) throw Error(`release sem versão X.Y.Z: recebido ${JSON.stringify(version)}`);
  return version;
}

/* Configuração mínima para a Mesa abrir sem o primeiro uso (vaultPath existe e
   há matéria), com os dados fora do perfil real do runner. O `update.json` já
   traz a release: a checagem automática do Sobre usa o cache (24 h) e não gasta
   a API pública do GitHub, que no runner compartilhado responde 403. */
function seedRuntime(runtime, target) {
  fs.rmSync(runtime, {recursive: true, force: true});
  const course = path.join(runtime, 'learning', 'Courses', 'calc');
  fs.mkdirSync(course, {recursive: true});
  fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({
    vaultPath: runtime,
    courses: [{id: 'calc', name: 'Cálculo', path: course}],
  }) + '\n');
  fs.writeFileSync(path.join(runtime, 'desk.json'), JSON.stringify({courseId: 'calc'}) + '\n');
  fs.writeFileSync(path.join(runtime, 'update.json'), JSON.stringify({
    release: {at: Date.now(), version: target, notes: '', url: ''},
  }, null, 2) + '\n');
}

function appEnv(runtime) {
  const env = {
    ...process.env,
    LEARNING_DESK_RUNTIME: runtime,
    HOME: runtime,
    USERPROFILE: runtime,
    XDG_CONFIG_HOME: path.join(runtime, '.config'),
    LEARNING_DESK_LOCALE: 'pt-BR',
  };
  delete env.DESK_TEST;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/* Mesmo mecanismo do MCP da Mesa (`ELECTRON_RUN_AS_NODE=1` no electron.exe do
   node_modules), mas com um laço que só segura o arquivo: o npm ci tem de
   esperar este processo sair. */
function spawnMcp(env) {
  const child = spawn(ELECTRON, ['-e', 'setInterval(()=>{},1000)'], {
    env: {...env, ELECTRON_RUN_AS_NODE: '1'},
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', (error) => log(`MCP de ensaio falhou: ${error.message}`));
  if (!child.pid) throw Error('MCP de ensaio não nasceu');
  return child;
}

function killChild(child) {
  if (!child || child.exitCode !== null) return;
  try { child.kill(); } catch { /* já saiu */ }
}

/* O updater loga "rodando npm ci" ANTES de esperar os processos. Quando a
   linha aparece, o MCP de ensaio ainda tem de estar vivo para o npm ci real
   colidir sem o #47; ele sai pouco depois, como o MCP que fecha com o app. */
function watchNpmCi(mcp) {
  const started = Date.now();
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    if (Date.now() - started > UPDATE_TIMEOUT_MS) { stop(); return; }
    if (!readLog().includes('rodando npm ci')) return;
    log(`npm ci começou; o MCP de ensaio (pid ${mcp.pid}) sai em ${MCP_GRACE_MS / 1000} s`);
    setTimeout(() => killChild(mcp), MCP_GRACE_MS);
    stop();
  }, 500);
  function stop() { stopped = true; clearInterval(timer); }
  return {stop};
}

async function electronProcesses() {
  try { return await listElectronProcesses(DESK); }
  catch (error) { log(`listagem de processos do Electron falhou: ${error.message}`); return []; }
}

/* Processo já saído entre a listagem e o kill não é falha do ensaio. */
function killPid(pid) {
  try {
    if (process.platform !== 'win32') { process.kill(pid, 'SIGKILL'); return; }
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Stop-Process -Id ${Number(pid)} -Force -ErrorAction SilentlyContinue`], {windowsHide: true, stdio: 'ignore'});
  } catch { /* já saiu */ }
}

async function killElectronProcesses() {
  for (const proc of await electronProcesses()) killPid(proc.pid);
}

async function waitFor(check, timeoutMs, what) {
  const started = Date.now();
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw Error(`tempo esgotado esperando ${what}`);
    await wait(1000);
  }
}

/* A primeira abertura mostra as novidades por cima da Mesa; o ensaio quer o
   caminho do Sobre, não a janela de novidades. */
async function closeDialogs(page) {
  await page.evaluate(() => {
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  });
}

/* A janela de novidades abre em paralelo com o `init`; se ela aparecer entre o
   fechamento e o clique, o clique é tentado de novo depois de fechá-la. */
async function clickMenu(page) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await closeDialogs(page);
    try {
      await page.locator('#settings-menu .nav-trigger').click({timeout: 3000});
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await wait(1000);
    }
  }
}

async function openAbout(page) {
  await clickMenu(page);
  await page.locator('#about').click();
  await page.waitForSelector('#about-dialog[open]', {timeout: 30000});
}

/* O caminho do clique: o mesmo botão que a pessoa usa no Sobre. A checagem
   automática lê o cache preparado pelo ensaio; o botão de aplicar é o real. */
async function clickUpdate(page, target) {
  const check = await page.evaluate(() => window.desk.updateCheck({manual: false})).catch((failure) => ({error: failure.message}));
  log(`update-check em cache: ${JSON.stringify(check)}`);
  try {
    await page.waitForSelector('#update-apply', {timeout: 120000});
  } catch (error) {
    const text = await page.locator('#about-update .update-text').textContent().catch(() => '');
    const raw = await page.evaluate(() => window.desk.updateCheck({manual: true})).catch((failure) => ({error: failure.message}));
    throw Error(`o Sobre não ofereceu Atualizar (${JSON.stringify(text)}; update-check: ${JSON.stringify(raw)})`);
  }
  await page.waitForFunction(
    (version) => (document.querySelector('#about-update .update-text')?.textContent || '').includes(`v${version}`),
    target,
    {timeout: 30000},
  );
  log(`clicando em Atualizar e reiniciar (alvo v${target})`);
  await page.locator('#update-apply').click();
}

async function waitForAppExit(app) {
  const child = app.process();
  if (child.exitCode !== null) return;
  let timer;
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error('a Mesa não fechou 120 s após o clique')), 120000); }),
  ]).finally(() => clearTimeout(timer));
}

async function waitForUpdateResult() {
  return waitFor(() => {
    const result = readJson(path.join(RUNTIME, 'update.json'))?.lastResult;
    if (!result) return null;
    if (result.status === 'applied') return result;
    if (['recovered', 'incomplete', 'refused'].includes(result.status)) {
      throw Error(`update não aplicou: ${result.status} (${result.reason || 'sem motivo'})`);
    }
    return null;
  }, UPDATE_TIMEOUT_MS, 'o resultado do update');
}

function assertInstall(target) {
  const installed = String(readJson(path.join(DESK, 'package.json'))?.version || '');
  if (installed !== target) throw Error(`versão instalada ${installed}; esperado ${target}`);
  if (fs.existsSync(SENTINEL)) {
    throw Error('node_modules não foi refeito: o arquivo de ensaio sobreviveu ao npm ci');
  }
  log(`versão ${installed} no lugar; node_modules refeito (sentinela sumiu)`);
}

async function waitForReopen(before) {
  const reopened = await waitFor(async () => {
    const procs = (await electronProcesses()).filter((proc) => !before.has(proc.pid));
    return procs.length ? procs : null;
  }, 120000, 'a Mesa reabrir');
  await wait(3000);
  const still = (await electronProcesses()).filter((proc) => reopened.some((item) => item.pid === proc.pid));
  if (!still.length) throw Error('a Mesa reabriu e fechou sozinha');
  log(`Mesa reabriu (pid ${still.map((proc) => proc.pid).join(', ')})`);
  return still;
}

async function rehearsal() {
  const from = String(process.env.FROM_VERSION || readJson(path.join(DESK, 'package.json'))?.version || '').replace(/^v/, '');
  const target = String(process.env.TO_VERSION || await latestVersion()).replace(/^v/, '');
  if (!isNewer(target, from)) throw Error(`alvo ${target} não é mais novo que a partida ${from}`);
  seedRuntime(RUNTIME, target);
  fs.mkdirSync(path.dirname(SENTINEL), {recursive: true});
  fs.writeFileSync(SENTINEL, 'ensaio #6\n');
  const env = appEnv(RUNTIME);
  const mcp = spawnMcp(env);
  let app = null;
  let watcher = null;
  try {
    await wait(1000);
    if (mcp.exitCode !== null) throw Error('MCP de ensaio saiu antes da Mesa abrir');
    log(`MCP de ensaio de pé (pid ${mcp.pid}) usando ${ELECTRON}`);
    app = await electron.launch({
      executablePath: ELECTRON,
      args: ['.'],
      cwd: DESK,
      env,
      timeout: 120000,
    });
    const page = await app.firstWindow({timeout: 120000});
    log(`Mesa v${from} aberta (pid ${app.process().pid})`);
    await page.waitForSelector('#settings-menu .nav-trigger', {timeout: 120000});
    const before = new Set((await electronProcesses()).map((proc) => proc.pid));
    await openAbout(page);
    watcher = watchNpmCi(mcp);
    await clickUpdate(page, target);
    await waitForAppExit(app);
    log('Mesa fechou; update em andamento');
    const result = await waitForUpdateResult();
    if (result.version && String(result.version) !== target) {
      throw Error(`o worker aplicou v${result.version}; esperado v${target}`);
    }
    assertInstall(target);
    const reopened = await waitForReopen(before);
    log(`ok — v${target} aplicada, node_modules refeito e Mesa reaberta (pid ${reopened.map((proc) => proc.pid).join(', ')})`);
    for (const proc of reopened) killPid(proc.pid);
  } finally {
    watcher?.stop();
    killChild(mcp);
    if (app) await Promise.race([app.close().catch(() => {}), wait(15000)]);
    await killElectronProcesses();
  }
}

rehearsal().catch((error) => {
  console.error(`mesa-aberta: FALHOU — ${error.message}`);
  console.error(logTail());
  process.exitCode = 1;
});
