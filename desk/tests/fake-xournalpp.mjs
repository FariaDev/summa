#!/usr/bin/env node
/* Xournal++ falso do `ler_caderno` (#135): honra `--create-img` e escreve um
   PNG mínimo no caminho pedido. O modo vem de `FAKE_XOURNALPP_MODE`
   (`ok`, `sleep`, `fail`); cada chamada é registrada em `FAKE_XOURNALPP_LOG`
   para o teste provar que o binário foi (ou não foi) chamado. */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const mode = String(process.env.FAKE_XOURNALPP_MODE || 'ok');
const sleepMs = Number(process.env.FAKE_XOURNALPP_SLEEP_MS || 0);

if (process.env.FAKE_XOURNALPP_LOG) {
  fs.appendFileSync(process.env.FAKE_XOURNALPP_LOG, `${JSON.stringify({argv})}\n`);
}

const PNG_MINIMO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

function writeImage() {
  const at = argv.indexOf('--create-img');
  const out = at >= 0 ? String(argv[at + 1] || '') : '';
  if (out) fs.writeFileSync(out, PNG_MINIMO);
}

if (mode === 'sleep') {
  setTimeout(() => { writeImage(); }, sleepMs);
} else if (mode === 'fail') {
  process.stderr.write('falha simulada do fake-xournalpp\n');
  process.exit(3);
} else {
  writeImage();
}
