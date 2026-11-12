import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {thinkingMarkMarkup} from '../src/thinking-mark.mjs';

/* A marca do "pensando" é a opção K de docs/design/marca/movimento.html
   (2026-11-11): a integral parada ao lado do texto, e um brilho só atravessa
   as duas como uma peça. O brilho e o movimento reduzido ficam no CSS. */

test('a marca é a integral parada do path aprovado, sem luminária', () => {
  const html = thinkingMarkMarkup();
  assert.match(html, /^<span class="thinking-mark" aria-hidden="true"><svg class="thinking-mark-art" viewBox="155 150 940 940"/);
  assert.match(html, /class="thinking-mark-base" d="M 800\.500 166\.419/);
  assert.doesNotMatch(html, /lamp|mascote|personagem/);
});

test('um brilho só atravessa a integral e o texto; reduzido respira sem brilho', () => {
  const css = fs.readFileSync(new URL('../src/tutor-chat.css', import.meta.url), 'utf8');
  assert.match(css, /\.work-shine\{[^}]*mask-image:linear-gradient\(90deg,color-mix\(in srgb,var\(--mix-black\) 30%,transparent\) 0 40%,var\(--mix-black\) 50%,color-mix\(in srgb,var\(--mix-black\) 30%,transparent\) 60% 100%\)[^}]*animation:work-shine calc\(var\(--t-loop\) \* 1\.5\) linear infinite\}/);
  assert.match(css, /@keyframes work-shine\{from\{-webkit-mask-position:100% 0;mask-position:100% 0\}to\{-webkit-mask-position:0 0;mask-position:0 0\}\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.work-shine\{animation:work-breathe calc\(var\(--t-loop\) \* 5 \/ 3\) var\(--ease-move\) infinite;-webkit-mask-image:none;mask-image:none\}\}/);
  assert.match(css, /@keyframes work-breathe\{50%\{opacity:\.4\}\}/);
  assert.match(css, /\.work\[data-live=true\] \.work-mark\{color:var\(--fg\)\}/);
  assert.match(css, /:root\[data-accent=violet\] \.work-mark\[data-lamp="thinking"\]\{color:var\(--acc-violet-text\)\}/);
});
