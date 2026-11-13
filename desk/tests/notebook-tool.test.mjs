/* `ler_caderno` (#135, só leitura): PNG + texto/LaTeX da página certa, recusa
   de caminho fora da lista conhecida (incl. symlink e `..`), erro legível para
   arquivo que não é gzip (e para ZIP `.xoz`), original intacto, temporário
   apagado, aviso de PDF de fundo ausente, prazo com kill, e integração com o
   `xournalpp` real quando ele está em `~/.local/bin` (pula sem ele). O .xopp
   é gerado aqui (gzip de XML mínimo); as chamadas ao binário vão para o
   `fake-xournalpp.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync, gunzipSync, inflateSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {notebookBridgeTool, notebookPageText, readNotebookPage} from '../src/extensions/mesa-mcp/notebook-tool.mjs';
import {mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';
import {createCountingReadFileSync} from './fake-read-file.mjs';
import {spawnFakeXournalpp} from './fake-xournalpp-spawn.mjs';
import {authorizedXopp} from './xopp-authorized.mjs';

const require = createRequire(import.meta.url);
const {resolveTutorPdf} = require('../pdf-read-path.cjs');
const {courseLibrary} = require('../courses.cjs');

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-xournalpp.mjs');
const REAL_XOURNALPP = path.join(os.homedir(), '.local/bin/xournalpp');

function xmlDuasPaginas() {
  return `<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Primeira página</text>
<teximage text="x^2 + y^2" left="100" top="150" right="220" bottom="180">iVBORw0KG=</teximage>
</layer>
</page>
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Segunda página</text>
</layer>
</page>
</xournal>
`;
}

function xmlTresPaginas() {
  return `<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Primeira página</text>
</layer>
</page>
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Segunda página</text>
</layer>
</page>
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Terceira página</text>
</layer>
</page>
</xournal>
`;
}

function writeXopp(dir, xml, name = 'notas.xopp') {
  const file = path.join(dir, name);
  fs.writeFileSync(file, gzipSync(xml));
  return file;
}

function tempDirs(dir) {
  return fs.readdirSync(dir).filter((entry) => entry.startsWith('mesa-ler-caderno-')).sort();
}

async function withEnvEnv(values, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await fn(); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Autorização de PDF do tutor para os testes: a mesma regra que o main monta com `resolveTutorPdf`/`pdfGrants`. @param {string[]} [library] @param {string[]} [exact] @returns {(file: string) => string} */
function pdfAuthorizer(library = [], exact = []) {
  return (file) => {
    try { return resolveTutorPdf(file, library, {exact}); } catch { return ''; }
  };
}

/** Biblioteca da matéria como o main monta (`courseLibrary(...).map(p => p.path)`). @param {string} course @returns {string[]} */
function libraryOf(course) {
  return courseLibrary(course).map((entry) => entry.path);
}

/* A ferramenta de produção no OpenCode é o `notebookBridgeTool`; nestes
   testes o `read` é o fake que chama o leitor do processo principal
   (`readNotebookPage`) direto, como o callback do main/Claude. */
const GRANT = {url: 'http://127.0.0.1:9/activity', token: 't'};

function bridgeTool(files, deps = {}) {
  const allowedXopp = authorizedXopp(...files);
  const options = {allowedXopp, xournalPath: FAKE, ...deps};
  /* O fake é `.mjs`: no Windows o spawn precisa do Node; o Xournal++ real
     continua sendo chamado direto quando o teste o injeta. */
  if (options.xournalPath === FAKE && !deps.spawnProcess) options.spawnProcess = spawnFakeXournalpp;
  return notebookBridgeTool({
    grant: GRANT,
    read: (_grant, args) => readNotebookPage(args, options),
  });
}

function makeTool(dir, options = {}) {
  return bridgeTool([options.file || writeXopp(dir, xmlDuasPaginas())], options.deps);
}

async function withFakeLog(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ler-caderno-log-'));
  const logFile = path.join(dir, 'fake-xournalpp.log');
  const count = () => {
    if (!fs.existsSync(logFile)) return [];
    return fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  };
  try {
    return await withEnvEnv({FAKE_XOURNALPP_LOG: logFile}, () => fn(count));
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

test('PNG + texto/LaTeX da página certa; original intacto; temporário apagado', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-tmp-'));
  const tmpdir = () => tmpRoot;
  const file = writeXopp(dir, xmlDuasPaginas());
  const hashBefore = sha256(file);
  await withFakeLog(async (calls) => {
    const result = await makeTool(dir, {file, deps: {tmpdir}}).call({caminho: file, pagina: 2});
    assert.equal(result.isError, undefined);
    const image = result.content.find((entry) => entry.type === 'image');
    const text = result.content.find((entry) => entry.type === 'text');
    assert.ok(image, 'a página vem com o PNG');
    assert.equal(image.mimeType, 'image/png');
    assert.deepEqual([...Buffer.from(image.data, 'base64').subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.match(text.text, /Segunda página/);
    assert.doesNotMatch(text.text, /Primeira página/);
    assert.match(text.text, /página 2 de 2/);
    assert.equal(calls().length, 1);
    const argv = calls()[0].argv;
    assert.equal(argv[1], '-n');
    assert.equal(argv[2], '2', `-n 2 (argv: ${JSON.stringify(argv)})`);
    assert.equal(argv[3], '--export-range=2', `--export-range=2 (argv: ${JSON.stringify(argv)})`);
    assert.ok(argv.includes('--create-img'));
    assert.ok(argv.includes('120'), `DPI reduzido (argv: ${JSON.stringify(argv)})`);
  });
  assert.equal(sha256(file), hashBefore, 'o .xopp original não muda');
  assert.deepEqual(tempDirs(tmpRoot), [], 'o diretório temporário é apagado');
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(tmpRoot, {recursive: true, force: true});
});

test('LaTeX sai da página pedida, não da outra', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const file = writeXopp(dir, xmlDuasPaginas());
  const result = await makeTool(dir, {file}).call({caminho: file, pagina: 1});
  const text = result.content.find((entry) => entry.type === 'text');
  assert.match(text.text, /x\^2 \+ y\^2/);
  assert.match(text.text, /Primeira página/);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('caminho fora da lista é recusado sem ler o arquivo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-tmp-'));
  const tmpdir = () => tmpRoot;
  const known = writeXopp(dir, xmlDuasPaginas());
  const outside = path.join(dir, 'fora.xopp');
  fs.writeFileSync(outside, 'isto não é gzip');
  await withFakeLog(async (calls) => {
    const result = await makeTool(dir, {file: known, deps: {tmpdir}}).call({caminho: outside, pagina: 1});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /fora da lista conhecida/);
    assert.doesNotMatch(result.content[0].text, /gzip/, 'a recusa vem antes de abrir o arquivo');
    assert.deepEqual(calls(), [], 'o binário não é chamado');
  });
  assert.deepEqual(tempDirs(tmpRoot), []);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(tmpRoot, {recursive: true, force: true});
});

test('symlink e `..` para fora da lista são recusados', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const allowed = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-allowed-'));
  const known = writeXopp(allowed, xmlDuasPaginas());
  const secret = writeXopp(dir, xmlDuasPaginas(), 'segredo.xopp');
  const link = path.join(allowed, 'atalho.xopp');
  fs.symlinkSync(secret, link);
  const viaDotDot = path.join(allowed, '..', path.basename(dir), 'segredo.xopp');
  await withFakeLog(async (calls) => {
    for (const caminho of [link, viaDotDot]) {
      const result = await makeTool(dir, {file: known}).call({caminho, pagina: 1});
      assert.equal(result.isError, true, caminho);
      assert.match(result.content[0].text, /fora da lista conhecida/, caminho);
    }
    assert.deepEqual(calls(), [], 'o binário não é chamado');
  });
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(allowed, {recursive: true, force: true});
});

test('arquivo que não é gzip vira erro legível; ZIP (.xoz) é recusado pelo nome', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const ja = path.join(dir, 'nao-gzip.xopp');
  fs.writeFileSync(ja, 'texto puro, não é gzip');
  const resultado = await makeTool(dir, {file: ja}).call({caminho: ja, pagina: 1});
  assert.equal(resultado.isError, true);
  assert.match(resultado.content[0].text, /gzip com XML Xournal/);
  const zip = path.join(dir, 'compactado.xopp');
  fs.writeFileSync(zip, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x10, 0x00, 0x00, 0x00]));
  const zipResult = await makeTool(dir, {file: zip}).call({caminho: zip, pagina: 1});
  assert.equal(zipResult.isError, true);
  assert.match(zipResult.content[0].text, /ZIP \(\.xoz\) não suportado/);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('página além do total e página inválida dizem o recebido e o esperado', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const file = writeXopp(dir, xmlDuasPaginas());
  const tool = makeTool(dir, {file});
  const beyond = await tool.call({caminho: file, pagina: 9});
  assert.equal(beyond.isError, true);
  assert.match(beyond.content[0].text, /recebido 9; esperado entre 1 e 2/);
  const invalid = await tool.call({caminho: file, pagina: 0});
  assert.equal(invalid.isError, true);
  assert.match(invalid.content[0].text, /recebido 0; esperado inteiro a partir de 1/);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('arquivo autorizado que sumiu do disco vira erro legível', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const ghost = path.join(dir, 'fantasma.xopp');
  fs.writeFileSync(ghost, gzipSync(xmlDuasPaginas()));
  const tool = bridgeTool([ghost]);
  fs.rmSync(ghost);
  const result = await tool.call({caminho: ghost, pagina: 1});
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /não encontrado/);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('fundo PDF ausente avisa sem o caminho pessoal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const xml = xmlDuasPaginas().replace(
    '<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Segunda página</text>',
    '<background type="pdf" filename="fundo.pdf"/>\n<layer>\n<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Segunda página</text>',
  );
  assert.match(xml, /type="pdf"/);
  const file = writeXopp(dir, xml);
  /* Autorização só pelo caminho: o aviso de "PDF ausente" cobre o arquivo
     autorizado que sumiu do disco (o `resolveTutorPdf` do main recusaria). */
  const missing = path.join(dir, 'fundo.pdf');
  /* O leitor canoniza o `.xopp` (`/var/folders` → `/private/var/folders` no
     macOS); a autorização compara o mesmo caminho canônico (issue #15). */
  const missingCanonical = path.join(path.dirname(fs.realpathSync.native(file)), path.basename(missing));
  const pdfAuthorize = (resolved) => (path.resolve(resolved) === missingCanonical ? resolved : '');
  const result = await makeTool(dir, {file, deps: {pdfAuthorize}}).call({caminho: file, pagina: 2});
  const text = result.content.find((entry) => entry.type === 'text');
  assert.match(text.text, /fundo PDF ausente: imagem sem o PDF/);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('prazo esgotado mata o processo e vira isError com o temporário apagado', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-tmp-'));
  const tmpdir = () => tmpRoot;
  const file = writeXopp(dir, xmlDuasPaginas());
  const started = Date.now();
  await withEnvEnv({FAKE_XOURNALPP_MODE: 'sleep', FAKE_XOURNALPP_SLEEP_MS: '4000'}, async () => {
    const result = await makeTool(dir, {file, deps: {timeoutMs: 200, tmpdir}}).call({caminho: file, pagina: 1});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /prazo de 200 ms esgotado/);
  });
  assert.ok(Date.now() - started < 3900, 'o processo foi morto, não esperado');
  assert.deepEqual(tempDirs(tmpRoot), [], 'o temporário é apagado mesmo em erro');
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(tmpRoot, {recursive: true, force: true});
});

test('falha do binário vira isError sem o temporário', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-tmp-'));
  const tmpdir = () => tmpRoot;
  const file = writeXopp(dir, xmlDuasPaginas());
  await withEnvEnv({FAKE_XOURNALPP_MODE: 'fail'}, async () => {
    const result = await makeTool(dir, {file, deps: {tmpdir}}).call({caminho: file, pagina: 1});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /código 3/);
  });
  assert.deepEqual(tempDirs(tmpRoot), []);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(tmpRoot, {recursive: true, force: true});
});

/* Novo contrato (#135): a ferramenta nunca dependeu de lista no ambiente; ela
 * existe sempre que há concessão da ponte de atividades e a lista é viva no
 * main (rota `/notebook-page`), então caderno aberto depois do connect é
 * lido. Sem concessão, a ferramenta não existe, como `ler_pdf`. */
test('o registro inclui ler_caderno sempre que há concessão da ponte, nunca por lista no ambiente', async () => {
  const without = mesaTools({}).map((tool) => tool.name);
  assert.ok(!without.includes('ler_caderno'));
  const grant = {url: 'http://127.0.0.1:9/activity', token: 't'};
  const env = {LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(grant)};
  const names = mesaTools(env).map((tool) => tool.name);
  assert.ok(names.includes('ler_caderno'));
  assert.ok(names.indexOf('ler_caderno') > names.indexOf('calcular'));
  const side = mesaTools({...env, LEARNING_DESK_PDF_ONLY: '1'}).map((tool) => tool.name);
  assert.ok(side.includes('ler_caderno'));
});

test('erro de spawn ENOENT não vaza o caminho do binário', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
  const file = writeXopp(dir, xmlDuasPaginas());
  const binaryPath = '/home/ana/.local/bin/xournalpp';
  const fakeSpawnEnoent = (binary) => {
    const child = {
      stderr: {on() {}},
      kill() {},
      on(event, callback) {
        if (event === 'error') {
          queueMicrotask(() => callback(Object.assign(Error(`spawn ${binary} ENOENT`), {code: 'ENOENT'})));
        }
        return child;
      },
    };
    return child;
  };
  const tool = bridgeTool([file], {xournalPath: binaryPath, spawnProcess: fakeSpawnEnoent});
  const result = await tool.call({caminho: file, pagina: 1});
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /ENOENT/);
  assert.doesNotMatch(result.content[0].text, /\/home\/ana\/\.local\/bin\/xournalpp/, 'o caminho absoluto não aparece');
  assert.doesNotMatch(result.content[0].text, /\/home\/ana\/\.local\/bin\//, 'nem o diretório do binário');
  fs.rmSync(dir, {recursive: true, force: true});
});

test('integração: xournalpp real exporta só a página pedida de 3 páginas',
  {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`},
  async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
    const file = writeXopp(dir, xmlTresPaginas());
    const hashBefore = sha256(file);
    let pngsGerados = null;
    const snapshotRm = (p, options) => {
      pngsGerados = fs.readdirSync(p).filter((entry) => entry.endsWith('.png'));
      return fs.rmSync(p, options);
    };
    await withEnvEnv({DISPLAY: null}, async () => {
      const tool = bridgeTool([file], {xournalPath: REAL_XOURNALPP, rm: snapshotRm});
      const result = await tool.call({caminho: file, pagina: 2});
      assert.equal(result.isError, undefined, JSON.stringify(result.content[0]?.text));
      const image = result.content.find((entry) => entry.type === 'image');
      const text = result.content.find((entry) => entry.type === 'text');
      assert.ok(image);
      const png = Buffer.from(image.data, 'base64');
      assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
      assert.ok(png.length > 10000, `PNG renderizado tem conteúdo (${png.length} bytes)`);
      assert.match(text.text, /Segunda página/);
      assert.doesNotMatch(text.text, /Primeira página/);
      assert.doesNotMatch(text.text, /Terceira página/);
      assert.deepEqual(pngsGerados?.length, 1, `só 1 PNG gerado (gerados: ${JSON.stringify(pngsGerados)})`);
    });
    assert.equal(sha256(file), hashBefore, 'o .xopp original não muda');
    fs.rmSync(dir, {recursive: true, force: true});
  });

test('integração: xournalpp real exporta a página pedida sem DISPLAY',
  {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`},
  async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-'));
    const file = writeXopp(dir, xmlDuasPaginas());
    const hashBefore = sha256(file);
    await withEnvEnv({DISPLAY: null}, async () => {
      const tool = bridgeTool([file], {xournalPath: REAL_XOURNALPP});
      const result = await tool.call({caminho: file, pagina: 2});
      assert.equal(result.isError, undefined, JSON.stringify(result.content[0]?.text));
      const image = result.content.find((entry) => entry.type === 'image');
      const text = result.content.find((entry) => entry.type === 'text');
      assert.ok(image);
      const png = Buffer.from(image.data, 'base64');
      assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
      assert.ok(png.length > 10000, `PNG renderizado tem conteúdo (${png.length} bytes)`);
      assert.match(text.text, /Segunda página/);
    });
    assert.equal(sha256(file), hashBefore, 'o .xopp original não muda');
    fs.rmSync(dir, {recursive: true, force: true});
  });

/* --- assistentes das regressões #135 (auditoria) --- */
function xmlComFundoPdf(filename) {
  return `<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="595.00" height="842.00">
<background type="pdf" domain="absolute" filename="${filename}" pageno="1"/>
<layer>
<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Página com fundo</text>
</layer>
</page>
</xournal>
`;
}

function pdfVermelho() {
  const content = '1 0 0 rg 0 0 595 842 re f';
  const bodies = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  bodies.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = out.length;
  out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function centroVermelho(png) {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let at = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idats = [];
  while (at < png.length) {
    const len = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idats.push(data);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  assert.equal(bitDepth, 8);
  assert.equal(interlace, 0);
  assert.ok(colorType === 2 || colorType === 6, `colorType ${colorType}`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idats));
  const stride = width * bpp + 1;
  assert.equal(raw.length, height * stride);
  const pixels = Buffer.alloc(height * width * bpp);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    for (let x = 0; x < width * bpp; x++) {
      const rawValue = raw[y * stride + 1 + x];
      const left = x >= bpp ? pixels[y * width * bpp + x - bpp] : 0;
      const up = y > 0 ? pixels[(y - 1) * width * bpp + x] : 0;
      const upLeft = y > 0 && x >= bpp ? pixels[(y - 1) * width * bpp + x - bpp] : 0;
      let value = rawValue;
      if (filter === 1) value = (rawValue + left) & 0xff;
      else if (filter === 2) value = (rawValue + up) & 0xff;
      else if (filter === 3) value = (rawValue + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) value = (rawValue + paeth(left, up, upLeft)) & 0xff;
      else assert.equal(filter, 0);
      pixels[y * width * bpp + x] = value;
    }
  }
  const cx = (width >> 1) * bpp, cy = (height >> 1) * width * bpp;
  const r = pixels[cy + cx], g = pixels[cy + cx + 1], b = pixels[cy + cx + 2];
  return {red: r > 180 && g < 90 && b < 90, rgb: [r, g, b]};
}

/* Captura o XML da cópia que vai ao spawn (o fake grava um PNG mínimo). */
function capturaCopia() {
  let xml = '';
  const spawnProcess = (binary, args, _opts) => {
    const copy = args[0];
    xml = gunzipSync(fs.readFileSync(copy)).toString('utf8');
    const child = {
      stderr: {on() {}},
      kill() {},
      on(event, callback) {
        if (event === 'close') queueMicrotask(() => callback(0));
        return child;
      },
    };
    const out = args[args.indexOf('--create-img') + 1];
    fs.writeFileSync(out, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    return child;
  };
  return {spawnProcess, copia: () => xml};
}

test('item 1 unit: fundo PDF fora da matéria vira sólido na cópia, com aviso e sem o caminho', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPdf = path.join(secretDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const file = writeXopp(courseRoot, xmlComFundoPdf(secretPdf));
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.ok(!copia.includes(secretPdf), 'a cópia não leva o PDF de fora');
    assert.ok(!copia.includes('privado.pdf'), 'nem o nome do PDF de fora');
    assert.match(copia, /type="solid"/);
    assert.equal(result.backgroundIgnored, true);
    const text = notebookPageText(result);
    assert.match(text, /fundo PDF ignorado/);
    assert.ok(!text.includes(secretDir), 'o aviso não leva caminho');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('item 1 unit: fundo relativo na mesma pasta e abs dentro da matéria viram caminho absoluto na cópia', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-ok-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const pdf = path.join(courseRoot, 'fundo.pdf');
    fs.writeFileSync(pdf, pdfVermelho());
    const relativo = writeXopp(courseRoot, xmlComFundoPdf('fundo.pdf'), 'relativo.xopp');
    const captureRel = capturaCopia();
    const okRel = await readNotebookPage({caminho: relativo, pagina: 1}, {
      allowedXopp: [...authorizedXopp(relativo)], xournalPath: 'xournalpp',
      pdfAuthorize: pdfAuthorizer([pdf]), spawnProcess: captureRel.spawnProcess,
    });
    assert.equal(okRel.backgroundIgnored, false);
    assert.ok(captureRel.copia().includes(fs.realpathSync.native(pdf)), `relativo virou absoluto (cópia: ${captureRel.copia().slice(0, 300)})`);
    const absoluto = writeXopp(courseRoot, xmlComFundoPdf(pdf), 'absoluto.xopp');
    const captureAbs = capturaCopia();
    const okAbs = await readNotebookPage({caminho: absoluto, pagina: 1}, {
      allowedXopp: [...authorizedXopp(absoluto)], xournalPath: 'xournalpp',
      pdfAuthorize: pdfAuthorizer([pdf]), spawnProcess: captureAbs.spawnProcess,
    });
    assert.equal(okAbs.backgroundIgnored, false);
    assert.ok(captureAbs.copia().includes(fs.realpathSync.native(pdf)));
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('item 1 real: fundo fora da matéria não rende vermelho no centro e avisa', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-real-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPdf = path.join(secretDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const file = writeXopp(courseRoot, xmlComFundoPdf(secretPdf));
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, courseRoot,
      });
      assert.equal(result.backgroundIgnored, true);
      const centro = centroVermelho(Buffer.from(result.image, 'base64'));
      assert.equal(centro.red, false, `o centro não é vermelho (rgb ${centro.rgb})`);
      assert.match(notebookPageText(result), /fundo PDF ignorado/);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('item 1 real: relativo na mesma pasta rende o fundo e absoluto na matéria rende', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-ok-real-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const pdf = path.join(courseRoot, 'fundo.pdf');
    fs.writeFileSync(pdf, pdfVermelho());
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const relativo = writeXopp(courseRoot, xmlComFundoPdf('fundo.pdf'), 'relativo.xopp');
      const okRel = await readNotebookPage({caminho: relativo, pagina: 1}, {
        allowedXopp: [...authorizedXopp(relativo)], xournalPath: REAL_XOURNALPP, pdfAuthorize: pdfAuthorizer([pdf]),
      });
      assert.equal(okRel.backgroundIgnored, false);
      const centroRel = centroVermelho(Buffer.from(okRel.image, 'base64'));
      assert.equal(centroRel.red, true, `relativo rende vermelho (rgb ${centroRel.rgb})`);
      const absoluto = writeXopp(courseRoot, xmlComFundoPdf(pdf), 'absoluto.xopp');
      const okAbs = await readNotebookPage({caminho: absoluto, pagina: 1}, {
        allowedXopp: [...authorizedXopp(absoluto)], xournalPath: REAL_XOURNALPP, pdfAuthorize: pdfAuthorizer([pdf]),
      });
      assert.equal(okAbs.backgroundIgnored, false);
      const centroAbs = centroVermelho(Buffer.from(okAbs.image, 'base64'));
      assert.equal(centroAbs.red, true, `absoluto rende vermelho (rgb ${centroAbs.rgb})`);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('item 2: falha do xournalpp devolve só o código, sem o stderr com caminho', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-stderr-'));
  try {
    const file = writeXopp(dir, xmlDuasPaginas());
    const spawnLeak = () => {
      const child = {
        stderr: {on(event, callback) { if (event === 'data') queueMicrotask(() => callback('erro em /home/segredo/privado.pdf na linha 1\n')); }},
        kill() {},
        on(event, callback) {
          if (event === 'close') queueMicrotask(() => callback(7));
          return child;
        },
      };
      return child;
    };
    const tool = bridgeTool([file], {xournalPath: '/x/journalpp', spawnProcess: spawnLeak});
    const result = await tool.call({caminho: file, pagina: 1});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /código 7/);
    assert.ok(!result.content[0].text.includes('/home/segredo'), 'o caminho do stderr não vaza');
    assert.ok(!result.content[0].text.includes('privado.pdf'), 'o nome do stderr não vaza');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('item 3: bomba de descompressão vira caderno grande demais em menos de 1 s', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bomba-'));
  try {
    const zeros = Buffer.alloc(100 * 1024 * 1024, 0);
    const file = path.join(dir, 'bomba.xopp');
    fs.writeFileSync(file, gzipSync(zeros));
    const tool = bridgeTool([file]);
    const started = Date.now();
    const result = await tool.call({caminho: file, pagina: 1});
    const elapsed = Date.now() - started;
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /grande demais/);
    assert.ok(elapsed < 1000, `explodiu em ${elapsed} ms`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('item 4: 20 mil <teximage sem fechar em tempo linear, com corte no texto longo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-quad-'));
  try {
    /* Crescimento, não teto em ms: o teto de 500 ms estourava com a suíte
       carregada. 4× mais tags custa ~4× no linear e ~16× no quadrático. */
    const scan = async (count) => {
      const fragments = '<teximage text="x">'.repeat(count);
      const xml = `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>${fragments}</layer>\n</page>\n</xournal>\n`;
      const file = writeXopp(fs.mkdtempSync(path.join(dir, `n${count}-`)), xml);
      const started = performance.now();
      const result = await bridgeTool([file]).call({caminho: file, pagina: 1});
      const elapsed = performance.now() - started;
      assert.equal(result.isError, undefined, JSON.stringify(result.content[0]?.text));
      return elapsed;
    };
    const small = await scan(5000);
    const big = await scan(20000);
    assert.ok(big < 10 * Math.max(small, 5), `varredura linear: 5 mil em ${small.toFixed(0)} ms, 20 mil em ${big.toFixed(0)} ms (quadrático daria ~16×)`);
    const longDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-corte-'));
    try {
      const big = 'a'.repeat(25000);
      const bigXml = `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">${big}</text>\n</layer>\n</page>\n</xournal>\n`;
      const bigFile = writeXopp(longDir, bigXml);
      const bigResult = await bridgeTool([bigFile]).call({caminho: bigFile, pagina: 1});
      const bigText = bigResult.content.find((entry) => entry.type === 'text');
      assert.match(bigText.text, /…\(cortado\)/, 'texto longo sai cortado');
    } finally {
      fs.rmSync(longDir, {recursive: true, force: true});
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('item 5: trocar o autorizado por symlink depois do clique recusa a leitura', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-sym-'));
  try {
    const autorizado = path.join(dir, 'aula.xopp');
    fs.writeFileSync(autorizado, gzipSync(xmlDuasPaginas()));
    /* A autorização acontece no clique, antes da troca do arquivo. */
    const tool = bridgeTool([autorizado]);
    const outro = path.join(dir, 'outro.xopp');
    fs.writeFileSync(outro, gzipSync(xmlDuasPaginas().replace('Segunda página', 'SECREDO')));
    fs.rmSync(autorizado);
    fs.symlinkSync(outro, autorizado);
    const result = await tool.call({caminho: autorizado, pagina: 2});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /fora da lista conhecida/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('item 8: primeira chamada apaga mesa-ler-caderno-* com mais de 1 hora', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-orfao-'));
  const velho = path.join(tmpRoot, 'mesa-ler-caderno-Velho1');
  const novo = path.join(tmpRoot, 'mesa-ler-caderno-Novo12');
  const outro = path.join(tmpRoot, 'mesa-outro');
  fs.mkdirSync(velho);
  fs.mkdirSync(novo);
  fs.mkdirSync(outro);
  const agora = Date.now();
  const velhoAt = new Date(agora - 2 * 3600 * 1000);
  const novoAt = new Date(agora);
  fs.utimesSync(velho, velhoAt, velhoAt);
  fs.utimesSync(novo, novoAt, novoAt);
  fs.utimesSync(outro, velhoAt, velhoAt);
  const {readNotebookPage: fresh} = await import('../src/extensions/mesa-mcp/notebook-tool.mjs?orfao=' + Date.now());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-orfao-src-'));
  try {
    const file = writeXopp(dir, xmlDuasPaginas());
    await fresh({caminho: file, pagina: 1}, {allowedXopp: [...authorizedXopp(file)], xournalPath: FAKE, spawnProcess: spawnFakeXournalpp, tmpdir: () => tmpRoot});
    assert.equal(fs.existsSync(velho), false, 'o órfão velho foi apagado');
    assert.equal(fs.existsSync(novo), true, 'o recente ficou');
    assert.equal(fs.existsSync(outro), true, 'outro prefixo ficou');
  } finally {
    fs.rmSync(tmpRoot, {recursive: true, force: true});
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('item 8: falha do rm no finally não mascara o erro original', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-rm-'));
  try {
    const file = writeXopp(dir, xmlDuasPaginas());
    const rmExplode = () => { throw Error('rm explodiu: /tmp/segredo'); };
    await withEnvEnv({FAKE_XOURNALPP_MODE: 'fail'}, async () => {
      const tool = bridgeTool([file], {rm: rmExplode});
      const result = await tool.call({caminho: file, pagina: 1});
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /código 3/);
      assert.ok(!result.content[0].text.includes('rm explodiu'), 'o erro do rm não mascarou o original');
    });
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('item 9: erro em inglês sai em inglês, sem pt-BR fixo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-en-'));
  try {
    const known = writeXopp(dir, xmlDuasPaginas());
    const outside = path.join(dir, 'fora.xopp');
    fs.writeFileSync(outside, 'isto não é gzip');
    const tool = notebookBridgeTool({
      grant: GRANT,
      language: 'en',
      read: (_grant, args) => readNotebookPage(args, {allowedXopp: authorizedXopp(known), xournalPath: FAKE}),
    });
    const result = await tool.call({caminho: outside, pagina: 1});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /outside the known list/i);
    assert.ok(!result.content[0].text.includes('fora da lista'), 'o pt-BR fixo não sai em inglês');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

/* --- regressões da revisão 8cbca4cc: lista branca de fundo --- */
const PNG_VERMELHO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=';

function pngVermelho() {
  return Buffer.from(PNG_VERMELHO_B64, 'base64');
}

function xmlComFundoTag(tag) {
  return `<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="595.00" height="842.00">
${tag}
<layer>
<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Página com fundo</text>
</layer>
</page>
</xournal>
`;
}

function capturaCopiaComArquivos() {
  let xml = '';
  let arquivos = [];
  const spawnProcess = (binary, args, _opts) => {
    const copy = args[0];
    xml = gunzipSync(fs.readFileSync(copy)).toString('utf8');
    try { arquivos = fs.readdirSync(path.dirname(copy)).sort(); } catch { arquivos = []; }
    const child = {
      stderr: {on() {}},
      kill() {},
      on(event, callback) {
        if (event === 'close') queueMicrotask(() => callback(0));
        return child;
      },
    };
    const out = args[args.indexOf('--create-img') + 1];
    fs.writeFileSync(out, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    return child;
  };
  return {spawnProcess, copia: () => xml, arquivos: () => arquivos};
}

test('regressão: type em aspas simples fora da matéria vira sólido com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-sq-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPdf = path.join(secretDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const tag = `<background type='pdf' domain='absolute' filename='${secretPdf}' pageno='1'/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag));
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.ok(!copia.includes(secretPdf), 'a cópia não leva o PDF de fora em aspas simples');
    assert.ok(!copia.includes('privado.pdf'), 'nem o nome do PDF de fora');
    assert.match(copia, /type="solid"/);
    assert.equal(result.backgroundIgnored, true);
    assert.match(notebookPageText(result), /fundo PDF ignorado/);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: type com espaços em volta do = fora da matéria vira sólido', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-sp-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPdf = path.join(secretDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const tag = `<background type = "pdf" domain = "absolute" filename = "${secretPdf}" pageno = "1"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag));
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.ok(!copia.includes(secretPdf), 'a cópia não leva o PDF de fora com espaços');
    assert.ok(!copia.includes('privado.pdf'), 'nem o nome do PDF de fora');
    assert.match(copia, /type="solid"/);
    assert.equal(result.backgroundIgnored, true);
    assert.match(notebookPageText(result), /fundo PDF ignorado/);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: type com entidade &#100; fora da matéria vira sólido', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-ent-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPdf = path.join(secretDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const tag = `<background type="p&#100;f" domain="absolute" filename="${secretPdf}" pageno="1"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag));
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.ok(!copia.includes(secretPdf), 'a cópia não leva o PDF de fora via entidade');
    assert.ok(!copia.includes('privado.pdf'), 'nem o nome do PDF de fora');
    assert.match(copia, /type="solid"/);
    assert.equal(result.backgroundIgnored, true);
    assert.match(notebookPageText(result), /fundo PDF ignorado/);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: &quot; no filename dentro da matéria escapa uma vez só na cópia', {skip: process.platform === 'win32' && 'Windows não aceita " no nome de arquivo'}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-quot-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const pdf = path.join(courseRoot, 'com"aspas.pdf');
    fs.writeFileSync(pdf, pdfVermelho());
    const tag = `<background type="pdf" domain="absolute" filename="com&quot;aspas.pdf" pageno="1"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'quot.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      pdfAuthorize: pdfAuthorizer([pdf]), spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, false);
    assert.ok(copia.includes('com&quot;aspas.pdf'), `cópia escapa a aspa uma vez (cópia: ${copia.slice(0, 400)})`);
    assert.ok(!copia.includes('&amp;quot;'), 'sem escape duplo do &quot;');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: atributo repetido vira sólido com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-dup-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPdf = path.join(secretDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const tag = `<background type="solid" type="pdf" filename="${secretPdf}"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag));
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.ok(!copia.includes(secretPdf), 'a cópia não leva o PDF via atributo repetido');
    assert.ok(!copia.includes('privado.pdf'), 'nem o nome do PDF');
    assert.match(copia, /type="solid" color="#ffffffff" style="plain"/);
    assert.equal(result.backgroundIgnored, true);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: pixmap absoluto fora da matéria vira sólido com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-pix-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPng = path.join(secretDir, 'segredo.png');
    fs.writeFileSync(secretPng, pngVermelho());
    const tag = `<background type="pixmap" domain="absolute" filename="${secretPng}"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'pix.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.ok(!copia.includes(secretPng), 'a cópia não leva o pixmap de fora');
    assert.ok(!copia.includes('segredo.png'), 'nem o nome do pixmap de fora');
    assert.match(copia, /type="solid"/);
    assert.equal(result.backgroundIgnored, true);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: pixmap relativo dentro da matéria vira absoluto na cópia', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-pix-ok-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const png = path.join(courseRoot, 'fundo.png');
    fs.writeFileSync(png, pngVermelho());
    const tag = `<background type="pixmap" domain="absolute" filename="fundo.png"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'pixok.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, false);
    assert.ok(copia.includes(fs.realpathSync.native(png)), `relativo virou absoluto (cópia: ${copia.slice(0, 400)})`);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: attach válido copia o arquivo ao lado para a temp e mantém attach', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-att-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const tag = `<background type="pdf" domain="attach" filename="fundo.pdf" pageno="1"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'attach.xopp');
    const attachSrc = `${file}.fundo.pdf`;
    fs.writeFileSync(attachSrc, pdfVermelho());
    const capture = capturaCopiaComArquivos();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, false);
    assert.match(copia, /domain="attach"/);
    assert.match(copia, /filename="fundo\.pdf"/);
    assert.ok(capture.arquivos().some((nome) => nome.endsWith('.fundo.pdf')), `o attach foi copiado para a temp (arquivos: ${JSON.stringify(capture.arquivos())})`);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: attach com ../ vira sólido com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-att-dot-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const tag = `<background type="pdf" domain="attach" filename="../segredo.pdf" pageno="1"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'attdot.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.ok(!copia.includes('../segredo.pdf'), 'a cópia não leva o ../');
    assert.ok(!copia.includes('segredo.pdf'), 'nem o nome via ../');
    assert.match(copia, /type="solid"/);
    assert.equal(result.backgroundIgnored, true);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: clone em página única com índice inválido vira branco com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-clone-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const tag = `<background type="pixmap" domain="clone" filename="0"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'clone.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, true);
    assert.match(copia, /type="solid" color="#ffffffff" style="plain"/);
    assert.ok(!copia.includes('domain="clone"'), `clone inválido vira branco (cópia: ${copia.slice(0, 400)})`);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão: DOCTYPE e ENTITY recusam o caderno inteiro', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-doctype-'));
  try {
    const variants = [
      `<?xml version="1.0" standalone="no"?>\n<!DOCTYPE xournal [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<xournal version="4">\n<page width="595.00" height="842.00">\n<background type="solid" color="#ffffffff" style="plain"/>\n<layer></layer>\n</page>\n</xournal>\n`,
      `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n<page width="595.00" height="842.00">\n<background type="solid" color="#ffffffff" style="plain"/>\n<layer></layer>\n</page>\n</xournal>\n<!DOCTYPE xournal>\n`,
    ];
    for (const [index, xml] of variants.entries()) {
      const file = writeXopp(base, xml, `doctype-${index}.xopp`);
      const tool = bridgeTool([file]);
      const result = await tool.call({caminho: file, pagina: 1});
      assert.equal(result.isError, true, `variante ${index} deve recusar`);
      assert.match(result.content[0].text, /DOCTYPE/);
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão real: aspas simples fora da matéria dá centro branco e o aviso', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-real-sq-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPdf = path.join(secretDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const tag = `<background type='pdf' domain='absolute' filename='${secretPdf}' pageno='1'/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag));
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, courseRoot,
      });
      assert.equal(result.backgroundIgnored, true);
      const centro = centroVermelho(Buffer.from(result.image, 'base64'));
      assert.equal(centro.red, false, `o centro não é vermelho (rgb ${centro.rgb})`);
      assert.match(notebookPageText(result), /fundo PDF ignorado/);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('regressão real: pixmap fora da matéria dá centro branco e o aviso', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-real-pix-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    const secretDir = path.join(base, 'segredo');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(secretDir);
    const secretPng = path.join(secretDir, 'segredo.png');
    fs.writeFileSync(secretPng, pngVermelho());
    const tag = `<background type="pixmap" domain="absolute" filename="${secretPng}"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'pixreal.xopp');
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, courseRoot,
      });
      assert.equal(result.backgroundIgnored, true);
      const centro = centroVermelho(Buffer.from(result.image, 'base64'));
      assert.equal(centro.red, false, `o centro não é vermelho (rgb ${centro.rgb})`);
      assert.match(notebookPageText(result), /fundo PDF ignorado/);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('regressão real: PDF dentro em aspas simples rende o fundo', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-real-ok-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const pdf = path.join(courseRoot, 'fundo.pdf');
    fs.writeFileSync(pdf, pdfVermelho());
    const tag = `<background type='pdf' domain='absolute' filename='fundo.pdf' pageno='1'/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'relok.xopp');
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, pdfAuthorize: pdfAuthorizer([pdf]),
      });
      assert.equal(result.backgroundIgnored, false);
      const centro = centroVermelho(Buffer.from(result.image, 'base64'));
      assert.equal(centro.red, true, `rende vermelho (rgb ${centro.rgb})`);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('regressão real: attach válido rende o fundo', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-real-att-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const tag = `<background type="pdf" domain="attach" filename="fundo.pdf" pageno="1"/>`;
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'attachreal.xopp');
    fs.writeFileSync(`${file}.fundo.pdf`, pdfVermelho());
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, courseRoot,
      });
      assert.equal(result.backgroundIgnored, false);
      const centro = centroVermelho(Buffer.from(result.image, 'base64'));
      assert.equal(centro.red, true, `rende vermelho (rgb ${centro.rgb})`);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

/* --- regressões da revisão 7e2afcd7: clone e raiz recursiva --- */

function xmlDuasPaginasClone(page1Tag, page2Tag) {
  return `<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="589.00" height="845.00">
${page1Tag}
<layer>
<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Primeira página</text>
</layer>
</page>
<page width="589.00" height="845.00">
${page2Tag}
<layer>
<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Segunda página</text>
</layer>
</page>
</xournal>
`;
}

test('regressão clone válida: página 2 com filename 0 conserva filename e sem aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-clone-val-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const png = path.join(courseRoot, 'fundo.png');
    fs.writeFileSync(png, pngVermelho());
    const xml = xmlDuasPaginasClone(
      `<background type="pixmap" domain="absolute" filename="fundo.png"/>`,
      `<background type="pixmap" domain="clone" filename="0"/>`,
    );
    const file = writeXopp(courseRoot, xml, 'clone-val.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 2}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, false);
    assert.match(copia, /type="pixmap" domain="clone" filename="0"/);
    assert.ok(!copia.match(/type="solid"[^>]*plain/), 'clone válido não vira branco');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão clone: em pdf vira branco com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-clone-pdf-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const xml = xmlDuasPaginasClone(
      `<background type="pdf" domain="absolute" filename="fundo.pdf" pageno="1"/>`,
      `<background type="pdf" domain="clone" filename="0"/>`,
    );
    const pdf = path.join(courseRoot, 'fundo.pdf');
    fs.writeFileSync(pdf, pdfVermelho());
    const file = writeXopp(courseRoot, xml, 'clone-pdf.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 2}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, true);
    assert.match(copia, /type="solid" color="#ffffffff" style="plain"/);
    assert.ok(!copia.match(/domain="clone"/), 'clone em pdf não pode restar clone');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão clone: filename não numérico ou ausente vira branco com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-clone-inv-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const invalidTags = [
      `<background type="pixmap" domain="clone" filename="abc"/>`,
      `<background type="pixmap" domain="clone"/>`,
      `<background type="pixmap" domain="clone" filename="1.5"/>`,
      `<background type="pixmap" domain="clone" filename="-1"/>`,
    ];
    for (const [index, tag] of invalidTags.entries()) {
      const xml = xmlDuasPaginasClone(
        `<background type="pixmap" domain="absolute" filename="fundo.png"/>`,
        tag,
      );
      const file = writeXopp(courseRoot, xml, `clone-inv-${index}.xopp`);
      const capture = capturaCopia();
      const result = await readNotebookPage({caminho: file, pagina: 2}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
        courseRoot, spawnProcess: capture.spawnProcess,
      });
      const copia = capture.copia();
      assert.equal(result.backgroundIgnored, true, `tag ${tag} deve avisar`);
      assert.match(copia, /type="solid" color="#ffffffff" style="plain"/, `tag ${tag} vira branco`);
      assert.ok(!copia.match(/domain="clone"/), `tag ${tag} não restar clone`);
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão clone: índice fora da faixa vira branco com aviso', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-clone-fora-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const outOfRange = [
      `<background type="pixmap" domain="clone" filename="1"/>`,
      `<background type="pixmap" domain="clone" filename="2"/>`,
      `<background type="pixmap" domain="clone" filename="5"/>`,
    ];
    for (const [index, tag] of outOfRange.entries()) {
      const xml = xmlDuasPaginasClone(
        `<background type="pixmap" domain="absolute" filename="fundo.png"/>`,
        tag,
      );
      const file = writeXopp(courseRoot, xml, `clone-fora-${index}.xopp`);
      const capture = capturaCopia();
      const result = await readNotebookPage({caminho: file, pagina: 2}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
        courseRoot, spawnProcess: capture.spawnProcess,
      });
      const copia = capture.copia();
      assert.equal(result.backgroundIgnored, true, `tag ${tag} deve avisar`);
      assert.match(copia, /type="solid" color="#ffffffff" style="plain"/);
      assert.ok(!copia.match(/domain="clone"/), `tag ${tag} não restar clone`);
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão real clone 2 páginas: página 2 renderiza o fundo da página 1', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bg-clone-real-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const png = path.join(courseRoot, 'fundo.png');
    fs.writeFileSync(png, pngVermelho());
    const xml = xmlDuasPaginasClone(
      `<background type="pixmap" domain="absolute" filename="fundo.png"/>`,
      `<background type="pixmap" domain="clone" filename="0"/>`,
    );
    const file = writeXopp(courseRoot, xml, 'clone-real.xopp');
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const result1 = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, courseRoot,
      });
      assert.equal(result1.backgroundIgnored, false);
      const centro1 = centroVermelho(Buffer.from(result1.image, 'base64'));
      assert.equal(centro1.red, true, `página 1 rende vermelho (rgb ${centro1.rgb})`);
      const result2 = await readNotebookPage({caminho: file, pagina: 2}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, courseRoot,
      });
      assert.equal(result2.backgroundIgnored, false);
      const centro2 = centroVermelho(Buffer.from(result2.image, 'base64'));
      assert.equal(centro2.red, true, `página 2 via clone rende vermelho (rgb ${centro2.rgb})`);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('regressão raiz: caderno fora da matéria com fundo em sub/privado.pdf vira branco (unit)', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-raiz-sub-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const outsideDir = path.join(base, 'casa');
    const subDir = path.join(outsideDir, 'sub');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(subDir, {recursive: true});
    const secretPdf = path.join(subDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const file = writeXopp(outsideDir, xmlComFundoPdf(path.join('sub', 'privado.pdf')), 'casa.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, true);
    assert.match(copia, /type="solid" color="#ffffffff" style="plain"/);
    assert.ok(!copia.includes(secretPdf), 'a cópia não leva o PDF em sub/ fora da matéria');
    assert.ok(!copia.includes('privado.pdf'), 'nem o nome via sub/');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão raiz: caderno fora da matéria com fundo em sub/privado.pdf vira branco (real)', {skip: fs.existsSync(REAL_XOURNALPP) ? false : `sem ${REAL_XOURNALPP}`}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-raiz-sub-real-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-home-'));
  try {
    fs.mkdirSync(path.join(home, '.config'), {recursive: true});
    const courseRoot = path.join(base, 'materia');
    const outsideDir = path.join(base, 'casa');
    const subDir = path.join(outsideDir, 'sub');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(subDir, {recursive: true});
    const secretPdf = path.join(subDir, 'privado.pdf');
    fs.writeFileSync(secretPdf, pdfVermelho());
    const file = writeXopp(outsideDir, xmlComFundoPdf(path.join('sub', 'privado.pdf')), 'casa-real.xopp');
    await withEnvEnv({DISPLAY: null, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, async () => {
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: REAL_XOURNALPP, courseRoot,
      });
      assert.equal(result.backgroundIgnored, true);
      const centro = centroVermelho(Buffer.from(result.image, 'base64'));
      assert.equal(centro.red, false, `o centro não é vermelho (rgb ${centro.rgb})`);
      assert.match(notebookPageText(result), /fundo PDF ignorado/);
    });
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('regressão raiz: fundo.pdf ao lado do caderno fora da matéria renderiza (unit)', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-raiz-lado-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const outsideDir = path.join(base, 'casa');
    fs.mkdirSync(courseRoot);
    fs.mkdirSync(outsideDir, {recursive: true});
    const pdf = path.join(outsideDir, 'fundo.pdf');
    fs.writeFileSync(pdf, pdfVermelho());
    const file = writeXopp(outsideDir, xmlComFundoPdf('fundo.pdf'), 'lado.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      pdfAuthorize: pdfAuthorizer([pdf]), spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, false);
    assert.ok(copia.includes(fs.realpathSync.native(pdf)), `PDF ao lado virou absoluto (cópia: ${copia.slice(0, 400)})`);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('regressão raiz: caderno dentro da matéria com fundo em subpasta da matéria renderiza (unit)', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-raiz-materia-sub-'));
  try {
    const courseRoot = path.join(base, 'materia');
    const subDir = path.join(courseRoot, 'sub');
    fs.mkdirSync(subDir, {recursive: true});
    const pdf = path.join(subDir, 'fundo.pdf');
    fs.writeFileSync(pdf, pdfVermelho());
    const file = writeXopp(courseRoot, xmlComFundoPdf(path.join('sub', 'fundo.pdf')), 'dentro.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      pdfAuthorize: pdfAuthorizer([pdf]), spawnProcess: capture.spawnProcess,
    });
    const copia = capture.copia();
    assert.equal(result.backgroundIgnored, false);
    assert.ok(copia.includes(fs.realpathSync.native(pdf)), `PDF em subpasta da matéria virou absoluto (cópia: ${copia.slice(0, 400)})`);
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

/* --- #213: fundo do .xopp segue a autorização de PDF do tutor --- */

test('#213: gabarito.pdf na raiz da matéria, fora de Sources/, vira branco e não vira oráculo', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-213-raiz-'));
  try {
    const course = path.join(base, 'Calculo');
    const aulas = path.join(course, 'aulas');
    const sources = path.join(course, 'Sources');
    fs.mkdirSync(aulas, {recursive: true});
    fs.mkdirSync(sources, {recursive: true});
    const a = path.join(sources, 'a.pdf');
    const gabarito = path.join(course, 'gabarito.pdf');
    fs.writeFileSync(a, pdfVermelho());
    fs.writeFileSync(gabarito, pdfVermelho());
    const library = libraryOf(course);
    assert.deepEqual(library.map((entry) => fs.realpathSync.native(entry)), [fs.realpathSync.native(a)], 'a biblioteca é só o Sources/, sem o gabarito da raiz');
    const casos = [
      writeXopp(course, xmlComFundoPdf('gabarito.pdf'), 'relativo.xopp'),
      writeXopp(aulas, xmlComFundoPdf(gabarito), 'absoluto.xopp'),
      writeXopp(course, xmlComFundoPdf('nao-existe.pdf'), 'fantasma.xopp'),
    ];
    for (const file of casos) {
      const capture = capturaCopia();
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
        /* `courseRoot` era o call site antigo; não pode mais autorizar nada. */
        courseRoot: course, pdfAuthorize: pdfAuthorizer(library), spawnProcess: capture.spawnProcess,
      });
      const copia = capture.copia();
      assert.equal(result.backgroundIgnored, true, `${path.basename(file)}: fundo não autorizado vira branco`);
      assert.match(copia, /type="solid"/);
      assert.ok(!copia.includes('gabarito.pdf') && !copia.includes('nao-existe.pdf'), `${path.basename(file)}: a cópia não leva o caminho não autorizado`);
      assert.equal(result.missingPdf, false, `${path.basename(file)}: fundo ignorado não consulta o disco (nem existente nem ausente)`);
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('#213: Sources/a.pdf da biblioteca continua aceito, ao lado ou por caminho absoluto', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-213-fonte-'));
  try {
    const course = path.join(base, 'Calculo');
    const sources = path.join(course, 'Sources');
    fs.mkdirSync(sources, {recursive: true});
    const a = path.join(sources, 'a.pdf');
    fs.writeFileSync(a, pdfVermelho());
    const library = libraryOf(course);
    const casos = [
      writeXopp(course, xmlComFundoPdf(path.join('Sources', 'a.pdf')), 'relativo.xopp'),
      writeXopp(course, xmlComFundoPdf(a), 'absoluto.xopp'),
      writeXopp(sources, xmlComFundoPdf('a.pdf'), 'ao-lado.xopp'),
    ];
    for (const file of casos) {
      const capture = capturaCopia();
      const result = await readNotebookPage({caminho: file, pagina: 1}, {
        allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
        pdfAuthorize: pdfAuthorizer(library), spawnProcess: capture.spawnProcess,
      });
      assert.equal(result.backgroundIgnored, false, `${path.basename(file)}: PDF da biblioteca é aceito`);
      assert.ok(capture.copia().includes(fs.realpathSync.native(a)), `${path.basename(file)}: o fundo aponta para o PDF da biblioteca`);
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('#213: aba Livre sem matéria só aceita PDF da sessão', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-213-livre-'));
  try {
    const livre = path.join(base, 'livre');
    const materiais = path.join(base, 'materiais');
    fs.mkdirSync(livre, {recursive: true});
    fs.mkdirSync(materiais, {recursive: true});
    const local = path.join(livre, 'local.pdf');
    const sessao = path.join(materiais, 'sessao.pdf');
    fs.writeFileSync(local, pdfVermelho());
    fs.writeFileSync(sessao, pdfVermelho());
    /* No Livre o `initialData` põe os materiais da sessão em `pdfGrants.reset`:
       viram a biblioteca; nada de varrer matéria. */
    const library = [sessao];
    const negado = writeXopp(livre, xmlComFundoPdf('local.pdf'), 'negado.xopp');
    const captureNegado = capturaCopia();
    const recusado = await readNotebookPage({caminho: negado, pagina: 1}, {
      allowedXopp: [...authorizedXopp(negado)], xournalPath: 'xournalpp',
      pdfAuthorize: pdfAuthorizer(library), spawnProcess: captureNegado.spawnProcess,
    });
    assert.equal(recusado.backgroundIgnored, true, 'PDF ao lado do caderno sem ser da sessão é recusado');
    assert.ok(!captureNegado.copia().includes(local), 'a cópia não leva o PDF local');
    const aceito = writeXopp(livre, xmlComFundoPdf(sessao), 'aceito.xopp');
    const captureAceito = capturaCopia();
    const ok = await readNotebookPage({caminho: aceito, pagina: 1}, {
      allowedXopp: [...authorizedXopp(aceito)], xournalPath: 'xournalpp',
      pdfAuthorize: pdfAuthorizer(library), spawnProcess: captureAceito.spawnProcess,
    });
    assert.equal(ok.backgroundIgnored, false, 'PDF da sessão é aceito');
    assert.ok(captureAceito.copia().includes(fs.realpathSync.native(sessao)));
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('#213: pixmap em subpasta da matéria, fora da pasta do caderno, vira branco', async () => {
  const {sanitizeBackgrounds} = await import('../src/extensions/mesa-mcp/notebook-background.mjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-213-pix-'));
  try {
    const course = path.join(base, 'Calculo');
    const sub = path.join(course, 'sub');
    fs.mkdirSync(sub, {recursive: true});
    fs.writeFileSync(path.join(sub, 'fundo.png'), pngVermelho());
    const result = sanitizeBackgrounds(xmlComFundoTag(`<background type="pixmap" domain="absolute" filename="sub/fundo.png"/>`), {
      notebookPath: path.join(course, 'pix.xopp'),
      notebookDir: course,
      /* `courseRoots` era a regra antiga; a raiz da matéria não autoriza mais. */
      courseRoots: [course],
      realpath: fs.realpathSync.native,
      caseSensitive: true,
    });
    assert.equal(result.backgroundIgnored, true, 'a raiz da matéria não autoriza mais o pixmap');
    assert.match(result.xml, /type="solid"/);
    assert.ok(!result.xml.includes('fundo.png'), 'a cópia não leva o pixmap de subpasta');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

/* --- auditoria final: 4 regressões do `ler_caderno` --- */

test('auditoria final 1: 80 mil páginas com clones em O(n log n)', async () => {
  const {sanitizeBackgrounds} = await import('../src/extensions/mesa-mcp/notebook-background.mjs');
  /* Crescimento, não teto em ms: o teto de 1 s estourava com a suíte
     carregada. 4× mais páginas custa ~4–5× no O(n log n) e ~16× no O(n²). */
  const sanitize = (count) => {
    let xml = '<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n';
    for (let i = 0; i < count; i += 1) {
      const tag = i === 0
        ? '<background type="pixmap" domain="absolute" filename="fundo.png"/>'
        : '<background type="pixmap" domain="clone" filename="0"/>';
      xml += `<page width="589.00" height="845.00">\n${tag}\n<layer></layer>\n</page>\n`;
    }
    xml += '</xournal>\n';
    const started = performance.now();
    const result = sanitizeBackgrounds(xml, {
      notebookPath: '/curso/aula.xopp',
      notebookDir: '/curso',
      courseRoots: ['/curso'],
      realpath: fs.realpathSync,
      caseSensitive: true,
    });
    const elapsed = performance.now() - started;
    assert.equal(result.backgroundIgnored, false, 'clones válidos não viram aviso');
    return elapsed;
  };
  const small = sanitize(20000);
  const big = sanitize(80000);
  assert.ok(big < 10 * Math.max(small, 5), `lista branca: 20 mil em ${small.toFixed(0)} ms, 80 mil em ${big.toFixed(0)} ms (O(n²) daria ~16×)`);
});

test('auditoria final 2: attach com modo 000 não vaza caminho', {skip: process.geteuid?.() === 0 ? 'roda como root' : process.platform === 'win32' && 'chmod 000 não bloqueia a leitura no Windows'}, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-attach-000-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const tag = '<background type="pdf" domain="attach" filename="fundo.pdf" pageno="1"/>';
    const file = writeXopp(courseRoot, xmlComFundoTag(tag), 'attach000.xopp');
    const attachSrc = `${file}.fundo.pdf`;
    fs.writeFileSync(attachSrc, pdfVermelho());
    fs.chmodSync(attachSrc, 0o000);
    try {
      const tool = bridgeTool([file], {xournalPath: FAKE});
      const result = await tool.call({caminho: file, pagina: 1});
      assert.equal(result.isError, true, 'cópia recusada vira erro traduzido');
      const text = result.content[0].text;
      assert.ok(!text.includes(base), `sem caminho absoluto (texto: ${text.slice(0, 400)})`);
      assert.ok(!text.includes(attachSrc), 'sem caminho do attach');
      assert.doesNotMatch(text, /\/tmp\//, 'nem o diretório temporário vaza');
    } finally {
      try { fs.chmodSync(attachSrc, 0o644); } catch { /* o cleanup apaga mesmo assim */ }
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('auditoria final 3: fundo fora da matéria e inexistente só avisa fundo ignorado', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-missingfora-'));
  try {
    const courseRoot = path.join(base, 'materia');
    fs.mkdirSync(courseRoot);
    const outsidePdf = path.join(base, 'fora', 'inexistente.pdf');
    const file = writeXopp(courseRoot, xmlComFundoPdf(outsidePdf), 'fora.xopp');
    const capture = capturaCopia();
    const result = await readNotebookPage({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: 'xournalpp',
      courseRoot, spawnProcess: capture.spawnProcess,
    });
    assert.equal(result.backgroundIgnored, true, 'fundo fora vira branco com aviso');
    assert.equal(result.missingPdf, false, 'fundo ignorado não gera aviso de PDF ausente');
    const text = notebookPageText(result);
    assert.match(text, /fundo PDF ignorado/);
    assert.doesNotMatch(text, /fundo PDF ausente/, 'só o aviso de ignorado');
    assert.ok(!text.includes(outsidePdf), 'sem caminho do PDF de fora');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('auditoria final 4: limpeza de órfãos com fake de fs (lstat, formato e uid)', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-orfao-fake-'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-orfao-fakesrc-'));
  try {
    const file = writeXopp(dir, xmlDuasPaginas());
    const now = Date.now();
    const old = now - 2 * 3600 * 1000;
    const currentUid = typeof process.getuid === 'function' ? process.getuid() : 1000;
    const otherUid = currentUid + 1000;
    const entries = [
      {name: 'mesa-ler-caderno-AAAAAA', kind: 'dir', uid: currentUid, mtimeMs: old},
      {name: 'mesa-ler-caderno-BBBBBB', kind: 'file', uid: currentUid, mtimeMs: old},
      {name: 'mesa-ler-caderno-CCCCCC', kind: 'link', uid: currentUid, mtimeMs: old},
      {name: 'mesa-ler-caderno-abc', kind: 'dir', uid: currentUid, mtimeMs: old},
      {name: 'mesa-ler-caderno-DDDDDD', kind: 'dir', uid: otherUid, mtimeMs: old},
    ];
    const byPath = new Map(entries.map((entry) => [path.join(tmpRoot, entry.name), entry]));
    const fakeStat = (target) => {
      const entry = byPath.get(target);
      if (!entry) return fs.statSync(target);
      const isDir = entry.kind === 'dir' || (entry.kind === 'link');
      return {mtimeMs: entry.mtimeMs, uid: entry.uid, isDirectory: () => isDir, isFile: () => entry.kind === 'file', isSymbolicLink: () => entry.kind === 'link'};
    };
    const fakeLstat = (target) => {
      const entry = byPath.get(target);
      if (!entry) return fs.lstatSync(target);
      return {mtimeMs: entry.mtimeMs, uid: entry.uid, isDirectory: () => entry.kind === 'dir', isFile: () => entry.kind === 'file', isSymbolicLink: () => entry.kind === 'link'};
    };
    const removed = [];
    const fakeRm = (target, options) => {
      if (!byPath.has(target)) return fs.rmSync(target, options);
      removed.push(target);
    };
    const {readNotebookPage: fresh} = await import('../src/extensions/mesa-mcp/notebook-tool.mjs?orfaoFake=' + String(Date.now()) + Math.random());
    await fresh({caminho: file, pagina: 1}, {
      allowedXopp: [...authorizedXopp(file)], xournalPath: FAKE, spawnProcess: spawnFakeXournalpp,
      tmpdir: () => tmpRoot,
      readdir: () => entries.map((entry) => entry.name),
      statSync: fakeStat,
      lstatSync: fakeLstat,
      rm: fakeRm,
    });
    const removedNames = removed.map((target) => path.basename(target)).sort();
    /* Sem `process.getuid` (Windows) não há dono para comparar: a pasta
       temporária já é do usuário, e o diretório "de outro uid" também sai. */
    const expected = typeof process.getuid === 'function' ? ['mesa-ler-caderno-AAAAAA'] : ['mesa-ler-caderno-AAAAAA', 'mesa-ler-caderno-DDDDDD'];
    assert.deepEqual(removedNames, expected, `só o diretório certo e velho é apagado (apagados: ${JSON.stringify(removedNames)})`);
    void now;
  } finally {
    fs.rmSync(tmpRoot, {recursive: true, force: true});
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('F5: .xopp acima do teto de 32 MB é recusado pelo stat, sem readFile', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-f5-'));
  try {
    const file = path.join(dir, 'grande.xopp');
    const handle = fs.openSync(file, 'w');
    fs.ftruncateSync(handle, 40 * 1024 * 1024);
    fs.closeSync(handle);
    const counter = createCountingReadFileSync((target, ...args) => fs.readFileSync(target, ...args));
    await assert.rejects(
      () => readNotebookPage({caminho: file, pagina: 1}, {allowedXopp: [...authorizedXopp(file)], readFile: counter.readFileSync, courseRoot: dir}),
      /tooLarge|grande demais/i,
    );
    assert.equal(counter.calls.length, 0, 'o tamanho é conferido antes do readFile');
    assert.equal(counter.bytesRead(), 0);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
