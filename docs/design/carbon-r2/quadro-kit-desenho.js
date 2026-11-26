/* Kit do desenho narrado: a parte que fica pronta no app, igual para qualquer
   modelo. O roteiro (ex.: pitagoras.desenho.js) só diz o que desenhar e em que
   ordem; o kit dá o tempo de cada traço pelo tamanho dele, as cores pelos
   tokens e o tamanho das letras por nome. Mudar o ritmo de todos os desenhos é
   mudar RITMO, não reescrever roteiros.
   O desenho é função pura de t: cada evento tem um intervalo [a, b], e o quadro
   em t é só "quanto de cada um já saiu". Pausar, voltar e mandar ao tutor
   "3 dos 4 triângulos a 54% do caminho" vêm daí. */
const RITMO = {caneta:440, letra:14, deslize:160, fade:.3, entre:.05, respiro:.35, palavra:.065, traco:[.2, .85], letraMin:.28};
const TAMANHO = {pequeno:24, normal:28, grande:32, titulo:40};
const COR_AREA = {1:'fill sq-a', 2:'fill sq-b', 3:'fill sq-c', neutro:'tri-fill'};
const SVG_NS = 'http://www.w3.org/2000/svg';
const dsvg = $('#dsvg');
const pit = {t:0, playing:false, speed:1, ev:[], steps:[], marks:{}, T:1, frame:0, pen:null};

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  (parent || dsvg).appendChild(e);
  return e;
}
const add2 = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
const ease = (p) => p * p * (3 - 2 * p);
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const ptsAttr = (pts) => pts.map((p) => p.join(',')).join(' ');
function polyLen(pts, closed) {
  const list = closed ? [...pts, pts[0]] : pts;
  let len = 0;
  for (let i = 1; i < list.length; i++) len += Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]);
  return len;
}
/* Traço de mão: cada segmento ganha uma curva leve, de uma conta fixa, para o
   desenho ser o mesmo em todo t e em toda captura. */
function handPath(pts, closed) {
  const list = closed ? [...pts, pts[0]] : pts;
  let d = `M${list[0][0]} ${list[0][1]}`;
  for (let i = 1; i < list.length; i++) {
    const [x1, y1] = list[i - 1], [x2, y2] = list[i];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const k = Math.sin(x1 * 0.37 + y2 * 0.21 + i) * Math.min(2.2, len * 0.02);
    const mx = (x1 + x2) / 2 - (y2 - y1) / len * k, my = (y1 + y2) / 2 + (x2 - x1) / len * k;
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}
function gridPath(o, u, v, n, parent) {
  let d = '';
  for (let k = 1; k < n; k++) {
    const p = add2(o, u, k / n), q = add2(p, v), r = add2(o, v, k / n), s = add2(r, u);
    d += `M${p[0]} ${p[1]}L${q[0]} ${q[1]}M${r[0]} ${r[1]}L${s[0]} ${s[1]}`;
  }
  return svgEl('path', {d, class:'grid'}, parent);
}

/* ---------- a API que o roteiro recebe ---------- */
function criarKit() {
  let cur = 0, par = null;                 // par: dentro de junto(), tudo começa no mesmo instante
  const front = [], fundo = svgEl('g', {});
  const slot = (dur, gap = RITMO.entre) => {
    const a = par ? par.start : cur, b = a + dur;
    if (par) par.end = Math.max(par.end, b); else cur = b + gap;
    return [a, b];
  };
  const push = (ev, o) => { pit.ev.push(ev); if (o.marca) pit.marks[o.marca] = {a:ev.a, b:ev.b}; };
  /* um passo dura pelo menos o tempo de ler a narração dele */
  const fecharPasso = () => {
    const last = pit.steps[pit.steps.length - 1];
    if (last) cur = Math.max(cur, last.t + last.text.split(' ').length * RITMO.palavra);
  };
  return {
    passo(label, text) { fecharPasso(); if (pit.steps.length) cur += RITMO.respiro; pit.steps.push({t:cur, label, text}); },
    traco(pts, o = {}) {
      const [lo, hi] = RITMO.traco;
      const [a, b] = slot(Math.min(hi, Math.max(lo, polyLen(pts, o.fechado) / RITMO.caneta)));
      const cls = `ink${o.fino ? ' thin' : ''}${o.cor === 'destaque' ? ' acc-ink' : ''}`;
      const el = svgEl('path', {d:handPath(pts, o.fechado), class:cls, pathLength:1, 'stroke-dasharray':1}, o.em);
      push({kind:'stroke', el, a, b, name:o.nome}, o);
      return el;
    },
    escrever([x, y], txt, o = {}) {
      const size = TAMANHO[o.tam || 'normal'];
      const [a, b] = slot(Math.max(RITMO.letraMin, txt.length / RITMO.letra));
      const id = `pit-clip-${pit.ev.length}`;
      const rect = svgEl('rect', {x:0, y:0, width:0, height:0}, svgEl('clipPath', {id}, pit.defs));
      const el = svgEl('text', {x, y:y + size * .32, class:`hand${o.cor === 'destaque' ? ' acc' : ''}`, 'font-size':size, 'text-anchor':o.ancora === 'inicio' ? 'start' : 'middle', 'clip-path':`url(#${id})`}, o.em);
      el.textContent = txt;
      push({kind:'write', el, rect, a, b, name:`“${txt}”`}, o);
      return el;
    },
    /* preenchimento fica sempre por baixo dos traços: no fundo, ou no começo do grupo */
    preencher(q, o = {}) {
      const g = document.createElementNS(SVG_NS, 'g'), parent = o.em || fundo;
      parent.insertBefore(g, parent.firstChild);
      svgEl('polygon', {points:ptsAttr(q.pts), class:COR_AREA[o.cor] || COR_AREA.neutro}, g);
      if (o.malha && q.u) gridPath(q.pts[0], q.u, q.v, o.malha, g);
      const [a, b] = slot(RITMO.fade, .12 - RITMO.fade);
      push({kind:'in', el:g, a, b}, o);
      return g;
    },
    sumir(el, o = {}) { const [a, b] = slot(RITMO.fade); push({kind:'out', el, a, b}, o); },
    mover(list, o = {}) {
      const dist = Math.max(...list.map(([, m]) => Math.hypot(m[0], m[1])));
      const [a, b] = slot(Math.min(2, Math.max(.7, dist / RITMO.deslize)));
      push({kind:'move', list, a, b, name:o.nome}, o);
    },
    junto(fn) { par = {start:cur, end:cur}; fn(); cur = par.end + RITMO.entre; par = null; },
    grupo(o = {}) { const g = svgEl('g', {}); if (o.frente) front.push(g); return g; },
    pausa(tipo = 'curta') { cur += tipo === 'longa' ? .8 : .3; },
    quadrado(o, u, v) { return {pts:[o, add2(o, u), add2(add2(o, u), v), add2(o, v)], u, v, centro:add2(o, add2(u, v), .5)}; },
    soma: add2,
    dir: (graus) => [Math.round(Math.cos(graus * Math.PI / 180)), Math.round(Math.sin(graus * Math.PI / 180))],
    fim() { fecharPasso(); front.forEach((g) => dsvg.appendChild(g)); return cur + .3; },
  };
}
function montarDesenho(desenho) {
  dsvg.innerHTML = ''; pit.ev = []; pit.steps = []; pit.marks = {};
  pit.defs = svgEl('defs', {});
  const k = criarKit();
  desenho.roteiro(k);
  pit.T = k.fim();
  pit.pen = svgEl('circle', {r:4.5, class:'pen'});
}

/* ---------- pintar o quadro em t ---------- */
function paintWrite(e, p) {
  if (p <= 0 || p >= 1) {
    const side = p >= 1 ? 20000 : 0;
    e.rect.setAttribute('x', -10000); e.rect.setAttribute('y', -10000);
    e.rect.setAttribute('width', side); e.rect.setAttribute('height', side);
    return null;
  }
  if (!e.bb) { const b = e.el.getBBox(); if (b.width) e.bb = b; }
  if (!e.bb) return null;
  const bb = e.bb;
  e.rect.setAttribute('x', bb.x - 4); e.rect.setAttribute('y', bb.y - 6);
  e.rect.setAttribute('width', (bb.width + 8) * p); e.rect.setAttribute('height', bb.height + 12);
  return [bb.x + bb.width * p, bb.y + bb.height * .68];
}
function paintPitStage() {
  const op = new Map();
  let pen = null;
  for (const e of pit.ev) {
    const p = clamp01((pit.t - e.a) / (e.b - e.a));
    if (e.kind === 'in' || e.kind === 'out') { op.set(e.el, (op.get(e.el) ?? 1) * (e.kind === 'in' ? p : 1 - p)); continue; }
    if (e.kind === 'write') { pen = paintWrite(e, p) || pen; continue; }
    if (e.kind === 'move') { e.list.forEach(([g, m]) => g.setAttribute('transform', `translate(${m[0] * ease(p)} ${m[1] * ease(p)})`)); continue; }
    e.el.style.strokeDashoffset = 1 - p;
    e.el.style.visibility = p > 0 ? 'visible' : 'hidden';
    if (p > 0 && p < 1) { const q = e.el.getPointAtLength(e.el.getTotalLength() * p); pen = [q.x, q.y]; }
  }
  op.forEach((v, el) => { el.style.opacity = v; });
  pit.pen.style.visibility = pen ? 'visible' : 'hidden';
  if (pen) { pit.pen.setAttribute('cx', pen[0]); pit.pen.setAttribute('cy', pen[1]); }
}
function pitStepIndex(t) {
  let i = 0;
  pit.steps.forEach((p, k) => { if (t >= p.t - 1e-6) i = k; });
  return i;
}
const dscrub = $('#d-scrub');
function paintPit() {
  paintPitStage();
  const i = pitStepIndex(pit.t), p = pit.steps[i], end = (pit.steps[i + 1] || {t:pit.T}).t;
  paintWords($('#dn-text'), p.text, (pit.t - p.t) / (end - p.t) * 1.25, String(i));
  $('#dn-step').textContent = `${i + 1} / ${pit.steps.length}`;
  $('#dn-label').textContent = p.label;
  paintScrubAt(dscrub, pit.t, pit.T, clock(pit.t));
  $('#d-read').textContent = `${clock(pit.t)} / ${clock(pit.T)}`;
  setPlay($('#d-play'), pit.playing, pit.playing ? 'Pausar' : (pit.t >= pit.T - 1e-6 ? 'De novo' : 'Tocar'));
  $('#d-ask').hidden = pit.playing;
}

/* ---------- transporte ---------- */
function seekPit(t) { pit.t = Math.min(pit.T, Math.max(0, t)); paintPit(); }
function pausePit() { pit.playing = false; paintPit(); }
function tickPit(now) {
  if (!pit.playing) return;
  const dt = Math.min(.05, (now - pit.frame) / 1000); pit.frame = now;
  pit.t = Math.min(pit.T, pit.t + dt * pit.speed);
  if (pit.t >= pit.T) pit.playing = false;
  paintPit();
  if (pit.playing) requestAnimationFrame(tickPit);
}
function playPit() {
  if (pit.t >= pit.T - 1e-6) pit.t = 0;
  pit.playing = true; pit.frame = performance.now(); paintPit(); requestAnimationFrame(tickPit);
}
bindScrub(dscrub, {total: () => pit.T, seek: seekPit, pause: pausePit});
$('#d-play').addEventListener('click', () => pit.playing ? pausePit() : playPit());
$('#d-restart').addEventListener('click', () => { pausePit(); seekPit(0); });
$('#d-all').addEventListener('click', () => { pausePit(); seekPit(pit.T); });
$('#d-prev').addEventListener('click', () => {
  pausePit();
  const i = pitStepIndex(pit.t - .001);
  seekPit(pit.steps[Math.max(0, pit.t > pit.steps[i].t + .05 ? i : i - 1)].t);
});
$('#d-next').addEventListener('click', () => { pausePit(); seekPit(pit.steps[Math.min(pit.steps.length - 1, pitStepIndex(pit.t) + 1)].t); });
$('#d-speed').addEventListener('click', () => { pit.speed = pit.speed === 1 ? 1.5 : pit.speed === 1.5 ? .75 : 1; $('#d-speed').textContent = `${String(pit.speed).replace('.', ',')}×`; });

/* ---------- o que vai ao tutor ---------- */
function pitOnScreen(t) {
  const now = pit.ev.find((e) => e.name && t > e.a && t < e.b);
  const pct = now && Math.round((t - now.a) / (now.b - now.a) * 100);
  if (now && now.kind === 'move') return `${now.name} a ${pct}% do caminho`;
  if (now) return `desenhando ${now.name} (${pct}%)`;
  const done = pit.ev.filter((e) => e.name && t >= e.b).sort((x, y) => x.b - y.b).pop();
  return done ? `pronto até ${done.name}` : 'quadro em branco';
}
/* Imagem do quadro: o SVG com os estilos calculados, porque fora da página as
   variáveis de cor não existem. */
function pitThumb() {
  const clone = dsvg.cloneNode(true), src = dsvg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
  const keys = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'visibility', 'font-family', 'font-size', 'font-weight'];
  src.forEach((el, i) => { const cs = getComputedStyle(el); dst[i].setAttribute('style', keys.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';')); });
  clone.setAttribute('xmlns', SVG_NS); clone.setAttribute('width', 720); clone.setAttribute('height', 370);
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', 720); bg.setAttribute('height', 370); bg.setAttribute('fill', css('--bg'));
  clone.insertBefore(bg, clone.firstChild);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
}
function pitChip() {
  const t = pit.t, i = pitStepIndex(t), p = pit.steps[i], img = pitThumb();
  return {
    kind:'desenho', icon:'pen', label:`Desenho · passo ${i + 1} de ${pit.steps.length} · ${clock(t)}`, img, at:t, step:i,
    rows:[
      ['Imagem', `<img alt="" src="${img}">`],
      ['Passo', `${i + 1} de ${pit.steps.length}: ${p.label}`],
      ['Instante', `<span class="mono">${fmt(t, 1)} s de ${fmt(pit.T, 1)} s</span>`],
      ['Na tela', pitOnScreen(t)],
      ['Narração', `“${p.text}”`],
      ['Roteiro', '<span class="mono">pitagoras.desenho.js</span> · traços e passos'],
    ],
  };
}
const pitMarca = (nome, frac = 1) => { const m = pit.marks[nome]; return m.a + (m.b - m.a) * frac; };
/* Resposta simulada do tutor (só no protótipo). */
function pitReply(c) {
  const at = (s) => tlink('desenho', s.toFixed(2), clock(s));
  if (c.step === 4 || c.step === 5) return `<p>Em ${at(c.at)} as peças estão no meio do caminho, mas repare no que não muda: o quadrado grande continua com lado a + b, e cada triângulo só desliza, sem girar nem esticar. A área total é a mesma e a dos quatro triângulos também, então a sobra também tem a mesma área.</p><p>Em ${at(pitMarca('sobra-c'))} a sobra é um quadrado só, c². Em ${at(pitMarca('sobra-ab'))} a mesma sobra virou dois: a² e b². É isso que a conta de ${at(pitMarca('conclusao'))} diz.</p><p>No seu caso, <i class="v">vx</i> e <i class="v">vy</i> são os catetos e |<i class="v">v</i>| é a hipotenusa: |<i class="v">v</i>|² = <i class="v">vx</i>² + <i class="v">vy</i>².</p>`;
  if (c.step === 3) return `<p>9 + 16 = 25 é só um caso, o do triângulo 3, 4, 5. Contar quadradinhos não prova nada para outros lados. A prova começa em ${at(pit.steps[4].t)} e não usa números, só áreas.</p>`;
  const p = pit.steps[c.step];
  return `<p>Em ${at(c.at)} estamos em “${p.label}”. ${p.text}</p>`;
}
$('#d-ask').addEventListener('click', () => { addChip(pitChip()); $('#msg').focus(); });

montarDesenho(PITAGORAS);
buildScrub(dscrub, pit.steps, pit.T);
/* A caixa das letras muda quando a Caveat carrega. */
document.fonts.ready.then(() => { pit.ev.forEach((e) => { e.bb = null; }); paintPit(); });

PIECES.desenho = {
  id:'p-draw', chip: pitChip, reply: pitReply, marca: pitMarca,
  goto: (t) => { pausePit(); seekPit(t); }, pause: pausePit, redraw: paintPit,
  reset() { pit.playing = false; pit.speed = 1; $('#d-speed').textContent = '1×'; seekPit(0); },
  play: playPit,
};
