import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {normalize, readConfig, writeConfig} = require('../config.cjs');

/* Cor opcional da matéria (#166): `color` em hex `#rrggbb` no config.json
   pinta o ícone do caderno. Sem o campo, a matéria fica como hoje (cinza);
   valor inválido é ignorado com aviso, sem derrubar a matéria nem os
   defaults (AGENTS.md: não mexer nos defaults de config.cjs). */

function captureWarnings(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    return {value: run(), warnings};
  } finally {
    console.warn = original;
  }
}

test('cor válida é aceita, aparada e normalizada em minúsculas', () => {
  const config = normalize({courses: [{id: 'calc', name: 'Cálculo', path: '/v/calc', color: '  #C02667  '}]});
  assert.deepEqual(config.courses, [{id: 'calc', name: 'Cálculo', path: '/v/calc', color: '#c02667'}]);
});

test('sem color a matéria continua sem o campo, como antes de #166', () => {
  const [course] = normalize({courses: [{id: 'calc', name: 'Cálculo', path: '/v/calc'}]}).courses;
  assert.equal(Object.hasOwn(course, 'color'), false);
});

test('cor inválida é ignorada com aviso e não derruba a matéria', () => {
  const {value: config, warnings} = captureWarnings(() =>
    normalize({courses: [
      {id: 'calc', name: 'Cálculo', path: '/v/calc', color: '#12345'},
      {id: 'fis', name: 'Física', path: '/v/fis', color: '#0F7B55'},
      {id: 'qui', name: 'Química', path: '/v/qui', color: 42},
    ]}));
  assert.deepEqual(config.courses, [
    {id: 'calc', name: 'Cálculo', path: '/v/calc'},
    {id: 'fis', name: 'Física', path: '/v/fis', color: '#0f7b55'},
    {id: 'qui', name: 'Química', path: '/v/qui'},
  ], 'a matéria inválida fica sem cor; a válida continua valendo');
  assert.equal(warnings.length, 2, `um aviso por valor inválido: ${JSON.stringify(warnings)}`);
  assert.match(warnings[0], /config\.json: cor da matéria calc ignorada: recebido "#12345"; esperado #rrggbb/);
  assert.match(warnings[1], /cor da matéria qui ignorada: recebido "42"; esperado #rrggbb/);
});

test('cor de matéria sem id casa pelo basename da pasta, como o núcleo', () => {
  const config = normalize({courses: [{name: 'Cálculo', path: ' /v/calc ', color: '#c02667'}]});
  assert.equal(config.courses[0].id, 'calc');
  assert.equal(config.courses[0].path, '/v/calc');
  assert.equal(config.courses[0].color, '#c02667');
});

test('writeConfig e readConfig preservam a cor, e valor inválido não é gravado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-cor-'));
  const file = path.join(dir, 'config.json');
  try {
    writeConfig(file, normalize({courses: [{id: 'calc', name: 'Cálculo', path: '/v/calc', color: '#C02667'}]}));
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).courses[0].color, '#c02667');
    assert.equal(readConfig(file).courses[0].color, '#c02667');
    captureWarnings(() => writeConfig(file, {courses: [{id: 'calc', name: 'Cálculo', path: '/v/calc', color: 'red'}]}));
    assert.equal(readConfig(file).courses[0].color, undefined, 'cor inválida é descartada na gravação');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
