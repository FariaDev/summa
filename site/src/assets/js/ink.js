// A folha do Xournal++ na demo: a escrita roteirizada (glifos em traço, desenhados
// com pathLength=1) e as ferramentas de verdade — caneta, borracha de traço,
// desfazer e três cores.
import {$, $$, svgNS, reduced} from './dom.js';

const GLYPHS = {
  '1': {w: 10, p: ['M3 18l5-4v17']},
  '2': {w: 13, p: ['M2 18c2-4 9-4 9 1 0 4-6 8-9 12h10']},
  '²': {w: 9, p: ['M1 7c2-3 7-2 6 2l-6 6h7'], up: true},
  '3': {w: 14, p: ['M2 17c3-4 10-3 9 2s-6 4-6 4c6-1 9 3 7 7s-9 4-11 1']},
  '5': {w: 13, p: ['M11 14H4l-1 8c4-3 9-1 8 4s-7 7-10 3']},
  '6': {w: 14, p: ['M11 15c-6 2-9 9-8 14s7 4 8 0-3-6-8-2']},
  '0': {w: 13, p: ['M7 14c-4 0-5 6-5 10s2 7 5 7 5-4 5-9-2-8-5-8z']},
  'f': {w: 13, p: ['M15 8c-2-4-7-4-9 1L1 37c-1 5-5 6-7 3', 'M-1 19h11']},
  "'": {w: 6, p: ['M5 9 2 15']},
  '(': {w: 8, p: ['M7 13c-6 6-6 17 0 23']},
  ')': {w: 9, p: ['M1 13c6 6 6 17 0 23']},
  'x': {w: 15, p: ['M1 19c4-1 6 2 7 7s3 7 6 5', 'M13 19c-4 2-7 6-11 12']},
  'v': {w: 13, p: ['M1 19l5 12 6-13']},
  'm': {w: 18, p: ['M1 31V20m0 3c1-3 6-4 6 0v8m0-8c1-3 6-4 6 0v8']},
  's': {w: 10, p: ['M9 20c-2-2-7-2-7 1s7 3 7 6-5 4-8 2']},
  '/': {w: 9, p: ['M8 13 1 35']},
  '·': {w: 8, p: ['M4 25.5l.6.6']},
  '=': {w: 18, p: ['M3 23h12', 'M3 29h12']},
  '-': {w: 16, p: ['M2 26h11']},
  ' ': {w: 5, p: []},
};

/**
 * Liga a folha `#ink` e a barra de ferramentas. Devolve a escrita roteirizada e o
 * desfazer, que a demo zera ao trocar de matéria.
 * @returns {{write: typeof write, stillInk: () => string, resetUndo: () => void}}
 * @example
 * const ink = createInk(); ink.write("f'(x)", 30, 40, {attempt: true});
 */
export function createInk() {
  const svg = $('#ink');
  const page = $('#xpp-page');
  let undoStack = [];
  let tool = 'pen', color = '#1f3a93', stroke = null, points = [], eraseFrom = null;

  // Escreve `text` traço por traço; devolve a duração total. A tentativa guarda
  // quantos traços tinha, para o Conferir notar se ela foi apagada.
  function write(text, x, y, {start = 0, scale = 1, attempt = false} = {}) {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
    let cx = 0, t = start;
    for (const ch of text) {
      const glyph = GLYPHS[ch];
      if (!glyph) continue;
      for (const d of glyph.p) {
        const len = glyph.up ? 120 : 200;
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('pathLength', '1');
        path.setAttribute('class', 'ink draw');
        path.style.setProperty('--at', (reduced ? 0 : t) + 'ms');
        path.style.setProperty('--d', (reduced ? 1 : len) + 'ms');
        path.setAttribute('transform', `translate(${glyph.up ? cx - 3 : cx} ${glyph.up ? 2 : 0})`);
        g.appendChild(path);
        t += len * .8;
      }
      cx += glyph.w;
    }
    if (attempt) g.dataset.n = String(g.childElementCount);
    svg.appendChild(g);
    return t - start;
  }

  const point = (e) => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // A borracha apaga o traço inteiro que tocar (o "apagar traço" do Xournal++). O
  // teste é geométrico — pontos do traço contra o segmento que a borracha andou
  // desde o último evento — para um gesto rápido não pular traço fino.
  const samples = new WeakMap();
  function samplesOf(el) {
    if (samples.has(el)) return samples.get(el);
    const m = el.getCTM(), len = el.getTotalLength(), n = Math.max(8, Math.min(60, Math.ceil(len / 3))), pts = [];
    for (let i = 0; i <= n; i++) {
      const p = el.getPointAtLength(len * i / n);
      pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]);
    }
    samples.set(el, pts);
    return pts;
  }
  function eraseAt(e) {
    const p = point(e), a = eraseFrom || p;
    eraseFrom = p;
    for (const el of [...svg.querySelectorAll('path')]) {
      if (!samplesOf(el).some((q) => segmentDistance(q, a, p) < 7)) continue;
      el.classList.remove('draw'); // o desfazer devolve o traço na hora, sem redesenhar
      undoStack.push({op: 'del', el, parent: el.parentNode, next: el.nextSibling});
      el.remove();
    }
  }
  function undo() {
    const step = undoStack.pop();
    if (!step) return;
    if (step.op === 'add') step.el.remove();
    else step.parent.insertBefore(step.el, step.next);
  }
  function setTool(next) {
    tool = next;
    page.dataset.tool = next;
    for (const b of $$('.xpp-tools [data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === next));
  }
  function setColor(next) {
    color = next;
    setTool('pen');
    for (const b of $$('.xpp-tools [data-ink]')) b.setAttribute('aria-pressed', String(b.dataset.ink === next));
  }

  page.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    page.setPointerCapture(e.pointerId);
    if (tool === 'eraser') { eraseFrom = null; eraseAt(e); return; }
    points = [point(e)];
    stroke = document.createElementNS(svgNS, 'path');
    stroke.setAttribute('class', 'ink user');
    stroke.style.stroke = color;
    stroke.setAttribute('d', smoothPath(points));
    svg.appendChild(stroke);
  });
  page.addEventListener('pointermove', (e) => {
    if (tool === 'eraser') { if (e.buttons & 1) eraseAt(e); return; }
    if (!stroke) return;
    const p = point(e), q = points[points.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5) return;
    points.push(p);
    stroke.setAttribute('d', smoothPath(points));
  });
  const end = () => { if (stroke) undoStack.push({op: 'add', el: stroke}); stroke = null; eraseFrom = null; };
  page.addEventListener('pointerup', end);
  page.addEventListener('pointercancel', end);
  $('.xpp-tools').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    if (b.dataset.ink) setColor(b.dataset.ink);
    if (b.id === 'undo-btn') undo();
  });
  // Ctrl/⌘+Z só desfaz a folha com a demo à vista; fora dela, o atalho é do navegador.
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest('input,textarea') || $('#stage').dataset.offscreen !== 'false') return;
    e.preventDefault();
    undo();
  });
  setTool('pen');

  return {write, stillInk: () => svg.innerHTML.replace(/ink draw/g, 'ink'), resetUndo: () => { undoStack = []; }};
}

/** Curva pelos pontos médios, como a caneta do Xournal++ alisa o traço. @param {number[][]} pts */
export function smoothPath(pts) {
  if (pts.length === 1) { const [x, y] = pts[0]; return `M${x} ${y}l.1 .1`; }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    d += `Q${x} ${y} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return d + `L${lx} ${ly}`;
}

/** Distância do ponto `p` ao segmento `a`–`b`. `segmentDistance([0, 1], [0, 0], [2, 0])` → `1` */
export function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
