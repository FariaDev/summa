// Kit das capturas do ciclo 2 para a parte Xournal++ (#159, #133): lê a tela
// por `xwd`, compõe só as janelas de teste (nunca a raiz inteira) e dirige o
// Xournal++ com Xlib/XTest por um helper Python gerado na pasta temporária —
// sem xdotool, sem instalar nada. Fora do `npm run ui`: quem chama é
// `capture-ciclo2-xournal.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync, spawn} from 'node:child_process';
import {deflateSync} from 'node:zlib';

export const DISPLAY = process.env.CICLO2_DISPLAY || ':0';

/* ------------------------------------------------------------------ */
/* Consulta do X11 (xprop/xwininfo)                                    */
/* ------------------------------------------------------------------ */

const run = (cmd, args) => execFileSync(cmd, args, {
  env: {...process.env, DISPLAY},
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});

const hexIds = (text) => [...String(text).matchAll(/0x[0-9a-f]+/gi)].map((m) => m[0]);

/** Janelas gerenciadas, na ordem em que o WM as empilha (baixo → cima). */
export function stacking() {
  try { return hexIds(run('xprop', ['-root', '_NET_CLIENT_LIST_STACKING'])); } catch { return []; }
}

export function clients() {
  try { return hexIds(run('xprop', ['-root', '_NET_CLIENT_LIST'])); } catch { return []; }
}

/** Propriedades que interessam: pid, classe, título, moldura e estado. */
export function props(id) {
  const text = run('xprop', ['-id', id, '_NET_WM_PID', 'WM_CLASS', '_NET_WM_NAME', '_NET_FRAME_EXTENTS', '_NET_WM_STATE']);
  const pid = /_NET_WM_PID\(CARDINAL\) = (\d+)/.exec(text);
  const cls = /WM_CLASS\(STRING\) = (.*)/.exec(text);
  const name = /_NET_WM_NAME\(UTF8_STRING\) = (.*)/.exec(text);
  const frame = /_NET_FRAME_EXTENTS\(CARDINAL\) = (\d+), (\d+), (\d+), (\d+)/.exec(text);
  return {
    pid: pid ? Number(pid[1]) : 0,
    classe: cls ? cls[1].replace(/"/g, '').split(',').map((part) => part.trim()).join(' / ') : '',
    titulo: name ? name[1].replace(/^"|"$/g, '') : '',
    extents: frame ? {esquerda: +frame[1], direita: +frame[2], topo: +frame[3], baixo: +frame[4]} : {esquerda: 0, direita: 0, topo: 0, baixo: 0},
    estado: /_NET_WM_STATE\(ATOM\) = (.*)/.exec(text)?.[1] || '',
  };
}

/** Geometria absoluta da janela (cliente) e se está mapeada. */
export function geometry(id) {
  const text = run('xwininfo', ['-id', id]);
  const num = (label) => Number(new RegExp(`${label}:\\s+(-?\\d+)`).exec(text)?.[1] || NaN);
  return {
    x: num('Absolute upper-left X'), y: num('Absolute upper-left Y'),
    w: num('Width'), h: num('Height'),
    mapeada: /Map State: IsViewable/.test(text),
  };
}

/** Pids da árvore do processo (o Electron põe a janela num filho). */
export function processTree(rootPid) {
  const text = run('ps', ['-eo', 'pid=,ppid=']);
  const children = new Map();
  for (const line of text.trim().split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  const seen = new Set([rootPid]);
  const queue = [rootPid];
  while (queue.length) {
    for (const child of children.get(queue.shift()) || []) {
      if (seen.has(child)) continue;
      seen.add(child);
      queue.push(child);
    }
  }
  return seen;
}

/** Janelas de um processo (principal e diálogos do plugin). */
export function windowsOfPid(pid) {
  const out = [];
  for (const id of clients()) {
    let info;
    try { info = props(id); } catch { continue; }
    if (info.pid !== pid) continue;
    let geo;
    try { geo = geometry(id); } catch { continue; }
    if (!geo.mapeada) continue;
    out.push({id, ...info, ...geo});
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ações no X11 (helper Python com libX11/libXtst)                     */
/* ------------------------------------------------------------------ */

const X11CTL = String.raw`#!/usr/bin/env python3
import ctypes, sys, time, os
D = os.environ.get('DISPLAY', ':0').encode()
x11 = ctypes.CDLL('libX11.so.6'); xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.argtypes=[ctypes.c_char_p]; x11.XOpenDisplay.restype=ctypes.c_void_p
x11.XMoveWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int]
x11.XMoveResizeWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_uint,ctypes.c_uint]
x11.XRaiseWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong]
x11.XSetInputFocus.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_ulong]
x11.XStringToKeysym.argtypes=[ctypes.c_char_p]; x11.XStringToKeysym.restype=ctypes.c_ulong
x11.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong]; x11.XKeysymToKeycode.restype=ctypes.c_ubyte
x11.XFlush.argtypes=[ctypes.c_void_p]; x11.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int]
x11.XInstallColormap.argtypes=[ctypes.c_void_p,ctypes.c_ulong]
x11.XWarpPointer.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_uint,ctypes.c_uint,ctypes.c_int,ctypes.c_int]
x11.XDefaultRootWindow.argtypes=[ctypes.c_void_p]; x11.XDefaultRootWindow.restype=ctypes.c_ulong
xtst.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
xtst.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
d=x11.XOpenDisplay(D)
if not d: sys.exit('sem display')
MODS={'ctrl':'Control_L','shift':'Shift_L','alt':'Alt_L'}
SPECIAL={'return':'Return','enter':'Return','tab':'Tab','escape':'Escape','space':'space','page_down':'Page_Down','page_up':'Page_Up'}
def code(name):
    sym=x11.XStringToKeysym(name.encode()); c=x11.XKeysymToKeycode(d,sym)
    if not c: sys.exit('keysym ausente: '+name)
    return c
def tap(name):
    c=code(name)
    xtst.XTestFakeKeyEvent(d,c,1,0); x11.XFlush(d); time.sleep(0.02)
    xtst.XTestFakeKeyEvent(d,c,0,0); x11.XFlush(d); time.sleep(0.02)
def chord(combo):
    parts=[p for p in combo.split('+') if p]
    mods=[MODS[p.lower()] for p in parts[:-1]]
    final=SPECIAL.get(parts[-1].lower(),parts[-1])
    codes=[code(m) for m in mods]
    for c in codes: xtst.XTestFakeKeyEvent(d,c,1,0); x11.XFlush(d); time.sleep(0.02)
    tap(final)
    for c in reversed(codes): xtst.XTestFakeKeyEvent(d,c,0,0); x11.XFlush(d); time.sleep(0.02)
    x11.XSync(d,0)
a=sys.argv[1]
if a=='move':
    x11.XMoveResizeWindow(d,int(sys.argv[2],0),*[int(v,0) for v in sys.argv[3:7]]); x11.XSync(d,0)
elif a=='raise':
    x11.XRaiseWindow(d,int(sys.argv[2],0)); x11.XSync(d,0)
elif a=='focus':
    x11.XSetInputFocus(d,int(sys.argv[2],0),2,0); x11.XFlush(d); x11.XSync(d,0)
elif a=='key': chord(sys.argv[2])
elif a=='tap': tap(sys.argv[2])
elif a=='cmap':
    x11.XInstallColormap(d,int(sys.argv[2],0)); x11.XSync(d,0)
elif a=='click':
    x,y=int(sys.argv[2]),int(sys.argv[3])
    x11.XWarpPointer(d,0,x11.XDefaultRootWindow(d),0,0,0,0,x,y); x11.XSync(d,0); time.sleep(0.05)
    xtst.XTestFakeButtonEvent(d,1,1,0); x11.XFlush(d); time.sleep(0.05)
    xtst.XTestFakeButtonEvent(d,1,0,0); x11.XSync(d,0); time.sleep(0.1)
else: sys.exit('acao desconhecida')
`;

let x11ctlPath = '';

export function installX11Helper(base) {
  const file = path.join(base, 'x11ctl.py');
  fs.writeFileSync(file, X11CTL, {mode: 0o755});
  x11ctlPath = file;
  return file;
}

export function makeX11(helper) {
  const call = (args) => spawnSync('python3', [helper, ...args], {env: {...process.env, DISPLAY}, encoding: 'utf8'});
  const must = (args) => {
    const result = call(args);
    if (result.status !== 0) throw Error(`x11ctl ${args[0]} falhou: ${(result.stderr || result.stdout || '').trim()}`);
  };
  return {
    move: (id, x, y, w, h) => must(['move', id, String(x), String(y), String(w), String(h)]),
    raise: (id) => must(['raise', id]),
    focus: (id) => must(['focus', id]),
    key: (combo) => must(['key', combo]),
    tap: (key) => must(['tap', key]),
    click: (x, y) => must(['click', String(x), String(y)]),
  };
}

/**
 * Primeiro boot do Xournal++ num config temporário: ele regrava o
 * `settings.xml` completo (o mínimo deixa o layout em 800 e o resto da janela
 * preto). Depois o tamanho da janela é fixado no arquivo completo.
 */
export async function primeXournalSettings({base, config, home, xopp, binary, env, waitFor}) {
  const log = fs.openSync(path.join(base, 'prime.log'), 'w');
  const child = spawn(binary, ['--disable-audio', xopp], {
    stdio: ['ignore', log, log],
    env: {...env, HOME: home, XDG_CONFIG_HOME: path.dirname(config), XDG_CACHE_HOME: path.join(base, 'cache'), XDG_DATA_HOME: path.join(base, 'data')},
  });
  fs.closeSync(log);
  try {
    await waitFor(() => { try { return windowsOfPid(child.pid).length > 0; } catch { return false; } }, {timeout: 20000, what: 'primeiro boot do Xournal++'});
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } finally {
    try { process.kill(child.pid, 'SIGTERM'); } catch { /* já saiu */ }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try { process.kill(child.pid, 'SIGKILL'); } catch { /* já saiu */ }
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  fs.rmSync(path.join(config, 'emergencysave.xopp'), {force: true});
  const file = path.join(config, 'settings.xml');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
    .replace(/name="mainWndWidth" value="\d+"/, 'name="mainWndWidth" value="800"')
    .replace(/name="mainWndHeight" value="\d+"/, 'name="mainWndHeight" value="650"')
    .replace(/name="maximized" value="[^"]*"/, 'name="maximized" value="false"')
    .replace(/name="sidebarWidth" value="\d+"/, 'name="sidebarWidth" value="120"'));
}

/* ------------------------------------------------------------------ */
/* Captura XWD → RGB → PNG                                             */
/* ------------------------------------------------------------------ */

/** Decodifica um `xwd -id` (TrueColor 24/32 bits, ZPixmap) em RGB. */
export function decodeXwd(buffer) {
  if (buffer.length < 100) throw Error('xwd curto demais');
  const field = (i) => buffer.readUInt32BE(i * 4);
  const headerSize = field(0);
  const format = field(2);
  const width = field(4);
  const height = field(5);
  const bpp = field(11);
  const bytesPerLine = field(12);
  const ncolors = field(19);
  if (format !== 2) throw Error(`xwd com formato ${format} (esperado ZPixmap)`);
  if (bpp !== 24 && bpp !== 32) throw Error(`xwd com ${bpp} bits por pixel (esperado 24 ou 32)`);
  const offset = headerSize + ncolors * 12;
  const pixels = Buffer.alloc(width * height * 3);
  /* O Xorg desta tela guarda 24 bits em unidades de 32 (bytesPerLine = 4×largura). */
  const px = bytesPerLine >= width * 4 ? 4 : Math.max(3, Math.ceil(bpp / 8));
  for (let y = 0; y < height; y++) {
    const row = offset + y * bytesPerLine;
    if (row + width * px > buffer.length) throw Error('xwd truncado');
    for (let x = 0; x < width; x++) {
      const i = row + x * px;
      const o = (y * width + x) * 3;
      pixels[o] = buffer[i + 2];
      pixels[o + 1] = buffer[i + 1];
      pixels[o + 2] = buffer[i];
    }
  }
  return {w: width, h: height, pixels};
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Codifica RGB em PNG (sem dependência). */
export function encodePng(width, height, rgb) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    rgb.copy(raw, y * stride + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, {level: 9})),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function captureWindow(id) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'ciclo2-xwd-'));
  const file = path.join(dir, `${id}.xwd`);
  try {
    /* A janela do Electron instala um colormap de 32 bits e desinstala o do
       Xournal++: sem reinstalar o colormap da janela-alvo, o xwd morre com
       BadColor (visto na montagem). */
    try {
      const info = run('xwininfo', ['-id', id]);
      const cmap = /Colormap: (0x[0-9a-f]+)/i.exec(info);
      const installed = /\(installed\)/i.test(info);
      if (cmap && !installed && x11ctlPath) spawnSync('python3', [x11ctlPath, 'cmap', cmap[1]], {env: {...process.env, DISPLAY}, encoding: 'utf8'});
    } catch { /* sem colormap legível: tenta o xwd */ }
    /* `BadWindow`/`BadDrawable` transitório acontece quando a janela do
       Electron é reparentada ou redesenhada no instante do xwd (visto na
       montagem 17/18 com outro Electron na máquina): repete antes de falhar. */
    let lastError = '';
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = spawnSync('xwd', ['-id', id, '-out', file], {env: {...process.env, DISPLAY}, encoding: 'utf8'});
      if (result.status === 0) return decodeXwd(fs.readFileSync(file));
      lastError = (result.stderr || '').trim();
      if (!/BadWindow|BadDrawable|BadMatch/i.test(lastError) || attempt === 4) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
    throw Error(`xwd não capturou ${id}: ${lastError}`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}


/** Captura o cliente de uma janela de teste para usar como fundo de um estado
 * com diálogo (o cliente com diálogo aberto sai recortado à direita). */
export function snapshot(win) {
  return new Map([[win.id, {x: win.x, y: win.y, image: captureWindow(win.id)}]]);
}


/** Janelas de menu/popup do Xournal++ que não estão na lista de clientes. */
export function xournalPopups() {
  const text = run('xwininfo', ['-root', '-tree']);
  const clientIds = new Set(clients());
  const out = [];
  for (const line of text.split('\n')) {
    if (!/xournalpp/i.test(line)) continue;
    const id = /^\s*(0x[0-9a-f]+)/i.exec(line)?.[1];
    if (!id || clientIds.has(id)) continue;
    try {
      const geo = geometry(id);
      if (geo.mapeada && geo.w > 50 && geo.h > 30) out.push({id, ...geo});
    } catch { /* sumiu */ }
  }
  return out;
}

/**
 * Compõe as capturas das janelas de teste num retângulo único e grava o PNG.
 * `layers` vem na ordem de empilhamento (baixo → cima); o fundo que sobrar
 * (nunca de outra janela) fica no cinza neutro.
 */
export function composePng(rect, layers, outFile) {
  const rgb = Buffer.alloc(rect.w * rect.h * 3, 0xd9);
  for (const layer of layers) {
    const dx = layer.x - rect.x;
    const dy = layer.y - rect.y;
    for (let y = 0; y < layer.image.h; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= rect.h) continue;
      for (let x = 0; x < layer.image.w; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= rect.w) continue;
        const from = (y * layer.image.w + x) * 3;
        const to = (ty * rect.w + tx) * 3;
        layer.image.pixels.copy(rgb, to, from, from + 3);
      }
    }
  }
  fs.writeFileSync(outFile, encodePng(rect.w, rect.h, rgb));
}

/** Retângulo que une as janelas de teste (coordenadas da raiz). */
export function unionRect(windows) {
  const x0 = Math.min(...windows.map((w) => w.x));
  const y0 = Math.min(...windows.map((w) => w.y));
  const x1 = Math.max(...windows.map((w) => w.x + w.w));
  const y1 = Math.max(...windows.map((w) => w.y + w.h));
  return {x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(1366, x1) - Math.max(0, x0), h: Math.min(768, y1) - Math.max(0, y0)};
}

/**
 * Captura um estado com segurança: sobe só as janelas `ours`, confere que
 * nenhuma janela alheia está por cima do retângulo e grava PNG + JSON. Se
 * houver intrusa, não grava a imagem e diz o motivo no JSON.
 */
export function captureState({name, outDir, ours, x11, extra = {}, images = new Map(), raise = true}) {
  /* Captura o cliente, não a moldura do WM: com diálogo aberto a moldura
     devolve preto à direita (visto no teste), e o cliente já traz o diálogo. */
  const frames = ours.map((win) => ({win, frame: {x: win.x, y: win.y, w: win.w, h: win.h, moldura: win.id}}));
  const rect = unionRect(frames.map((item) => item.frame));
  if (raise) for (const item of frames) x11.raise(item.frame.moldura);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  const order = stacking();
  const oursIds = new Set(frames.map((item) => item.win.id));
  const lastIndex = Math.max(...frames.map((item) => order.indexOf(item.win.id)));
  const intrusas = [];
  for (let i = lastIndex + 1; i < order.length; i++) {
    const id = order[i];
    if (oursIds.has(id)) continue;
    let geo;
    try { geo = geometry(id); } catch { continue; }
    if (!geo.mapeada) continue;
    const intersects = geo.x < rect.x + rect.w && geo.x + geo.w > rect.x && geo.y < rect.y + rect.h && geo.y + geo.h > rect.y;
    if (!intersects) continue;
    try { intrusas.push({id, ...props(id), ...geo}); } catch { intrusas.push({id, ...geo}); }
  }
  const image = path.join(outDir, `${name}.png`);
  const meta = {
    arquivo: path.basename(image),
    recorte: rect,
    janelas: frames.map(({win, frame}) => ({
      id: frame.moldura, cliente: win.id, papel: win.papel || 'teste',
      classe: win.classe, titulo: win.titulo, pid: win.pid,
      geometria: {x: frame.x, y: frame.y, w: frame.w, h: frame.h},
    })),
    seguro: intrusas.length === 0,
    intrusas,
    ...extra,
  };
  if (intrusas.length === 0) {
    const rank = (id) => { const i = order.indexOf(id); return i === -1 ? order.length + 1 : i; };
    const layers = frames
      .sort((a, b) => rank(a.win.id) - rank(b.win.id))
      .map(({win, frame}) => {
        if (images.has(win.id)) return images.get(win.id);
        try { return {x: frame.x, y: frame.y, image: captureWindow(frame.moldura)}; } catch (frameError) {
          if (frame.moldura === win.id) throw frameError;
          try { return {x: win.x, y: win.y, image: captureWindow(win.id)}; } catch (clientError) {
            throw Error(`moldura ${frame.moldura}: ${frameError.message}; cliente ${win.id}: ${clientError.message}`);
          }
        }
      });
    composePng(rect, layers, image);
  } else {
    meta.imagem = null;
    meta.motivo = 'janela alheia por cima do recorte; imagem não gravada';
  }
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}
