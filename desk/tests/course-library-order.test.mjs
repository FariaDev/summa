import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {courseLibrary} = require('../courses.cjs');

/* Fixa a ordem da biblioteca de PDFs da matéria (o que a varredura
   compartilhada de `file-scan.cjs` tem de preservar): nome em localeCompare,
   no empate a ordem de varredura (raiz por raiz, na ordem das
   `source_roots`), profundidade maior que 6 fora, o canônico duplicado
   dedupado (o primeiro vence) e a pasta da matéria fora das raízes só
   entra via `Materiais da Mesa`. */

function writePdf(file) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, '%PDF-1.4\nteste');
}

test('courseLibrary: nome, empate pela varredura, profundidade, dedupe e raízes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-course-order-'));
  try {
    const course = path.join(root, 'Courses', 'Calc');
    const r1 = path.join(root, 'r1');
    const r2 = path.join(root, 'r2');
    fs.mkdirSync(course, {recursive: true});
    writePdf(path.join(course, 'raiz.pdf'));
    writePdf(path.join(r1, 'zeta.pdf'));
    writePdf(path.join(r1, 'dup.pdf'));
    fs.writeFileSync(path.join(r1, 'nota.txt'), 'não é PDF');
    fs.symlinkSync(r1, path.join(r1, 'loop'));
    let deep = r1;
    for (let level = 1; level <= 6; level += 1) {
      deep = path.join(deep, `d${level}`);
      fs.mkdirSync(deep, {recursive: true});
    }
    writePdf(path.join(deep, 'nivel6.pdf'));
    const tooDeep = path.join(deep, 'd7');
    fs.mkdirSync(tooDeep, {recursive: true});
    writePdf(path.join(tooDeep, 'nivel7.pdf'));
    writePdf(path.join(r2, 'dup.pdf'));
    writePdf(path.join(r2, 'alfa.pdf'));
    fs.symlinkSync(path.join(r1, 'zeta.pdf'), path.join(r2, 'zlink.pdf'));
    writePdf(path.join(course, 'Materiais da Mesa', 'meio.pdf'));
    fs.writeFileSync(path.join(course, '_state.md'), `---\nsource_roots:\n  - ${r1}\n  - ${r2}\n---\n`);
    assert.deepEqual(courseLibrary(course), [
      {name: 'alfa.pdf', path: path.join(r2, 'alfa.pdf')},
      {name: 'dup.pdf', path: path.join(r1, 'dup.pdf')},
      {name: 'dup.pdf', path: path.join(r2, 'dup.pdf')},
      {name: 'meio.pdf', path: path.join(course, 'Materiais da Mesa', 'meio.pdf')},
      {name: 'nivel6.pdf', path: path.join(deep, 'nivel6.pdf')},
      {name: 'zeta.pdf', path: path.join(r1, 'zeta.pdf')},
    ]);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
