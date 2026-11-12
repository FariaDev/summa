/* Testes Lua do plugin MesaPagina fora do Xournal++ (#159): roda os
   `mesa-*.test.lua` com o primeiro Lua >= 5.3 encontrado (lua, lua5.4 ou
   lua5.3) e confere o contrato entre o SVG gerado pelo `converter.lua` real e
   o `checkInkSvg` da ponte. Sem Lua na máquina, os testes são pulados com o
   motivo — o portão não fica dependente de uma instalação opcional. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {checkInkSvg} = require('../ink-convert-host.cjs');

const DESK = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(DESK, '..');
const PLUGIN_DIR = path.join(DESK, 'src', 'xournal-plugins', 'MesaPagina');
const TESTS_DIR = path.join(DESK, 'src', 'xournal-plugins', 'tests');
const FIXTURE = path.join(DESK, 'tests', 'fixtures', 'mesa-pagina-ink.svg');
const LUA_CANDIDATES = ['lua', 'lua5.4', 'lua5.3'];

/** Primeiro interpretador Lua que responde, ou '' se não houver nenhum. */
function findLua() {
  for (const command of LUA_CANDIDATES) {
    const probe = spawnSync(command, ['-e', 'io.write(_VERSION)'], {cwd: REPO_ROOT, encoding: 'utf8'});
    if (!probe.error && probe.status === 0) return command;
  }
  return '';
}

const lua = findLua();
const semLua = lua ? false : `Lua não encontrado (${LUA_CANDIDATES.join('/')})`;

const runLua = (args) => spawnSync(lua, args, {cwd: REPO_ROOT, encoding: 'utf8'});

/* Gera o SVG da fixture com o plugin real: qualquer mudança no
   `strokesToSvg` quebra o contrato e pede a regeneração. */
const SCRIPT_FIXTURE = [
  `package.path = ${JSON.stringify(path.join(PLUGIN_DIR, '?.lua'))} .. ';' .. package.path`,
  'local Converter = require("converter")',
  'io.write(Converter.strokesToSvg({{x = {10, 30, 50}, y = {10, 30, 10}, width = 2, color = 0}}, {x = 10, y = 10, width = 40, height = 20}, 10))',
].join('\n');

test('testes Lua do plugin rodam sem o Xournal++', {skip: semLua}, () => {
  const files = fs.readdirSync(TESTS_DIR).filter((name) => name.endsWith('.test.lua')).sort();
  assert.ok(files.length >= 2, `esperava os testes Lua em ${TESTS_DIR}`);
  for (const file of files) {
    const result = runLua([path.join(TESTS_DIR, file)]);
    const saida = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    assert.equal(result.status, 0, `${file} falhou (${result.status}):\n${saida}`);
  }
});

test('SVG do converter real passa no checkInkSvg e bate com a fixture', {skip: semLua}, () => {
  const result = runLua(['-e', SCRIPT_FIXTURE]);
  const saida = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.equal(result.status, 0, `converter.lua não rodou:\n${saida}`);
  const svg = result.stdout;
  /* Para regerar a fixture depois de mudar o plugin, na raiz do repo:
     lua -e 'package.path = "desk/src/xournal-plugins/MesaPagina/?.lua;" .. package.path
       local Converter = require("converter")
       io.write(Converter.strokesToSvg({{x = {10, 30, 50}, y = {10, 30, 10}, width = 2, color = 0}},
         {x = 10, y = 10, width = 40, height = 20}, 10))' > desk/tests/fixtures/mesa-pagina-ink.svg */
  assert.equal(svg, fs.readFileSync(FIXTURE, 'utf8'), 'a fixture está velha; regenere com o comando acima');
  const checked = checkInkSvg(svg);
  assert.equal(checked.ok, true, `checkInkSvg recusou o SVG do plugin: ${checked.reason}`);
  assert.ok(checked.width > 0 && checked.height > 0, 'a ponte precisa do tamanho para renderizar');
});
