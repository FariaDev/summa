// Build do site: escolha dos instaladores, preenchimento do template e as duas páginas.
// Rode com: node --test site/test/*.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pickDownloads, RELEASES_PAGE} from '../lib/downloads.mjs';
import {fill, downloadStrings} from '../lib/render.mjs';
import {build} from '../build.mjs';
import {calc} from '../src/assets/js/calc.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures/releases.json');
const releases = JSON.parse(await readFile(fixture, 'utf8'));

test('cada sistema pega o instalador da Release publicada mais nova que o tem', () => {
  const got = pickDownloads(releases);
  assert.equal(got.latest, 'v1.4.0', 'a pré-release não conta como a última');
  assert.deepEqual(got.mac, {version: '1.4.0', file: 'Summa-1.4.0.dmg', url: 'https://example.test/Summa-1.4.0.dmg'});
  assert.equal(got.win.file, 'Summa-Setup-1.3.9.exe', 'o Windows volta para a Release que tem o .exe');
  assert.equal(got.linux.file, 'Summa-1.4.0-x86_64.AppImage');
});

test('Releases só com o zip do atualizador (até a v1.3.3) não dão instalador', () => {
  const got = pickDownloads([releases.at(-1)]);
  assert.deepEqual(got, {latest: 'v1.3.3', mac: null, win: null, linux: null});
});

test('pickDownloads recusa o que não é a lista da API', () => {
  assert.throws(() => pickDownloads({message: 'Not Found'}), /esperava a lista/);
});

test('fill troca as chaves e acusa as que faltam', () => {
  assert.equal(fill('<a href="{{base}}x">{{nav.demo}}</a>', {base: '../', 'nav.demo': 'Try'}), '<a href="../x">Try</a>');
  assert.throws(() => fill('{{a}} {{b}} {{a}}', {}), /chaves sem texto: a, b/);
});

test('downloadStrings cai na página de Releases quando falta o instalador', () => {
  const strings = {'dl.missing.mac': 'o instalador', 'dl.missing.win': 'o instalador', 'dl.missing.linux': 'o AppImage'};
  const got = downloadStrings(pickDownloads(releases.slice(-1)), strings, RELEASES_PAGE);
  assert.equal(got['dl.mac.href'], RELEASES_PAGE);
  assert.equal(got['dl.linux.file'], 'o AppImage');
  const full = downloadStrings(pickDownloads(releases), strings, RELEASES_PAGE);
  assert.equal(full['dl.win.file'], '<b>Summa-Setup-1.3.9.exe</b>');
});

test('o JSON embutido não fecha o <script> antes da hora', () => {
  const got = downloadStrings({latest: '</script><x>', mac: null, win: null, linux: null}, {}, RELEASES_PAGE);
  assert.ok(!got['dl.json'].includes('</'));
  assert.equal(JSON.parse(got['dl.json']).latest, '</script><x>');
});

test('build monta as páginas PT e EN, com os links das Releases', async () => {
  const out = await mkdtemp(join(tmpdir(), 'summa-site-'));
  try {
    await build({out, releases: fixture, offline: false});
    const pt = await readFile(join(out, 'index.html'), 'utf8');
    const en = await readFile(join(out, 'en/index.html'), 'utf8');
    assert.match(pt, /<html lang="pt-BR">/);
    assert.match(en, /<html lang="en">/);
    assert.match(pt, /href="assets\/style\.css"/);
    assert.match(en, /href="\.\.\/assets\/style\.css"/);
    assert.match(pt, /href="https:\/\/example\.test\/Summa-1\.4\.0\.dmg"><b>Summa-1\.4\.0\.dmg<\/b>/);
    assert.match(en, /<link rel="canonical" href="https:\/\/fariadev\.github\.io\/summa\/en\/">/);
    assert.ok(!/\{\{/.test(pt + en), 'nenhuma chave sobra');
    await stat(join(out, '.nojekyll'));
    await stat(join(out, 'assets/js/main.js'));
  } finally {
    await rm(out, {recursive: true, force: true});
  }
});

test('build --offline aponta todo download para a página de Releases', async () => {
  const out = await mkdtemp(join(tmpdir(), 'summa-site-'));
  try {
    await build({out, releases: null, offline: true});
    const pt = await readFile(join(out, 'index.html'), 'utf8');
    assert.match(pt, new RegExp(`id="get-btn" href="${RELEASES_PAGE}"`));
    assert.match(pt, /o AppImage na página de Releases/);
  } finally {
    await rm(out, {recursive: true, force: true});
  }
});

test('calculadora da demo: separador do idioma e entrada fora da lista', () => {
  assert.equal(calc('sqrt(16) + sin(pi/2)', ','), '5');
  assert.equal(calc('1/4', ','), '0,25');
  assert.equal(calc('1/4', '.'), '0.25');
  assert.equal(calc('2,5*2', '.'), '5');
  assert.equal(calc('alert(1)', ','), '—');
  assert.equal(calc('1/0', ','), '—');
  assert.equal(calc('(', ','), '—');
});
