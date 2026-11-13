import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* Rodada 3 do ciclo de UI/UX (#133 A4, #157 8/9): três pares passavam no AA
   sem margem. Em vez de remendar caso a caso, o token compartilhado sobe um
   passo. O teste lê o style.css (light-dark) e a regra local do diário, e
   mede o par real de cada tema. */
const desk = path.resolve(import.meta.dirname, '..');
const style = fs.readFileSync(path.join(desk, 'style.css'), 'utf8');
const chat = fs.readFileSync(path.join(desk, 'src', 'tutor-chat.css'), 'utf8');

function themePair(name) {
  const line = style.split('\n').find((item) => item.includes(`--${name}:light-dark(`));
  assert.ok(line, `style.css: esperado --${name}:light-dark(…, …)`);
  const start = line.indexOf('light-dark(') + 'light-dark('.length;
  let depth = 1;
  let end = start;
  for (; end < line.length && depth > 0; end += 1) {
    if (line[end] === '(') depth += 1;
    if (line[end] === ')') depth -= 1;
  }
  const inner = line.slice(start, end - 1);
  let nested = 0;
  let comma = -1;
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index] === '(') nested += 1;
    if (inner[index] === ')') nested -= 1;
    if (inner[index] === ',' && nested === 0) { comma = index; break; }
  }
  assert.ok(comma > 0, `style.css: --${name} sem par light-dark separável`);
  return {light: inner.slice(0, comma).trim(), dark: inner.slice(comma + 1).trim()};
}
function plainToken(name) {
  const match = style.match(new RegExp(`--${name}:([^;]+);`));
  assert.ok(match, `style.css: esperado --${name}:…;`);
  return match[1].trim();
}
function colorOf(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return {r: parseInt(hex[1].slice(0, 2), 16), g: parseInt(hex[1].slice(2, 4), 16), b: parseInt(hex[1].slice(4, 6), 16), a: 1};
  const rgb = value.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)$/);
  assert.ok(rgb, `cor não prevista no teste: ${value}`);
  return {r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: Number(rgb[4])};
}
function over(top, under) {
  return {r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1};
}
function luminance(color) {
  return [color.r, color.g, color.b].map((channel) => channel / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

test('A4: --faint escuro tem margem de AA sobre --raised, --surface e --selected', () => {
  const faint = colorOf(themePair('faint').dark);
  const muted = colorOf(themePair('muted').dark);
  const surface = colorOf(themePair('surface').dark);
  const backgrounds = {
    raised: colorOf(themePair('raised').dark),
    surface,
    selected: over(colorOf(themePair('selected').dark), surface),
  };
  for (const [name, background] of Object.entries(backgrounds)) {
    const ratio = contrast(faint, background);
    assert.ok(ratio >= 4.8, `escuro --faint sobre --${name} dá ${ratio.toFixed(2)}:1, esperado ≥ 4,8:1`);
  }
  assert.ok(luminance(faint) < luminance(muted), 'escuro: --faint tem de continuar abaixo de --muted na luminância');
});

test('9: o texto do primário escuro passa 5:1 sobre o fundo do primário', () => {
  assert.equal(plainToken('accent-fill'), 'var(--acc-graphite)', 'o fundo do primário é o token compartilhado --accent-fill');
  const fill = colorOf(themePair('acc-graphite').dark);
  const text = colorOf(themePair('accent-fg').dark);
  const ratio = contrast(text, fill);
  assert.ok(ratio >= 5, `escuro: texto do primário sobre --accent-fill dá ${ratio.toFixed(2)}:1, esperado ≥ 5:1`);
});

test('A4: a cabeça de falha do diário passa 4,8:1 no hover dos dois temas', () => {
  const hover = chat.match(/\.work\[data-failed=true\] \.work-head:hover\{([^}]*)\}/);
  assert.ok(hover, 'tutor-chat.css: esperado .work[data-failed=true] .work-head:hover{…}');
  assert.match(hover[1], /background:var\(--surface\)/, 'o hover da cabeça de falha não pode ficar sobre o --selected sem margem');
  const surface = themePair('surface'), danger = themePair('danger-text');
  for (const theme of ['light', 'dark']) {
    const ratio = contrast(colorOf(danger[theme]), colorOf(surface[theme]));
    assert.ok(ratio >= 4.8, `${theme}: --danger-text sobre o hover da falha dá ${ratio.toFixed(2)}:1, esperado ≥ 4,8:1`);
  }
});
