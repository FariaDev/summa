import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/* #84: os requisitos do README envelheceram (Node 20 e OpenCode 2.2.4) e a
   instalação limpa leu texto que contradizia o `engines` e o pino real. Esta
   trava compara o que o README promete com desk/package.json e
   desk/src/tested-versions.json para os números não divergirem de novo. */
const DESK = path.resolve(import.meta.dirname, '..');
const readme = fs.readFileSync(path.join(DESK, '..', 'README.md'), 'utf8');

function cited(pattern) {
  const match = readme.match(pattern);
  assert.ok(match, `README.md não cita ${pattern}`);
  return match[1];
}

test('o Node citado no README é o mínimo de engines.node', () => {
  const engines = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8')).engines.node;
  const minimum = engines.replace(/[^0-9.]/g, '');
  const citedNode = cited(/Node \*\*(\d+(?:\.\d+)*)\+\*\*/);
  assert.equal(citedNode, minimum, `README.md pede Node ${citedNode}+, mas desk/package.json exige ${engines}`);
});

test('o OpenCode citado no README é o pino de tested-versions.json', () => {
  const pinned = JSON.parse(fs.readFileSync(path.join(DESK, 'src', 'tested-versions.json'), 'utf8')).opencode;
  const citedOpenCode = cited(/\*\*OpenCode (\d+\.\d+\.\d+)\*\*/);
  assert.equal(citedOpenCode, pinned, `README.md cita OpenCode ${citedOpenCode}, mas o pino é ${pinned}`);
});

test('o doctor e o desk/README.md pedem o mesmo Node que engines.node', async () => {
  const engines = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8')).engines.node;
  const major = engines.replace(/[^0-9.]/g, '').split('.')[0];
  const deskReadme = fs.readFileSync(path.join(DESK, 'README.md'), 'utf8');
  assert.match(deskReadme, new RegExp(`Requer Node ${major}\\+`), `desk/README.md deve pedir Node ${major}+`);
  const {doctorChecks} = await import('../doctor-checks.mjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'install-texts-'));
  const {rows} = doctorChecks({env: {LEARNING_DESK_RUNTIME: path.join(home, 'runtime')}, home});
  fs.rmSync(home, {recursive: true, force: true});
  const row = rows.find(item => item.name.startsWith('Node '));
  assert.equal(row?.name, `Node ${major}+ (setup a partir do código)`, `o doctor diz ${row?.name}`);
});
