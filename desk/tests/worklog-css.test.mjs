import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* #90 manteve o diário recolhido como uma linha; a etapa 4 troca o cartão por
   um bloco com fio em cima e embaixo e, aberto, uma linha por leitura. */
const css = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'src', 'tutor-chat.css'), 'utf8');

test('o diário não é cartão: fio de 1px em cima e embaixo, sem fundo nem raio', () => {
  const work = css.match(/\.work\{([^}]*)\}/);
  assert.ok(work, 'tutor-chat.css: esperado .work{…}');
  assert.match(work[1], /border-top:1px solid var\(--border\)/);
  assert.match(work[1], /border-bottom:1px solid var\(--border\)/);
  assert.doesNotMatch(work[1], /background/);
  assert.doesNotMatch(work[1], /border-radius/);
  const head = css.match(/\.work \.work-head\{([^}]*)\}/);
  assert.ok(head, 'tutor-chat.css: esperado .work .work-head{…}');
  assert.match(head[1], /background:transparent/);
});

test('a linha de ferramenta alinha nome, alvo e duração sem cartão', () => {
  const row = css.match(/\.work-step\[data-row=tool\] \.step-line\{([^}]*)\}/);
  assert.ok(row, 'tutor-chat.css: esperado .work-step[data-row=tool] .step-line{…}');
  assert.match(row[1], /display:flex/);
  const label = css.match(/\.work-step\[data-row=tool\] \.step-label\{([^}]*)\}/);
  assert.match(label[1], /font-family:var\(--font-mono\)/);
  const target = css.match(/\.work-step\[data-row=tool\] \.step-preview\{([^}]*)\}/);
  assert.match(target[1], /color:var\(--muted\)/);
  const toggle = css.match(/\n\.step-toggle\{([^}]*)\}/);
  assert.match(toggle[1], /background:transparent/);
  assert.match(toggle[1], /box-shadow:none/);
});

/* F15 (rodada 1 de cadernos): o relógio do diário ficava em --faint sobre o
   hover (--selected) do #sidebar: 3,97:1 no claro e 4,33:1 no escuro, a 11px.
   O token certo para texto secundário é --muted; o teste mede o par real do
   hover nos dois temas, sem depender de captura. */
const tokens = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'style.css'), 'utf8');

function themePair(name) {
  const line = tokens.split('\n').find((item) => item.includes(`--${name}:light-dark(`));
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

test('F15: o relógio do diário usa --muted e passa AA no hover dos dois temas', () => {
  const meta = css.match(/\.work-meta\{([^}]*)\}/);
  assert.ok(meta, 'tutor-chat.css: esperado .work-meta{…}');
  assert.match(meta[1], /color:var\(--muted\)/, 'o relógio é texto secundário: --muted, não --faint');
  const muted = themePair('muted'), selected = themePair('selected'), surface = themePair('surface');
  for (const theme of ['light', 'dark']) {
    const hover = over(colorOf(selected[theme]), colorOf(surface[theme]));
    const ratio = contrast(colorOf(muted[theme]), hover);
    assert.ok(ratio >= 4.5, `${theme}: relógio sobre o hover dá ${ratio.toFixed(2)}:1, esperado ≥ 4,5:1`);
  }
});

/* N7 (#135 rodada 2): "Detalhes técnicos" repetia o par do F15 — --faint sobre
   o hover do passo (--selected) dava 3,97:1 no claro e 4,33:1 no escuro, a
   11px. O teste mede o rótulo real sobre o fundo do hover nos dois temas. */
test('N7: "Detalhes técnicos" usa --muted e passa AA no hover do passo', () => {
  const label = css.match(/\.step-tech-label\{([^}]*)\}/);
  assert.ok(label, 'tutor-chat.css: esperado .step-tech-label{…}');
  assert.match(label[1], /color:var\(--muted\)/, 'o rótulo é texto secundário: --muted, não --faint');
  const muted = themePair('muted'), selected = themePair('selected'), surface = themePair('surface');
  for (const theme of ['light', 'dark']) {
    const hover = over(colorOf(selected[theme]), colorOf(surface[theme]));
    const ratio = contrast(colorOf(muted[theme]), hover);
    assert.ok(ratio >= 4.5, `${theme}: "Detalhes técnicos" sobre o hover dá ${ratio.toFixed(2)}:1, esperado ≥ 4,5:1`);
  }
});
