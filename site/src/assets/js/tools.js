// As ferramentas em volta do tutor na demo: GeoGebra, calculadora, QR da foto do
// celular, Configurações e a paleta ⌘K.
import {$, $$, fold, isMac} from './dom.js';
import {toggleTheme, setPref} from './prefs.js';
import {calc} from './calc.js';

/* ---------- GeoGebra: f(x) = x³ − 3x² + 4 e a tangente sob o mouse ---------- */
const G = {x0: -1.6, x1: 3.6, y0: -2.5, y1: 6.5, W: 600, H: 340};
const f = (x) => x ** 3 - 3 * x ** 2 + 4, df = (x) => 3 * x ** 2 - 6 * x;
const sx = (x) => (x - G.x0) / (G.x1 - G.x0) * G.W, sy = (y) => G.H - (y - G.y0) / (G.y1 - G.y0) * G.H;

/**
 * Desenha o gráfico uma vez e liga a tangente ao ponteiro.
 * @param {string} decimal ',' ou '.', o separador do idioma
 */
export function drawGgb(decimal) {
  const svg = $('#ggb');
  if (svg.firstChild) return;
  let h = '';
  for (let x = -1; x <= 3; x++) h += `<line class="grid" x1="${sx(x)}" x2="${sx(x)}" y1="0" y2="${G.H}"/>`;
  for (let y = -2; y <= 6; y += 2) h += `<line class="grid" y1="${sy(y)}" y2="${sy(y)}" x1="0" x2="${G.W}"/>`;
  h += `<line class="axis" x1="0" x2="${G.W}" y1="${sy(0)}" y2="${sy(0)}"/><line class="axis" y1="0" y2="${G.H}" x1="${sx(0)}" x2="${sx(0)}"/>`;
  let d = '';
  for (let i = 0; i <= 200; i++) { const x = G.x0 + (G.x1 - G.x0) * i / 200; d += (i ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(f(x)).toFixed(1); }
  h += `<path class="curve" d="${d}"/><line class="tan" id="g-tan"/><circle class="pt" id="g-pt" r="5"/>`;
  svg.innerHTML = h;
  tangent(1, decimal);
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(), k = Math.min(r.width / G.W, r.height / G.H), ox = (r.width - G.W * k) / 2;
    tangent(Math.max(-1.4, Math.min(3.4, G.x0 + ((e.clientX - r.left - ox) / k) / G.W * (G.x1 - G.x0))), decimal);
  });
}
function tangent(x, decimal) {
  const y = f(x), k = df(x), a = x - 1.2, b = x + 1.2, line = $('#g-tan');
  line.setAttribute('x1', sx(a)); line.setAttribute('y1', sy(y + k * (a - x)));
  line.setAttribute('x2', sx(b)); line.setAttribute('y2', sy(y + k * (b - x)));
  $('#g-pt').setAttribute('cx', sx(x)); $('#g-pt').setAttribute('cy', sy(y));
  const fmt = (v) => v.toFixed(2).replace('.', decimal).replace('-', '−');
  $('#g-x').textContent = fmt(x);
  $('#g-d').textContent = fmt(k);
}

// O QR é desenho; no app ele abre a página de envio na mesma rede.
function drawQr() {
  let h = '', seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="none" stroke="#161616" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#161616"/>`;
  for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
    if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) continue;
    if (rnd() > .55) h += `<rect x="${x}" y="${y}" width="1" height="1" fill="#161616"/>`;
  }
  $('#qr').innerHTML = `<rect width="25" height="25" fill="#fff"/>${h}${finder(.5, .5)}${finder(17.5, .5)}${finder(.5, 17.5)}`;
}

/**
 * Liga calculadora, QR, Configurações e a paleta.
 * @param {typeof import('./content-pt.js').default} content
 * @param {ReturnType<typeof import('./demo.js').createDemo>} demo
 */
export function initTools(content, demo) {
  const out = $('#calc-out');
  $('#calc').addEventListener('input', (e) => { out.textContent = e.target.value.trim() ? calc(e.target.value, content.decimal) : ''; });
  out.textContent = calc($('#calc').value, content.decimal);
  $('#attach-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!$('#qr').firstChild) drawQr();
    $('#qr-pop').hidden = !$('#qr-pop').hidden;
  });
  $('#gear-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('#settings');
    pop.hidden = !pop.hidden;
    $('#gear-btn').setAttribute('aria-expanded', String(!pop.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#settings,#gear-btn')) { $('#settings').hidden = true; $('#gear-btn').setAttribute('aria-expanded', 'false'); }
    if (!e.target.closest('#palette,#palette-btn')) $('#palette').hidden = true;
    if (!e.target.closest('#qr-pop,#attach-btn')) $('#qr-pop').hidden = true;
  });
  initPalette(content.commands, demo);
}

function initPalette(L, demo) {
  const CMDS = [
    [L.check, 'i-tablet', () => demo.conferir()],
    [L.caderno, 'i-notebook', () => demo.setTab('caderno')],
    [L.ggb, 'i-chart', () => demo.setTab('ggb')],
    [L.calc1, 'i-book', () => demo.setTab('calc1')],
    [L.fis1, 'i-book', () => demo.setTab('fis1')],
    [L.mini, 'i-pip', () => demo.setMini($('#stage').dataset.mini !== 'true')],
    [L.theme, 'i-moon', toggleTheme],
    [L.violet, 'i-gear', () => setPref('accent', 'violet')],
    [L.graphite, 'i-gear', () => setPref('accent', 'graphite')],
    [L.reset, 'i-plus', () => demo.resetChat()],
  ];
  let sel = 0;
  const input = $('#palette-in'), list = $('#palette-list');
  function render() {
    const q = fold(input.value), shown = CMDS.filter((c) => fold(c[0]).includes(q));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((c, i) => `<li role="option" aria-selected="${i === sel}" data-i="${CMDS.indexOf(c)}"><svg class="icon"><use href="#${c[1]}"/></svg>${c[0]}</li>`).join('');
  }
  function open() {
    if ($('#stage').dataset.mini === 'true') demo.setMini(false);
    $('#palette').hidden = false;
    input.value = '';
    sel = 0;
    render();
    input.focus({preventScroll: true});
  }
  const run = (i) => { $('#palette').hidden = true; CMDS[i][2](); };
  $('#palette-kbd').textContent = isMac ? '⌘K' : 'Ctrl K';
  $('#undo-btn').title = `${$('#undo-btn').getAttribute('aria-label')} (${isMac ? '⌘Z' : 'Ctrl+Z'})`;
  $('#palette-btn').addEventListener('click', (e) => { e.stopPropagation(); open(); });
  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    const items = $$('#palette-list li');
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      render();
    }
    if (e.key === 'Enter' && items[sel]) run(+items[sel].dataset.i);
    if (e.key === 'Escape') $('#palette').hidden = true;
  });
  list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) run(+li.dataset.i); });
  // ⌘K/Ctrl K só abre a paleta com a demo à vista; fora dela, o atalho é do navegador.
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
    if ($('#stage').dataset.offscreen !== 'false') return;
    e.preventDefault();
    open();
  });
}
