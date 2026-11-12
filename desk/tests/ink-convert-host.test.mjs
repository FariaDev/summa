/* Ponte local que converte tinta em texto (#159): só sobe com a opção de
   leitura da tinta ligada, no 127.0.0.1 com token em arquivo 0600, uma rota
   `POST /converter`, um pedido por vez. O SVG entra no formato restrito;
   o texto sai do `readText` injetado (o fake tem nome); nada de SVG, texto
   lido ou token vai para o log. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {REQUEST_TIMEOUT_MS, createInkConvertHost, createInkRenderer, checkInkSvg, inkReadingEnabled, lockInkSession} = require('../ink-convert-host.cjs');
const {createFakeInkRenderer} = require('./fake-ink-renderer.cjs');
const {createFakeInkReader} = require('./fake-ink-reader.cjs');
const {createFakeInkWindowFactory} = require('./fake-ink-window.cjs');
const {sanitizeState} = require('../desk-state-sanitize.cjs');
const {registerNotebooksHost} = require('../notebooks-host.cjs');

/* SVG gerado pelo converter.lua real (fixture commitada em
   tests/fixtures/mesa-pagina-ink.svg; o comando de regeneração está em
   tests/xournal-lua.test.mjs). O formato restrito da ponte tem de aceitar
   exatamente o que o plugin emite (#159, revisão). */
const VALID_SVG = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'mesa-pagina-ink.svg'), 'utf8').trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tempRuntime(t, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-ink-convert-${tag}-`));
  t.after(() => { try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* o ponte também apaga */ } });
  return dir;
}

function startedHost(t, {enabled = true, runtime = tempRuntime(t, 'host'), reader = createFakeInkReader(), renderer = createFakeInkRenderer(), pickModel = () => ({model: 'fake', reason: null}), logs = [], requestTimeoutMs, now} = {}) {
  const deps = {
    runtime,
    deskState: () => ({inkReading: enabled}),
    readText: (png, options) => reader.readText(png, options),
    renderSvg: (svg, options) => renderer.render(svg, options),
    pickModel,
    log: (line) => { logs.push(String(line)); },
  };
  if (requestTimeoutMs !== undefined) deps.requestTimeoutMs = requestTimeoutMs;
  if (now !== undefined) deps.now = now;
  const host = createInkConvertHost(deps);
  t.after(async () => { await host.close().catch(() => {}); });
  return {host, runtime, reader, renderer, logs};
}

async function post(host, {token, body = VALID_SVG, contentType = 'application/json', signal} = {}) {
  const file = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
  const headers = {'content-type': contentType};
  if (token !== undefined) headers['x-mesa-token'] = token;
  const response = await fetch(`http://127.0.0.1:${file.port}/converter`, {
    method: 'POST', headers, body: JSON.stringify({svg: body}), signal,
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* corpo de erro simples segue cru */ }
  return {status: response.status, json, text, file};
}

function postRaw(host, {token, body, hostHeader, chunks}) {
  return new Promise((resolve, reject) => {
    const file = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
    const headers = {'content-type': 'application/json', 'x-mesa-token': token};
    if (hostHeader !== undefined) headers.host = hostHeader;
    const req = http.request({hostname: '127.0.0.1', port: file.port, path: '/converter', method: 'POST', headers}, (res) => {
      const parts = [];
      res.on('data', (chunk) => parts.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(parts).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* segue cru */ }
        resolve({status: res.statusCode, json, text});
      });
    });
    req.on('error', reject);
    if (chunks) {
      for (const chunk of chunks) req.write(chunk);
      req.end();
    } else {
      req.end(JSON.stringify({svg: body}));
    }
  });
}

test('sem token ou token errado: 403, sem chamar o renderizador nem o leitor', async (t) => {
  const {host, renderer, reader} = startedHost(t);
  await host.start();
  for (const token of [undefined, 'token-errado']) {
    const {status, json} = await post({bridgeFile: host.bridgeFile}, {token});
    assert.equal(status, 403, `token ${String(token)} devia casar 403`);
    assert.equal(json?.reason, 'forbidden');
  }
  assert.equal(renderer.calls.length, 0);
  assert.equal(reader.calls.length, 0);
});

test('corpo acima de 300 KiB: 413', async (t) => {
  const {host} = startedHost(t);
  const file = await host.start();
  const big = 'a'.repeat(310 * 1024);
  const {status} = await post({bridgeFile: host.bridgeFile}, {token: file.token, body: big});
  assert.equal(status, 413);
});

test('Content-Type que não é application/json: 400', async (t) => {
  const {host} = startedHost(t);
  const file = await host.start();
  const {status} = await post({bridgeFile: host.bridgeFile}, {token: file.token, contentType: 'text/plain'});
  assert.equal(status, 400);
});

test('SVG fora do formato restrito: 400 (script, href, image, entidade)', async (t) => {
  const {host, renderer, reader} = startedHost(t);
  const file = await host.start();
  const bad = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M0 0 L1 1" stroke="#000" stroke-width="1" href="https://x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><image href="data:image/png;base64,xa=="/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M0 0 L1 1" stroke="&amp;" stroke-width="1"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="1" cy="1" r="1"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M0 0 L1 1" stroke="#000" stroke-width="1" onclick="x()"/></svg>',
  ];
  for (const svg of bad) {
    const {status, json} = await post({bridgeFile: host.bridgeFile}, {token: file.token, body: svg});
    assert.equal(status, 400, `SVG devia casar 400: ${svg.slice(0, 80)}`);
    assert.equal(json?.reason, 'bad-request');
  }
  assert.equal(renderer.calls.length, 0);
  assert.equal(reader.calls.length, 0);
});

test('pedido válido com readText falso: {text}, renderizador antes do leitor', async (t) => {
  const {host, renderer, reader} = startedHost(t, {reader: createFakeInkReader({text: 'limite lateral do caderno'})});
  const file = await host.start();
  const {status, json} = await post({bridgeFile: host.bridgeFile}, {token: file.token});
  assert.equal(status, 200);
  assert.deepEqual(json, {text: 'limite lateral do caderno'});
  assert.deepEqual(renderer.calls, [VALID_SVG]);
  assert.deepEqual(reader.calls, [renderer.png]);
});

test('leitor com quota: {reason: quota}', async (t) => {
  const {host} = startedHost(t, {reader: createFakeInkReader({quota: true})});
  const file = await host.start();
  const {status, json} = await post({bridgeFile: host.bridgeFile}, {token: file.token});
  assert.equal(status, 200);
  assert.deepEqual(json, {reason: 'quota'});
});

test('segundo pedido enquanto o primeiro lê: busy', async (t) => {
  const reader = createFakeInkReader({text: 'primeiro', delayMs: 800});
  const {host, renderer} = startedHost(t, {reader});
  const file = await host.start();
  const {bridgeFile} = host;
  const first = post({bridgeFile}, {token: file.token});
  const second = await post({bridgeFile}, {token: file.token});
  assert.equal(second.status, 200);
  assert.deepEqual(second.json, {reason: 'busy'});
  const done = await first;
  assert.equal(done.status, 200);
  assert.deepEqual(done.json, {text: 'primeiro'});
  assert.equal(renderer.calls.length, 1, 'o busy nem chega a renderizar');
});

test('modelo sem visão/free/no-model via pickModel: {reason} sem renderizar', async (t) => {
  for (const reason of ['no-vision', 'free', 'no-model']) {
    const {host, renderer, reader} = startedHost(t, {pickModel: () => ({model: null, reason})});
    const file = await host.start();
    const {status, json} = await post({bridgeFile: host.bridgeFile}, {token: file.token});
    assert.equal(status, 200);
    assert.deepEqual(json, {reason});
    assert.equal(renderer.calls.length, 0);
    assert.equal(reader.calls.length, 0);
    await host.close();
  }
});

test('opção desligada: o servidor não sobe e o arquivo não existe', async (t) => {
  const {host, runtime, reader, renderer} = startedHost(t, {enabled: false});
  const info = await host.start();
  assert.equal(info.port, 0);
  assert.equal(fs.existsSync(host.bridgeFile), false);
  assert.equal(fs.existsSync(path.join(runtime, 'ink-convert-bridge.json')), false);
  assert.equal(reader.calls.length, 0, 'com inkReading falso, readText nunca é chamado');
  assert.equal(renderer.calls.length, 0, 'com inkReading falso, renderSvg nunca é chamado');
});

test('arquivo de ponte com modo 0600 e token de 32 bytes; close apaga', async (t) => {
  const {host} = startedHost(t);
  const info = await host.start();
  assert.ok(info.port > 0);
  const stat = fs.statSync(host.bridgeFile);
  if (process.platform !== 'win32') assert.equal(stat.mode & 0o777, 0o600, 'no Windows os bits de modo POSIX não existem');
  const data = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
  assert.equal(data.port, info.port);
  assert.equal(Buffer.from(data.token, 'base64url').length, 32);
  assert.equal(data.token, info.token);
  await host.close();
  assert.equal(fs.existsSync(host.bridgeFile), false);
});

test('log nunca leva token, SVG nem texto lido', async (t) => {
  const secret = 'TEXTO-SECRETO-XYZ';
  const {host, logs} = startedHost(t, {reader: createFakeInkReader({text: secret})});
  const file = await host.start();
  await post({bridgeFile: host.bridgeFile}, {token: file.token});
  await post({bridgeFile: host.bridgeFile}, {token: 'errado'});
  await post({bridgeFile: host.bridgeFile}, {token: file.token, body: '<svg><script>a</svg>'});
  const joined = logs.join('\n');
  assert.ok(!joined.includes(file.token), 'o token não é logado');
  assert.ok(!joined.includes(secret), 'o texto lido não é logado');
  assert.ok(!joined.includes(VALID_SVG), 'o SVG não é logado');
});

test('log mede a conversão com relógio injetado, sem o texto lido', async (t) => {
  const secret = 'TEXTO-SECRETO-DO-LOG';
  const ticks = [1000, 1042];
  const {host, logs} = startedHost(t, {reader: createFakeInkReader({text: secret}), now: () => ticks.shift()});
  const file = await host.start();
  const {status, json} = await post({bridgeFile: host.bridgeFile}, {token: file.token});
  assert.equal(status, 200);
  assert.deepEqual(json, {text: secret});
  const pronto = logs.find((line) => line.startsWith('converter: pronto em '));
  assert.equal(pronto, 'converter: pronto em 42 ms');
  assert.ok(!pronto.includes(secret), 'a linha de tempo não leva o texto lido');
  assert.ok(!pronto.includes(file.token), 'a linha de tempo não leva o token');
});

test('log mede a falha e o timeout em ms', async (t) => {
  const falhaTicks = [2000, 2013];
  const {host: hostFalha, logs: logsFalha} = startedHost(t, {reader: createFakeInkReader({quota: true}), now: () => falhaTicks.shift()});
  const fileFalha = await hostFalha.start();
  const respostaFalha = await post({bridgeFile: hostFalha.bridgeFile}, {token: fileFalha.token});
  assert.deepEqual(respostaFalha.json, {reason: 'quota'});
  assert.ok(logsFalha.includes('converter: falha em 13 ms'), `esperava a falha medida: ${logsFalha.join(' | ')}`);

  const timeoutTicks = [3000, 3030];
  const {host: hostTimeout, logs: logsTimeout} = startedHost(t, {reader: createFakeInkReader({never: true}), requestTimeoutMs: 30, now: () => timeoutTicks.shift()});
  const fileTimeout = await hostTimeout.start();
  const respostaTimeout = await post({bridgeFile: hostTimeout.bridgeFile}, {token: fileTimeout.token});
  assert.deepEqual(respostaTimeout.json, {reason: 'timeout'});
  assert.ok(logsTimeout.includes('converter: timeout em 30 ms'), `esperava o timeout medido: ${logsTimeout.join(' | ')}`);
});

test('inkReadingEnabled lê inkReading do estado com padrão false', () => {
  assert.equal(inkReadingEnabled({}), false);
  assert.equal(inkReadingEnabled(null), false);
  assert.equal(inkReadingEnabled({inkReading: true}), true);
  assert.equal(inkReadingEnabled({inkReading: 1}), false);
  assert.equal(inkReadingEnabled({inkReading: 'true'}), false);
});

test('checkInkSvg aceita o formato do plugin e recusa o resto', () => {
  const ok = checkInkSvg(VALID_SVG);
  assert.equal(ok.ok, true);
  assert.ok(ok.width > 0 && ok.height > 0, 'tamanho para a janela de renderização');
  for (const svg of ['', 42, null, '<svg>', '<svg><rect/></svg>', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><path d="M0 0"/></svg>']) {
    const result = checkInkSvg(svg);
    assert.equal(result.ok, false, `devia recusar: ${String(svg).slice(0, 60)}`);
  }
});

test('ponte escuta só em 127.0.0.1', () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'ink-convert-host.cjs'), 'utf8');
  assert.match(source, /listen\(\s*0\s*,\s*'127\.0\.0\.1'/, 'a ponte tem de escutar em 127.0.0.1');
  assert.ok(!/listen\(\s*0\s*,\s*['"]0\.0\.0\.0['"]/.test(source), 'não pode escutar em 0.0.0.0');
});

test('corpo chunked acima de 300 KiB: 413 sem content-length', async (t) => {
  const {host, renderer, reader} = startedHost(t);
  const file = await host.start();
  const first = JSON.stringify({svg: VALID_SVG});
  const big = 'a'.repeat(310 * 1024);
  const payload = JSON.stringify({svg: big});
  const chunks = [payload.slice(0, 100 * 1024), payload.slice(100 * 1024, 200 * 1024), payload.slice(200 * 1024)];
  const {status} = await postRaw({bridgeFile: host.bridgeFile}, {token: file.token, chunks});
  assert.equal(status, 413);
  assert.equal(renderer.calls.length, 0);
  assert.equal(reader.calls.length, 0);
  assert.ok(first.length > 0);
});

test('arquivo preexistente 0644 vira 0600 de verdade', {skip: process.platform === 'win32' && 'bits de modo POSIX (0600/0644) não existem no Windows'}, async (t) => {
  const {host} = startedHost(t);
  fs.mkdirSync(path.dirname(host.bridgeFile), {recursive: true});
  fs.writeFileSync(host.bridgeFile, JSON.stringify({port: 12345, token: 'velho'}), {mode: 0o644});
  fs.chmodSync(host.bridgeFile, 0o644);
  assert.equal(fs.statSync(host.bridgeFile).mode & 0o777, 0o644);
  const info = await host.start();
  assert.ok(info.port > 0);
  assert.equal(fs.statSync(host.bridgeFile).mode & 0o777, 0o600, 'o arquivo final tem de ser 0600 mesmo com prévio 0644');
  const data = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
  assert.equal(data.token, info.token);
  assert.notEqual(data.token, 'velho');
});

test('Host diferente de 127.0.0.1/localhost com a porta: 403 sem renderizar', async (t) => {
  const {host, renderer, reader} = startedHost(t);
  const file = await host.start();
  for (const hostHeader of ['evil.example', '127.0.0.1:1', 'localhost:1', `192.168.0.1:${file.port}`]) {
    const {status, json} = await postRaw({bridgeFile: host.bridgeFile}, {token: file.token, body: VALID_SVG, hostHeader});
    assert.equal(status, 403, `Host ${hostHeader} devia casar 403`);
    assert.equal(json?.reason, 'forbidden');
  }
  assert.equal(renderer.calls.length, 0);
  assert.equal(reader.calls.length, 0);
  const ok127 = await postRaw({bridgeFile: host.bridgeFile}, {token: file.token, body: VALID_SVG, hostHeader: `127.0.0.1:${file.port}`});
  assert.equal(ok127.status, 200);
  const okLocal = await postRaw({bridgeFile: host.bridgeFile}, {token: file.token, body: VALID_SVG, hostHeader: `localhost:${file.port}`});
  assert.equal(okLocal.status, 200);
});

test('sanitizeState só liga inkReading com true e descarta 1/"true"', () => {
  assert.equal(sanitizeState({inkReading: true}).inkReading, true);
  assert.equal(sanitizeState({inkReading: 1}).inkReading, false);
  assert.equal(sanitizeState({inkReading: 'true'}).inkReading, false);
  assert.equal(sanitizeState({}).inkReading, false);
});

test('pickModel obrigatório: sem ele start não sobe e nada renderiza', async (t) => {
  const runtime = tempRuntime(t, 'no-model');
  const reader = createFakeInkReader();
  const renderer = createFakeInkRenderer();
  const host = createInkConvertHost({
    runtime,
    deskState: () => ({inkReading: true}),
    readText: (png, options) => reader.readText(png, options),
    renderSvg: (svg, options) => renderer.render(svg, options),
    log: () => {},
  });
  t.after(async () => { await host.close().catch(() => {}); });
  const info = await host.start();
  assert.equal(info.port, 0, 'sem pickModel a ponte não sobe');
  assert.equal(info.token, '');
  assert.equal(fs.existsSync(host.bridgeFile), false);
  assert.equal(renderer.calls.length, 0);
  assert.equal(reader.calls.length, 0);
  const hostNull = createInkConvertHost({
    runtime: tempRuntime(t, 'no-model-null'),
    deskState: () => ({inkReading: true}),
    readText: (png, options) => reader.readText(png, options),
    renderSvg: (svg, options) => renderer.render(svg, options),
    pickModel: null,
    log: () => {},
  });
  t.after(async () => { await hostNull.close().catch(() => {}); });
  const infoNull = await hostNull.start();
  assert.equal(infoNull.port, 0, 'pickModel null também não sobe');
  assert.equal(fs.existsSync(hostNull.bridgeFile), false);
});

test('teto curto com leitor que nunca resolve: {reason: timeout} e busy liberado', async (t) => {
  const reader = createFakeInkReader({never: true});
  const {host, renderer} = startedHost(t, {reader, requestTimeoutMs: 80});
  const file = await host.start();
  const result = await Promise.race([post({bridgeFile: host.bridgeFile}, {token: file.token}), sleep(2000).then(() => null)]);
  assert.ok(result !== null, 'a conversão tem de responder no teto mesmo sem honrar o signal');
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, {reason: 'timeout'});
  assert.equal(renderer.signals.length, 1, 'o render recebe o signal');
  assert.equal(reader.signals.length, 1, 'o leitor recebe o signal');
  assert.equal(reader.signals[0].aborted, true, 'o abort dispara no teto');
  await sleep(50);
  const busyFree = await Promise.race([post({bridgeFile: host.bridgeFile}, {token: file.token}), sleep(2000).then(() => null)]);
  assert.ok(busyFree !== null, 'busy tem de liberar após o timeout');
  assert.equal(busyFree.status, 200);
  assert.deepEqual(busyFree.json, {reason: 'timeout'}, 'a segunda também expira no teto, não fica busy');
});

test('render com teto curto e render que nunca resolve: timeout sem travar', async (t) => {
  const renderer = createFakeInkRenderer({never: true});
  const {host, reader} = startedHost(t, {renderer, requestTimeoutMs: 80});
  const file = await host.start();
  const result = await Promise.race([post({bridgeFile: host.bridgeFile}, {token: file.token}), sleep(2000).then(() => null)]);
  assert.ok(result !== null, 'o teto vale também travado no render');
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, {reason: 'timeout'});
  assert.equal(reader.calls.length, 0);
});

test('sessão da janela bloqueia rede que não é o próprio data:', () => {
  assert.equal(typeof lockInkSession, 'function', 'lockInkSession tem de ser exportado para o teste');
  const seen = [];
  let handler = null;
  const session = {
    setPermissionRequestHandler: (fn) => { seen.push(fn); },
    setPermissionCheckHandler: (fn) => { seen.push(fn); },
    webRequest: {onBeforeRequest: (fn) => { handler = fn; }},
  };
  lockInkSession(session);
  assert.ok(handler, 'onBeforeRequest tem de ser registrado');
  const decisions = [];
  handler({url: 'data:text/html;charset=utf-8,oi'}, (decision) => decisions.push(decision));
  handler({url: 'http://evil.example/x'}, (decision) => decisions.push(decision));
  handler({url: 'https://evil.example/x'}, (decision) => decisions.push(decision));
  handler({url: 'file:///etc/passwd'}, (decision) => decisions.push(decision));
  assert.deepEqual(decisions, [{cancel: false}, {cancel: true}, {cancel: true}, {cancel: true}]);
});

test('fill/stroke só #RGB/#RRGGBB/none/white/black', () => {
  const base = (attrs) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="0" width="10" height="10" ${attrs}/></svg>`;
  for (const ok of ['#fff', '#ffffff', '#FFF', '#FFFFFF', 'none', 'white', 'black']) {
    const result = checkInkSvg(base(`fill="${ok}"`));
    assert.equal(result.ok, true, `fill=${ok} tinha de passar`);
  }
  for (const bad of ['red', 'blue', 'rgb(0,0,0)', '#ffff', '#ffffff00', 'currentColor', 'url(http://x)', 'transparent', 'WHITE']) {
    const result = checkInkSvg(base(`fill="${bad}"`));
    assert.equal(result.ok, false, `fill=${bad} tinha de recusar`);
  }
  const pathBad = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M0 0 L1 1" stroke="red" stroke-width="1" fill="none"/></svg>';
  assert.equal(checkInkSvg(pathBad).ok, false, 'stroke nomeado tem de recusar');
  const pathOk = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M0 0 L1 1" stroke="#000" stroke-width="1" fill="black"/></svg>';
  assert.equal(checkInkSvg(pathOk).ok, true);
});

test('svgSize aceita aspas simples', () => {
  const single = "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'><rect x='0' y='0' width='10' height='10' fill='#fff'/></svg>";
  const result = checkInkSvg(single);
  assert.equal(result.ok, true, 'svg com aspas simples tinha de passar');
  assert.equal(result.width, 120);
  assert.equal(result.height, 80);
});

test('<rect/> auto-fechado dentro de <rect> é recusado', () => {
  const nested = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="0" width="50" height="50"><rect x="1" y="1" width="5" height="5" fill="#fff"/></rect></svg>';
  assert.equal(checkInkSvg(nested).ok, false, 'aninhado auto-fechado tinha de recusar');
  const nestedPath = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="0" width="50" height="50"><path d="M0 0 L1 1" stroke="#000" stroke-width="1"/></rect></svg>';
  assert.equal(checkInkSvg(nestedPath).ok, false);
  const siblings = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="0" width="10" height="10" fill="#fff"/><rect x="20" y="0" width="10" height="10" fill="#fff"/></svg>';
  assert.equal(checkInkSvg(siblings).ok, true, 'irmãos continuam válidos');
});

test('registerNotebooksHost guarda a ponte e devolve close/stopInkConvert', async (t) => {
  const runtime = tempRuntime(t, 'notebooks-close');
  const reader = createFakeInkReader();
  const renderer = createFakeInkRenderer();
  const handlers = new Map();
  const ipcMain = {handle: (channel, fn) => handlers.set(channel, fn)};
  const result = registerNotebooksHost({
    ipcMain,
    courses: () => [],
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {},
    inkConvert: {
      runtime,
      deskState: () => ({inkReading: true}),
      readText: (png, options) => reader.readText(png, options),
      renderSvg: (svg, options) => renderer.render(svg, options),
      pickModel: () => ({model: 'fake', reason: null}),
    },
  });
  assert.ok(result && typeof result === 'object', 'registerNotebooksHost tem de devolver o controle da ponte');
  const closer = result.close || result.stopInkConvert || result.closeInkConvert;
  assert.equal(typeof closer, 'function', 'devolve close() ou stopInkConvert para o before-quit do main');
  await sleep(100);
  const bridgeFile = path.join(runtime, 'ink-convert-bridge.json');
  assert.equal(fs.existsSync(bridgeFile), true, 'a ponte sobe no registro');
  await closer();
  assert.equal(fs.existsSync(bridgeFile), false, 'close apaga o arquivo de ponte');
  const after = await closer();
  assert.equal(after, undefined, 'close duplo não lança');
});

test('render recebe signal e fecha a janela no abort', async () => {
  const factory = createFakeInkWindowFactory({hangLoad: true});
  const render = createInkRenderer({createWindow: factory.createWindow});
  const controller = new AbortController();
  const pending = render(VALID_SVG, {signal: controller.signal});
  pending.catch(() => {});
  await sleep(50);
  assert.equal(factory.created.length, 1);
  const created = factory.created[0];
  assert.equal(created.state.destroyed, false);
  controller.abort();
  const outcome = await Promise.race([pending.then(() => 'resolved', () => 'rejected'), sleep(2000).then(() => 'stuck')]);
  assert.notEqual(outcome, 'stuck', 'o render tem de encerrar no abort');
  assert.equal(created.state.destroyed, true, 'o abort fecha a janela escondida');
});

test('DPR 2: a captura física é normalizada para o tamanho do SVG', async () => {
  const factory = createFakeInkWindowFactory({scaleFactor: 2});
  const render = createInkRenderer({createWindow: factory.createWindow});
  const png = await render(VALID_SVG);
  assert.deepEqual(factory.created[0].state.captures[0].getSize(), {width: 120, height: 80}, 'a captura sai com o dobro do SVG');
  assert.equal(Buffer.from(png, 'base64').toString(), 'fake-ink-60x40', 'o PNG devolvido tem o tamanho lógico do SVG');
});

test('B4: start/close serializados; o close antigo não apaga o arquivo do servidor novo', async (t) => {
  const reader = createFakeInkReader({text: 'demorou', delayMs: 300});
  const {host} = startedHost(t, {reader});
  const first = await host.start();
  const firstFile = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
  assert.equal(first.port, firstFile.port);
  const inFlight = post({bridgeFile: host.bridgeFile}, {token: firstFile.token});
  /* Condição, não relógio: sob carga o fetch pode demorar a chegar e o close
     fechava a ponte antes de a conversão entrar em voo (#182). */
  const inFlightDeadline = Date.now() + 5000;
  while (reader.calls.length === 0 && Date.now() < inFlightDeadline) await sleep(10);
  assert.equal(reader.calls.length, 1, 'premissa: a conversão em voo começou antes do close');
  const stopping = host.close();
  /* `close()` já entrou na fila de forma síncrona; `start()` fica depois. */
  const second = await host.start();
  const conversion = await inFlight;
  await stopping;
  assert.equal(conversion.status, 200);
  assert.deepEqual(conversion.json, {text: 'demorou'});
  assert.ok(second.port > 0, 'o start depois do close sobe um servidor novo');
  assert.equal(fs.existsSync(host.bridgeFile), true, 'o close antigo não pode apagar o arquivo do servidor novo');
  const current = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
  assert.equal(current.port, second.port);
  assert.equal(current.token, second.token);
});

test('teto padrão do host desiste antes do --max-time do plugin (#159)', () => {
  const plugin = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'xournal-plugins', 'MesaPagina', 'ponte.lua'), 'utf8');
  const match = /--max-time\s+(\d+)/.exec(plugin);
  assert.ok(match, 'o curl do plugin precisa declarar --max-time');
  const pluginMs = Number(match[1]) * 1000;
  assert.ok(REQUEST_TIMEOUT_MS < pluginMs,
    `o host (${REQUEST_TIMEOUT_MS} ms) tem de desistir antes do plugin (${pluginMs} ms) para o "tente de novo" não cair em busy`);
});

test('cliente some antes do fim: aborta o trabalho e libera o busy', async (t) => {
  const reader = createFakeInkReader({never: true});
  const {host} = startedHost(t, {reader, requestTimeoutMs: 400});
  const file = await host.start();
  const controller = new AbortController();
  const first = post({bridgeFile: host.bridgeFile}, {token: file.token, signal: controller.signal}).catch(() => null);
  await sleep(60);
  controller.abort();
  await first;
  await sleep(60);
  assert.equal(reader.signals.length, 1, 'o leitor recebeu o signal');
  assert.equal(reader.signals[0].aborted, true, 'o cliente sumir aborta o trabalho em voo');
  const retry = await Promise.race([post({bridgeFile: host.bridgeFile}, {token: file.token}), sleep(2000).then(() => null)]);
  assert.ok(retry !== null, 'o retry responde no teto');
  assert.deepEqual(retry.json, {reason: 'timeout'}, 'o retry depois do cliente sumir não cai em busy');
});

test('M3: convert passa o modelo verificado do pick ao readText', async (t) => {
  const reader = createFakeInkReader({text: 'convertido'});
  const renderer = createFakeInkRenderer({delayMs: 80});
  const {host} = startedHost(t, {
    reader,
    renderer,
    pickModel: () => ({model: 'xai/grok-vision', effort: 'high', reason: null}),
  });
  const file = await host.start();
  const {status, json} = await post({bridgeFile: host.bridgeFile}, {token: file.token});
  assert.equal(status, 200);
  assert.deepEqual(json, {text: 'convertido'});
  assert.deepEqual(reader.selections, [{model: 'xai/grok-vision', effort: 'high'}],
    'o readText recebe o modelo verificado no pick, não a seleção viva');
});

test('bridge file órfão de processo morto some na partida; o de Mesa viva fica (#212)', async (t) => {
  const live = startedHost(t);
  const liveInfo = await live.host.start();
  assert.ok(liveInfo.port > 0, 'premissa: a ponte subiu');
  const written = JSON.parse(fs.readFileSync(live.host.bridgeFile, 'utf8'));
  assert.equal(written.pid, process.pid, 'o arquivo leva o PID da Mesa');
  await live.host.close();

  const dead = spawnSync(process.execPath, ['-e', ''], {stdio: 'ignore'});
  assert.ok(dead.pid > 0, 'premissa: o processo morto teve PID');
  const runtime = tempRuntime(t, 'orphan');
  const {host} = startedHost(t, {enabled: false, runtime});
  const file = path.join(runtime, 'ink-convert-bridge.json');

  fs.writeFileSync(file, JSON.stringify({port: 40001, token: 'fantasma', pid: dead.pid}));
  const info = await host.start();
  assert.equal(info.port, 0);
  assert.equal(fs.existsSync(file), false, 'órfão de processo morto é apagado mesmo com a conversão desligada');

  fs.writeFileSync(file, JSON.stringify({port: 40002, token: 'viva', pid: process.pid}));
  await host.start();
  assert.equal(fs.existsSync(file), true, 'o arquivo de outra Mesa viva não pode ser apagado');

  fs.writeFileSync(file, JSON.stringify({port: 40003, token: 'sem-pid'}));
  await host.start();
  assert.equal(fs.existsSync(file), true, 'sem PID (arquivo de versão anterior) não dá para distinguir; preserva');
});

test('runtime da ponte nasce com 0700 (#212)', {skip: process.platform === 'win32' && 'no Windows não há bits POSIX'}, async (t) => {
  const runtime = path.join(tempRuntime(t, 'mode'), 'runtime');
  const previousUmask = process.umask(0o022);
  t.after(() => process.umask(previousUmask));
  const {host} = startedHost(t, {runtime});
  assert.equal(fs.existsSync(runtime), false, 'premissa: a pasta ainda não existe');
  await host.start();
  assert.equal(fs.statSync(runtime).mode & 0o777, 0o700, 'a pasta do runtime não abre para grupo/outros');
});
