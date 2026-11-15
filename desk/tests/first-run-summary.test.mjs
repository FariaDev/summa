import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import {pdfSummary} from '../src/setup-flow.mjs';

/* #88: o resumo da pasta no passo PDFs diz o total e desempata nome repetido
   com a subpasta. O caminho relativo vem do host (`first-run.cjs`), como a
   biblioteca da matéria o vê (#74); a frase é montada no `setup-flow.mjs`. */

const require = createRequire(import.meta.url);
const {resolveDrop} = require('../first-run.cjs');
const pt = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'});
const say = (names, count) => pdfSummary(names, count, (key, args) => pt.t(key, args));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-first-run-summary-'));
test.after(() => fs.rmSync(root, {recursive: true, force: true}));
const make = (...parts) => {
  const file = path.join(root, ...parts);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, '%PDF-1.4\n');
  return file;
};

test('#88: o resumo diz o total, desempata o nome repetido e conta o que sobrou', () => {
  make('curso', 'Apostila.pdf');
  make('curso', 'Lista 1.pdf');
  make('curso', 'Cap 1 - Limites', 'Aula 1.pdf');
  make('curso', 'Cap 3 - Derivadas', 'Aula 1.pdf');
  make('curso', 'Cap 3 - Derivadas', 'Lista 1.pdf');
  const out = resolveDrop([path.join(root, 'curso')]);
  assert.equal(out.pdfCount, 5);
  assert.deepEqual(out.pdfNames, [
    'Apostila.pdf',
    'Cap 1 - Limites/Aula 1.pdf',
    'Cap 3 - Derivadas/Aula 1.pdf',
    'Cap 3 - Derivadas/Lista 1.pdf',
  ], 'só o nome repetido ganha a subpasta; os quatro primeiros, em ordem');
  assert.equal(
    say(out.pdfNames, out.pdfCount),
    '5 PDFs encontrados · Apostila.pdf · Cap 1 - Limites/Aula 1.pdf · Cap 3 - Derivadas/Aula 1.pdf · Cap 3 - Derivadas/Lista 1.pdf · e mais 1',
    'total, nomes repetidos distinguidos e o que sobrou dos cinco',
  );
});

test('#88: nome único fica sem subpasta e o singular acompanha o total', () => {
  make('simples', 'Ementa.pdf');
  make('simples', 'Provas', 'P1.pdf');
  const out = resolveDrop([path.join(root, 'simples')]);
  assert.deepEqual(out.pdfNames, ['Ementa.pdf', 'P1.pdf']);
  assert.equal(say(out.pdfNames, out.pdfCount), '2 PDFs encontrados · Ementa.pdf · P1.pdf');
  assert.equal(say(['Ementa.pdf'], 1), '1 PDF encontrado · Ementa.pdf');
  assert.equal(say([], 0), 'Nenhum PDF nesta pasta ainda.');
});
