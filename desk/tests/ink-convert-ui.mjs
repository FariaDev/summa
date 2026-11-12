// node tests/ink-convert-ui.mjs — renderizador real da tinta (#159): um SVG
// de 6 pontos sai da janela escondida como PNG válido. O probe é um processo
// Electron mínimo que usa o `createInkRenderer` de verdade; a janela nunca
// aparece, e nada de canvas de tinta entra na interface.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';

const run = promisify(execFile);
const desk = path.resolve(import.meta.dirname, '..');
const electronBin = createRequire(import.meta.url)('electron');

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 240 160">'
  + '<rect x="0" y="0" width="240" height="160" fill="#ffffff"/>'
  + '<path d="M20 140 L60 40 L100 130 L140 50 L180 120 L220 60" stroke="#000000" stroke-width="3" fill="none"/>'
  + '</svg>';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ink-convert-ui-'));

async function renderProbe(label, extraArgs = []) {
  const outPng = path.join(dir, `saida-${label}.png`);
  const main = path.join(dir, `probe-${label}.cjs`);
  fs.writeFileSync(main, [
    `'use strict';`,
    `const fs = require('node:fs');`,
    `const {app} = require('electron');`,
    `const {createInkRenderer} = require(${JSON.stringify(path.join(desk, 'ink-convert-host.cjs'))});`,
    `const svg = ${JSON.stringify(SVG)};`,
    `app.setPath('userData', ${JSON.stringify(path.join(dir, `user-data-${label}`))});`,
    `app.whenReady().then(async () => {`,
    `  try {`,
    `    const png = await createInkRenderer()(svg);`,
    `    fs.writeFileSync(${JSON.stringify(outPng)}, Buffer.from(png, 'base64'));`,
    `    process.exit(0);`,
    `  } catch (error) { process.stderr.write('probe: ' + (error && error.message || error)); process.exit(1); }`,
    `});`,
  ].join('\n'));
  /* espera fixa: o probe sai sozinho (exit) quando o PNG está gravado */
  await run(electronBin, [main, '--no-sandbox', ...extraArgs], {
    cwd: desk,
    env: {...process.env, HOME: dir, XDG_CONFIG_HOME: dir},
    timeout: 60000,
  });
  return fs.readFileSync(outPng);
}

function assertSvgSized(png, label) {
  assert.ok(png.length > 100, `${label}: PNG curto demais (${png.length} bytes)`);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${label}: assinatura do PNG`);
  assert.equal(png.toString('latin1', 12, 16), 'IHDR', `${label}: bloco IHDR`);
  assert.equal(png.readUInt32BE(16), 480, `${label}: largura do PNG é a do SVG`);
  assert.equal(png.readUInt32BE(20), 320, `${label}: altura do PNG é a do SVG`);
  assert.deepEqual([...png.subarray(png.length - 12, png.length - 8)], [0, 0, 0, 0], `${label}: IEND no fim`);
  assert.ok(png.subarray(png.length - 8, png.length - 4).equals(Buffer.from([0x49, 0x45, 0x4e, 0x44])), `${label}: IEND válido`);
}

try {
  /* DPR 2 como no Retina do macOS: o PNG tem de manter o tamanho lógico do SVG. */
  for (const [label, args] of [['dpr1', []], ['dpr2', ['--force-device-scale-factor=2']]]) {
    const png = await renderProbe(label, args);
    assertSvgSized(png, label);
    console.log(`ink-convert-ui: PASS (${label}) — SVG de 6 pontos rendeu PNG ${png.length} bytes (${png.readUInt32BE(16)}×${png.readUInt32BE(20)}).`);
  }
} finally {
  fs.rmSync(dir, {recursive: true, force: true});
}
