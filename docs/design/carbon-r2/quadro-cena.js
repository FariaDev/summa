/* Cena: um quadro é função pura de t.
   A cena é `estado(t)` + `desenhar(ctx, estado)`; os passos são marcas no tempo.
   Por isso pausar, voltar e "ver t = 1,02 s" são a mesma coisa, e o que vai ao
   tutor é o estado no t exato. */
const G = 9.81;
const scene = {v0:20, th:30, t:0, playing:false, speed:1, gateDone:false, trials:[], trialIdx:0};
function cenaSim() {
  const r = scene.th * Math.PI / 180;
  const vx = scene.v0 * Math.cos(r), vy0 = scene.v0 * Math.sin(r);
  const tp = vy0 / G, T = 2 * tp;
  return {vx, vy0, tp, T, R: vx * T, H: vy0 * vy0 / (2 * G)};
}
function cenaState(t) {
  const s = cenaSim();
  return {t, x: s.vx * t, y: s.vy0 * t - G * t * t / 2, vx: s.vx, vy: s.vy0 - G * t};
}
function cenaSteps() {
  const s = cenaSim();
  return [
    {t:0, label:'Lançamento', text:`A velocidade inicial se divide em duas: vx = v₀ cos θ = ${fmt(s.vx,1)} m/s na horizontal e vy = v₀ sen θ = ${fmt(s.vy0,1)} m/s na vertical.`},
    {t:s.tp*.4, label:'Subida', text:'Na horizontal nada freia, então vx não muda. Na vertical a gravidade tira 9,81 m/s de vy a cada segundo.'},
    {t:s.tp, label:'Topo', text:`No topo vy = 0, mas a bola não para: vx = ${fmt(s.vx,1)} m/s continua. A altura máxima é ${fmt(s.H,1)} m.`},
    {t:s.tp*1.3, label:'Descida', gate:true, text:'A descida espelha a subida: vy cresce para baixo no mesmo ritmo em que diminuiu.'},
    {t:s.T, label:'Chegada', text:`Ela volta ao chão em ${fmt(s.T)} s. Alcance: R = v₀² sen 2θ / g = ${fmt(s.R)} m.`},
  ];
}
function cenaStepIndex(t) {
  let i = 0;
  cenaSteps().forEach((p, k) => { if (t >= p.t - 1e-6) i = k; });
  return i;
}

const cv = $('#cv');
function drawCena() {
  const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const s = cenaSim(), st = cenaState(scene.t);
  const xmax = Math.max(40, Math.ceil(s.R * 1.12 / 5) * 5), ymax = Math.max(15, Math.ceil(s.H * 1.5 / 5) * 5);
  const L = 36, B = 26, T = 10, Rm = 12;
  const X = (x) => L + x / xmax * (w - L - Rm), Y = (y) => h - B - y / ymax * (h - B - T);
  const mute = css('--text-3'), sub = css('--border-subtle'), strong = css('--border-strong');
  c.font = '11px "IBM Plex Mono", monospace';
  c.lineWidth = 1;
  for (let y = 0; y <= ymax; y += 5) {
    c.strokeStyle = y === 0 ? strong : sub; c.beginPath(); c.moveTo(L, Y(y)); c.lineTo(w - Rm, Y(y)); c.stroke();
    if (y) { c.fillStyle = mute; c.textAlign = 'right'; c.fillText(`${y} m`, L - 6, Y(y) + 4); }
  }
  c.textAlign = 'center';
  for (let x = 0; x <= xmax; x += 5) { c.fillStyle = mute; c.fillText(x === xmax ? `${x} m` : String(x), X(x), h - 8); }
  /* trajetória inteira, fraca */
  c.setLineDash([3, 4]); c.strokeStyle = strong; c.beginPath();
  for (let i = 0; i <= 80; i++) { const p = cenaState(s.T * i / 80); i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y)); }
  c.stroke(); c.setLineDash([]);
  /* caminho já percorrido */
  const traj = css('--plot-3');
  c.strokeStyle = traj; c.lineWidth = 2; c.beginPath();
  const n = Math.max(1, Math.round(80 * scene.t / s.T));
  for (let i = 0; i <= n; i++) { const p = cenaState(scene.t * i / n); i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y)); }
  c.stroke();
  /* canhão */
  const r = scene.th * Math.PI / 180;
  c.strokeStyle = css('--text-2'); c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(0) + 22 * Math.cos(r), Y(0) - 22 * Math.sin(r)); c.stroke();
  c.lineCap = 'butt'; c.lineWidth = 1;
  /* topo e chegada */
  if (scene.t >= s.tp - 1e-6) {
    c.setLineDash([2, 3]); c.strokeStyle = mute; c.beginPath(); c.moveTo(X(s.vx * s.tp), Y(s.H)); c.lineTo(X(s.vx * s.tp), Y(0)); c.stroke(); c.setLineDash([]);
    c.fillStyle = mute; c.textAlign = 'center'; c.fillText(`${fmt(s.H,1)} m`, X(s.vx * s.tp), Y(s.H) - 12);
  }
  if (scene.t >= s.T - 1e-6) { c.fillStyle = traj; c.textAlign = 'right'; c.fillText(`${fmt(s.R)} m`, X(s.R) - 4, Y(0) - 8); }
  /* vetores */
  const k = 3.2, bx = X(st.x), by = Y(Math.max(0, st.y));
  arrow(c, bx, by, bx + st.vx * k, by, css('--plot-1'));
  arrow(c, bx, by, bx, by - st.vy * k, css('--plot-2'));
  c.textAlign = 'left';
  c.fillStyle = css('--plot-1'); c.fillText(`vx ${fmt(st.vx,1)}`, bx + st.vx * k + 6, by + 4);
  c.fillStyle = css('--plot-2'); c.fillText(`vy ${fmt(st.vy,1)}`, bx + 6, Math.abs(st.vy) < 1.5 ? by + 18 : by - st.vy * k + (st.vy >= 0 ? -4 : 12));
  /* bola */
  c.fillStyle = css('--bg'); c.strokeStyle = traj; c.lineWidth = 2;
  c.beginPath(); c.arc(bx, by, 6, 0, Math.PI * 2); c.fill(); c.stroke();
}
function arrow(c, x1, y1, x2, y2, color) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 3) return;
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 7 * Math.cos(a - .45), y2 - 7 * Math.sin(a - .45)); c.lineTo(x2 - 7 * Math.cos(a + .45), y2 - 7 * Math.sin(a + .45)); c.fill();
}

const scrub = $('#scrub');
bindScrub(scrub, {total: () => cenaSim().T, seek: (t) => seekCena(t), pause: () => pauseCena()});

function paintCenaText() {
  const st = cenaSteps(), i = cenaStepIndex(scene.t), p = st[i], next = st[i + 1];
  const prog = next ? (scene.t - p.t) / (next.t - p.t) : 1;
  paintWords($('#n-text'), p.text, scene.playing ? prog * 1.6 : 1, `${i}:${scene.v0}:${scene.th}`);
  $('#n-step').textContent = `${i + 1} / ${st.length}`;
  $('#n-label').textContent = p.label;
  const s = cenaSim(), x = cenaState(scene.t);
  $('#conta').innerHTML =
    `<i>vx</i> = ${scene.v0} cos ${scene.th}° = ${fmt(s.vx,1)} m/s<br>` +
    `<i>vy</i>(${fmt(scene.t)}) = ${fmt(s.vy0,1)} − 9,81 · ${fmt(scene.t)} = ${fmt(x.vy,1)} m/s<br>` +
    `<i>y</i>(${fmt(scene.t)}) = ${fmt(Math.max(0, x.y),2)} m`;
  $('#s-r').textContent = scene.t >= s.T - 1e-6 ? `${fmt(s.R)} m` : '—';
  $('#s-h').textContent = scene.t >= s.tp - 1e-6 ? `${fmt(s.H,1)} m` : '—';
  $('#s-t').textContent = scene.t >= s.T - 1e-6 || scene.gateDone ? `${fmt(s.T)} s` : '—';
  $('#trials').innerHTML = scene.trials.map((t, k) =>
    `<button type="button" class="trial-row" data-i="${k}" aria-current="${k === scene.trialIdx}"><span>${k + 1}</span><span>${t.v0}</span><span>${t.th}°</span><span>${fmt(t.R)}</span><span>${fmt(t.H,1)}</span></button>`).join('');
}
$('#trials').addEventListener('click', (e) => {
  const b = e.target.closest('.trial-row'); if (!b) return;
  const t = scene.trials[+b.dataset.i];
  scene.trialIdx = +b.dataset.i; setParams(t.v0, t.th);
});
function recordTrial() {
  const s = cenaSim(), last = scene.trials[scene.trials.length - 1];
  if (last && last.v0 === scene.v0 && last.th === scene.th) return;
  scene.trials.push({v0:scene.v0, th:scene.th, R:s.R, H:s.H});
  scene.trialIdx = scene.trials.length - 1;
}

function paintCena() {
  const T = cenaSim().T;
  drawCena(); paintCenaText();
  paintScrubAt(scrub, scene.t, T, `t = ${fmt(scene.t)} s`);
  $('#t-read').textContent = `t = ${fmt(scene.t)} s`;
  setPlay($('#c-play'), scene.playing, scene.playing ? 'Pausar' : (scene.t >= T - 1e-6 ? 'De novo' : 'Tocar'));
  $('#c-ask').hidden = scene.playing;
}
function seekCena(t) { scene.t = Math.min(cenaSim().T, Math.max(0, t)); paintCena(); }
function pauseCena() { scene.playing = false; paintCena(); }

/* Previsão: a cena para sozinha antes da descida e só segue depois de uma
   resposta. Regra com custo ao aluno ("a resposta não aparece antes da
   tentativa"): no app ela mora no núcleo Bend, como a do quiz. */
function openGate() {
  scene.playing = false;
  $('#g-tp').textContent = `${fmt(cenaSim().tp)} s`;
  $('#gate').hidden = false; $('#g-fb').hidden = true; $('#g-in').value = '';
  paintCena();
}
function closeGate(answer) {
  const tp = cenaSim().tp, fb = $('#g-fb');
  if (answer === null) fb.textContent = `A descida também leva ${fmt(tp)} s: o voo inteiro é ${fmt(2 * tp)} s.`;
  else if (Math.abs(answer - tp) < 0.08) fb.textContent = `Isso. A descida leva os mesmos ${fmt(tp)} s; o voo inteiro é ${fmt(2 * tp)} s.`;
  else fb.textContent = `Ainda não: a descida leva ${fmt(tp)} s, o mesmo que a subida. Repare em vy na cena.`;
  fb.hidden = false; scene.gateDone = true;
  setTimeout(() => { $('#gate').hidden = true; playCena(); }, PROTO.embed ? 0 : 1800);
}
$('#g-check').addEventListener('click', () => {
  const v = parseFloat($('#g-in').value.replace(',', '.'));
  if (!Number.isFinite(v)) { $('#g-in').focus(); return; }
  closeGate(v);
});
$('#g-skip').addEventListener('click', () => closeGate(null));

let cenaFrame = 0;
function tickCena(now) {
  if (!scene.playing) return;
  const dt = Math.min(.05, (now - cenaFrame) / 1000); cenaFrame = now;
  const before = scene.t, s = cenaSim();
  scene.t = Math.min(s.T, scene.t + dt * .65 * scene.speed);
  const gate = cenaSteps().find((p) => p.gate);
  if (!scene.gateDone && before < gate.t && scene.t >= gate.t) { scene.t = gate.t; openGate(); return; }
  if (scene.t >= s.T) { scene.playing = false; recordTrial(); }
  paintCena();
  if (scene.playing) requestAnimationFrame(tickCena);
}
function playCena() {
  if (scene.t >= cenaSim().T - 1e-6) scene.t = 0;
  $('#gate').hidden = true;
  scene.playing = true; cenaFrame = performance.now(); paintCena(); requestAnimationFrame(tickCena);
}
$('#c-play').addEventListener('click', () => scene.playing ? pauseCena() : playCena());
$('#c-restart').addEventListener('click', () => { scene.gateDone = false; pauseCena(); seekCena(0); });
$('#c-prev').addEventListener('click', () => {
  pauseCena();
  const st = cenaSteps(), i = cenaStepIndex(scene.t - .001);
  seekCena(st[Math.max(0, scene.t > st[i].t + .01 ? i : i - 1)].t);
});
$('#c-next').addEventListener('click', () => { pauseCena(); const st = cenaSteps(); seekCena(st[Math.min(st.length - 1, cenaStepIndex(scene.t) + 1)].t); });
$('#speed').addEventListener('click', () => { scene.speed = scene.speed === 1 ? 2 : scene.speed === 2 ? .5 : 1; $('#speed').textContent = `${String(scene.speed).replace('.', ',')}×`; });
function setParams(v0, th) {
  scene.v0 = v0; scene.th = th; scene.gateDone = false;
  $('#v0').value = v0; $('#th').value = th;
  $('#v0-o').textContent = `${v0} m/s`; $('#th-o').textContent = `${th}°`;
  buildScrub(scrub, cenaSteps(), cenaSim().T); pauseCena(); seekCena(0);
}
$('#v0').addEventListener('input', (e) => setParams(+e.target.value, scene.th));
$('#th').addEventListener('input', (e) => setParams(scene.v0, +e.target.value));

function cenaThumb() {
  const t = document.createElement('canvas'); t.width = 640; t.height = 320;
  t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height); return t.toDataURL();
}
function cenaChip() {
  const st = cenaSteps(), i = cenaStepIndex(scene.t), x = cenaState(scene.t), img = cenaThumb();
  return {
    kind:'cena', icon:'scene', label:`Cena · passo ${i + 1} de ${st.length} · t = ${fmt(scene.t)} s`, img, at: scene.t, step:i,
    rows:[
      ['Imagem', `<img alt="" src="${img}">`],
      ['Passo', `${i + 1} de ${st.length}: ${st[i].label}`],
      ['Instante', `<span class="mono">t = ${fmt(scene.t)} s</span>`],
      ['Estado', `<span class="mono">x = ${fmt(x.x,1)} m · y = ${fmt(Math.max(0, x.y),1)} m<br>vx = ${fmt(x.vx,1)} m/s · vy = ${fmt(x.vy,1)} m/s</span>`],
      ['Ajustes', `<span class="mono">v₀ = ${scene.v0} m/s · θ = ${scene.th}°</span>`],
      ['Tentativas', `${Math.max(1, scene.trials.length)}: a atual e as anteriores`],
      ['Roteiro', '<span class="mono">lancamento.cena.js</span> · passos e estado(t)'],
    ],
  };
}
function cenaReply(c) {
  const x = cenaState(c.at), s = cenaSim();
  if (c.step === 2) return `<p>No ponto em que você parou (${tlink('cena', c.at, `t = ${fmt(c.at)} s`)}), quem zerou foi só <i class="v">vy</i>. A velocidade horizontal continua <i class="v">vx</i> = ${scene.v0} cos ${scene.th}° = ${fmt(s.vx,1)} m/s, porque nada age na horizontal.</p><p>Então no topo a bola está andando de lado, não parada. Compare com ${tlink('cena', (s.tp * .4).toFixed(3), `t = ${fmt(s.tp * .4)} s`)}: a seta azul tem o mesmo tamanho lá.</p>`;
  return `<p>Em ${tlink('cena', c.at, `t = ${fmt(c.at)} s`)} a bola está a ${fmt(x.x,1)} m do canhão e ${fmt(Math.max(0, x.y),1)} m de altura. <i class="v">vy</i> = ${fmt(x.vy,1)} m/s: ${x.vy > 0.05 ? 'ainda sobe, só que mais devagar a cada instante' : x.vy < -0.05 ? 'já desce, e cada vez mais rápido' : 'está no topo'}. <i class="v">vx</i> segue em ${fmt(x.vx,1)} m/s o voo todo.</p>`;
}
$('#c-ask').addEventListener('click', () => { addChip(cenaChip()); $('#msg').focus(); });

PIECES.cena = {
  id:'p-cena', chip: cenaChip, reply: cenaReply, thumb: cenaThumb,
  goto: (t) => { pauseCena(); seekCena(t); }, pause: pauseCena, redraw: paintCena,
  reset() { scene.playing = false; scene.gateDone = false; $('#gate').hidden = true; scene.trials = []; setParams(20, 30); recordTrial(); },
  openGate() { scene.t = cenaSteps()[3].t; openGate(); },
  stepTime: (k) => cenaSteps()[k].t,
};
