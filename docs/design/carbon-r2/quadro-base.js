/* Base do protótipo do Quadro: utilidades, tema, linha do tempo por passo e os
   chips do "Vai com a mensagem". Cada peça se registra em PIECES. */
const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const fmt = (n, d = 2) => n.toFixed(d).replace('.', ',').replace(/^-/, '−').replace(/^−(0,0+)$/, '$1');
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

(function initTheme() {
  const q = new URLSearchParams(location.search);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = q.get('theme') || PROTO.theme || (dark ? 'dark' : 'light');
  root.dataset.accent = q.get('accent') || PROTO.accent || 'graphite';
})();
/* Link de instante na resposta do tutor: clicar leva a peça àquele ponto. */
const tlink = (kind, at, text) => `<span class="tlink" data-piece="${kind}" data-at="${at}">${text}</span>`;
const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();

/* Registro das peças, por tipo. Cada uma traz:
   id, chip() (o ponto exato onde o aluno parou), reply(chip, texto) (a resposta
   pronta do protótipo), goto(at), pause(), reset() e redraw(). */
const PIECES = {};

/* Botão Tocar/Pausar: dois ícones fixos, um escondido. Trocar o <use> por
   innerHTML deixava o "Pausar" sem ícone (rodada 1). Em <svg> a propriedade
   .hidden não existe; só o atributo esconde. */
function setPlay(btn, playing, label) {
  btn.querySelector('[data-when="paused"]').toggleAttribute('hidden', playing);
  btn.querySelector('[data-when="playing"]').toggleAttribute('hidden', !playing);
  btn.querySelector('span').textContent = label;
}

/* ---------- linha do tempo com um segmento por passo (cena e desenho) ---------- */
function buildScrub(el, marks, total) {
  el.innerHTML = '';
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i].t, b = i + 1 < marks.length ? marks[i + 1].t : total;
    if (b - a < 1e-6) continue;
    const seg = document.createElement('div');
    seg.className = 'scrub-seg';
    seg.style.left = `calc(${a / total * 100}% + ${i ? 2 : 0}px)`;
    seg.style.width = `calc(${(b - a) / total * 100}% - ${i ? 4 : 2}px)`;
    seg.dataset.a = a; seg.dataset.b = b;
    seg.title = `${i + 1}. ${marks[i].label}`;
    seg.appendChild(document.createElement('i'));
    el.appendChild(seg);
  }
  const knob = document.createElement('div'); knob.className = 'scrub-knob'; el.appendChild(knob);
}
function paintScrubAt(el, t, total, text) {
  el.querySelectorAll('.scrub-seg').forEach((seg) => {
    const a = +seg.dataset.a, b = +seg.dataset.b;
    seg.firstChild.style.width = `${clamp01((t - a) / (b - a)) * 100}%`;
  });
  const knob = el.querySelector('.scrub-knob');
  if (knob) knob.style.left = `${t / total * 100}%`;
  el.setAttribute('aria-valuetext', text);
}
function bindScrub(el, {total, seek, pause}) {
  const fromPointer = (e) => {
    const r = el.getBoundingClientRect();
    seek(clamp01((e.clientX - r.left) / r.width) * total());
  };
  el.addEventListener('pointerdown', (e) => { pause(); el.setPointerCapture(e.pointerId); fromPointer(e); });
  el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture(e.pointerId)) fromPointer(e); });
}

/* Narração em texto (sem voz): as palavras acendem com o progresso do passo. */
function paintWords(el, text, lit, key) {
  if (el.dataset.key !== key) {
    el.innerHTML = text.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
    el.dataset.key = key;
  }
  const words = el.querySelectorAll('.w');
  const n = Math.ceil(clamp01(lit) * words.length);
  words.forEach((w, k) => w.classList.toggle('off', k >= n));
}

/* ---------- Perguntar aqui: o ponto exato vai junto ----------
   No app é o "Vai com a mensagem" do Contexto (contexto.html). O painel é
   remontado sempre que o chip muda; antes ele ficava com o passo anterior. */
let chips = [];
function addChip(c) { chips = [c]; paintChips(); }
function clearChips() { chips = []; $('#payload').hidden = true; paintChips(); }
function paintChips() {
  const open = !$('#payload').hidden;
  $('#chips').innerHTML = chips.map((c, i) => `<span class="chip"><button type="button" class="chip-open" data-i="${i}" aria-expanded="${open}">${c.img ? `<img alt="" src="${c.img}">` : `<svg class="icon chip-icon"><use href="#i-${c.icon}"/></svg>`}<span>${c.label}</span></button><button type="button" class="icon-btn" data-x="${i}" aria-label="Tirar da mensagem"><svg class="icon"><use href="#i-x"/></svg></button></span>`).join('');
  $('#msg').placeholder = chips.length ? 'Pergunte sobre este ponto…' : 'Pergunte ao tutor…';
  paintPayload();
}
function paintPayload() {
  const c = chips[0];
  if (!c) { $('#payload').hidden = true; return; }
  $('#payload-rows').innerHTML = c.rows.map(([k, v]) => `<div class="payload-row"><span>${k}</span><span>${v}</span></div>`).join('');
}
$('#chips').addEventListener('click', (e) => {
  const x = e.target.closest('[data-x]');
  if (x) { chips.splice(+x.dataset.x, 1); $('#payload').hidden = true; paintChips(); return; }
  if (!e.target.closest('.chip-open')) return;
  $('#payload').hidden = !$('#payload').hidden;
  paintChips();
});
