import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';
import {fakePeInstaller} from './fake-pe-installer.mjs';
import {fakeReleaseImage} from './fake-release-image-tools.mjs';

/* Script de release assinada (#80) rodando de verdade: git local temporário,
   par Ed25519 gerado no teste e nenhuma rede. Cobre keygen, sign, verify e a
   recusa enquanto a chave pública é o marcador. */
const require = createRequire(import.meta.url);
const signature = require('../updater-signature.cjs');
const updater = require('../updater.cjs');

const DESK = path.resolve(import.meta.dirname, '..');
const SCRIPT = path.join(DESK, 'scripts', 'update-release.mjs');
const tmp = () => tempDir('mesa-release-test');

function write(file, text) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text);
}

function git(args, cwd) {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

function repoFixture() {
  const root = tmp();
  write(path.join(root, 'desk', 'update-signing-key.pub'), 'PLACEHOLDER — chave ainda não configurada\n');
  write(path.join(root, 'desk', 'package.json'), '{"name":"mesa","version":"0.1.0"}\n');
  write(path.join(root, 'desk', 'main.cjs'), 'main\n');
  git(['init'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'add', '-A'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'v0.1.0'], root);
  git(['tag', 'v0.1.0'], root);
  return root;
}

/* #119: a identidade PE deve corresponder à tag, não apenas ao nome. */
function fakeInstaller(version = '0.1.0', commit = 'a'.repeat(40)) {
  const file = path.join(tmp(), `Summa-Setup-${version}.exe`);
  fs.writeFileSync(file, fakePeInstaller({version, commit}));
  return file;
}

function fakeAppImage(version = '0.1.0', identity = {name:'summa', version}) {
  const file = path.join(tmp(), `Summa-${version}-x86_64.AppImage`);
  fs.writeFileSync(file, fakeReleaseImage('AppImage', identity));
  return file;
}

function fakeDmg(version = '0.1.0', identity = {name:'summa', version}) {
  const file = path.join(tmp(), `Summa-${version}.dmg`);
  fs.writeFileSync(file, fakeReleaseImage('DMG', identity));
  return file;
}

function runScript(args, {cwd, expectFail = false} = {}) {
  const result = spawnSync(process.execPath, ['--import', path.join(DESK, 'tests', 'fake-release-image-tools.mjs'), SCRIPT, ...args], {cwd, encoding: 'utf8'});
  if (!expectFail) assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  else assert.notEqual(result.status, 0, 'o script tinha de recusar');
  return result;
}

for (const kind of ['AppImage', 'DMG']) test(`sign recusa ${kind} renomeado de outra versão antes de gerar assets`, () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd:root});
  const commit = git(['rev-parse', 'v0.1.0^{commit}'], root);
  const out = path.join(tmp(), 'assets');
  const wrong = {name:'summa', version:'0.0.9'};
  const result = runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out,
    '--exe', fakeInstaller('0.1.0', commit), '--appimage', fakeAppImage('0.1.0', kind === 'AppImage' ? wrong : undefined),
    '--dmg', fakeDmg('0.1.0', kind === 'DMG' ? wrong : undefined)], {cwd:root, expectFail:true});
  assert.match(result.stderr, /identidade.*recebido.*0.0.9.*esperado.*0.1.0/);
  assert.equal(fs.existsSync(out), false);
});

for (const kind of ['AppImage', 'DMG']) test(`sign confere produto, commit opcional e payload inválido de ${kind}`, () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd:root});
  const commit = git(['rev-parse', 'v0.1.0^{commit}'], root);
  const out = path.join(tmp(), 'assets');
  const installer = fakeInstaller('0.1.0', commit);
  const image = fakeAppImage();
  const dmg = fakeDmg();
  const target = kind === 'AppImage' ? image : dmg;
  const args = ['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', installer, '--appimage', image, '--dmg', dmg];
  for (const identity of [null, {}, {name:'outro', version:'0.1.0'}, {name:'summa', productName:'Outro', version:'0.1.0'}, {name:'summa', version:'0.1.0', commit:'b'.repeat(40)}, {name:'summa', version:'0.1.0', commit:''}]) {
    fs.writeFileSync(target, fakeReleaseImage(kind, identity));
    const result = runScript(args, {cwd:root, expectFail:true});
    assert.match(result.stderr, /identidade.*recebido.*esperado/);
    assert.equal(fs.existsSync(out), false);
  }
  fs.writeFileSync(target, fakeReleaseImage(kind, {name:'summa',version:'0.1.0',commit}).subarray(0,130));
  assert.match(runScript(args, {cwd:root, expectFail:true}).stderr, /package.json inválido/);
  assert.equal(fs.existsSync(out), false);
  fs.writeFileSync(target, '');
  assert.match(runScript(args, {cwd:root, expectFail:true}).stderr, /não encontrado ou vazio/);
  assert.equal(fs.existsSync(out), false);
  if (kind === 'AppImage') {
    fs.writeFileSync(target, 'isto não é ELF');
    assert.match(runScript(args, {cwd:root, expectFail:true}).stderr, /imagem ilegível/);
    assert.equal(fs.existsSync(out), false);
  }
  fs.writeFileSync(target, fakeReleaseImage(kind, {name:'summa',version:'0.1.0',commit}));
  runScript(args, {cwd:root});
});

test('sign recusa texto com nome de exe antes de gerar os assets', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd: root});
  const installer = path.join(tmp(), 'Summa-Setup-0.1.0.exe');
  fs.writeFileSync(installer, 'isto nao e um PE');
  const out = path.join(tmp(), 'assets');
  const result = runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', installer, '--appimage', fakeAppImage()], {cwd: root, expectFail: true});
  assert.match(result.stderr, /identidade.*recebido.*esperado/);
  assert.equal(fs.existsSync(out), false);
});

test('#80 keygen: grava a privada fora do repositório e a pública no lugar do marcador', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  const result = runScript(['keygen', '--private-key', privateFile], {cwd: root});
  assert.equal(fs.existsSync(privateFile), true);
  // Windows não tem modo POSIX: o Node sempre devolve 0o666 lá.
  if (process.platform !== 'win32') assert.equal(fs.statSync(privateFile).mode & 0o777, 0o600, 'a privada nasce com permissão 600');
  assert.ok(!result.stdout.includes('PRIVATE KEY'), 'a chave privada nunca é impressa');
  const publicKey = fs.readFileSync(path.join(root, 'desk', 'update-signing-key.pub'), 'utf8');
  assert.equal(signature.isPlaceholderKey(publicKey), false, 'a pública deixou de ser o marcador');
  assert.match(publicKey, /BEGIN PUBLIC KEY/);
});

test('#80 keygen: recusa chave privada dentro do repositório e não sobrescreve', () => {
  const root = repoFixture();
  const dentro = runScript(['keygen', '--private-key', path.join(root, 'chave.pem')], {cwd: root, expectFail: true});
  assert.match(dentro.stderr, /não pode ficar dentro do repositório/);
  const fora = path.join(tmp(), 'chave.pem');
  runScript(['keygen', '--private-key', fora], {cwd: root});
  const denovo = runScript(['keygen', '--private-key', path.join(tmp(), 'outra.pem')], {cwd: root, expectFail: true});
  assert.match(denovo.stderr, /já existe uma chave pública configurada/);
});

test('#80 keygen: recusa a privada dentro do repositório mesmo por link simbólico', (t) => {
  const root = repoFixture();
  const alias = path.join(tmp(), 'atalho');
  try {
    fs.symlinkSync(root, alias, 'junction');
  } catch (error) {
    t.skip(`sem permissão para criar link simbólico: ${error.code}`);
    return;
  }
  const result = runScript(['keygen', '--private-key', path.join(alias, 'chave.pem')], {cwd: root, expectFail: true});
  assert.match(result.stderr, /não pode ficar dentro do repositório/);
  assert.equal(fs.existsSync(path.join(root, 'chave.pem')), false, 'nada foi gravado dentro do repositório');
});

test('#80 sign/verify: monta zip com prefixo, manifesto com o commit da tag e assinatura válida', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd: root});
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'add', '-A'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'chave pública'], root);
  git(['tag', '-f', 'v0.1.0'], root);

  const out = path.join(tmp(), 'assets');
  const installer = fakeInstaller('0.1.0', git(['rev-parse', 'v0.1.0^{commit}'], root));
  const appImage = fakeAppImage();
  const dmg = fakeDmg();
  runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', installer, '--appimage', appImage, '--dmg', dmg], {cwd: root});
  const manifestFile = path.join(out, 'mesa-manifest-v0.1.0.json');
  const signatureFile = path.join(out, 'mesa-manifest-v0.1.0.sig');
  const zipFile = path.join(out, 'mesa-estudos-0.1.0.zip');
  for (const file of [manifestFile, signatureFile, zipFile]) assert.equal(fs.existsSync(file), true, path.basename(file));

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  assert.deepEqual(Object.keys(manifest).sort(), ['appImageBytes', 'appImageSha256', 'commit', 'dmgBytes', 'dmgSha256', 'exeBytes', 'exeSha256', 'version', 'zipBytes', 'zipSha256']);
  assert.equal(manifest.appImageBytes, fs.statSync(appImage).size);
  assert.equal(manifest.appImageSha256, crypto.createHash('sha256').update(fs.readFileSync(appImage)).digest('hex'));
  assert.equal(manifest.dmgBytes, fs.statSync(dmg).size);
  assert.equal(manifest.dmgSha256, crypto.createHash('sha256').update(fs.readFileSync(dmg)).digest('hex'));
  assert.equal(manifest.exeBytes, fs.statSync(installer).size);
  assert.equal(manifest.exeSha256, crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex'));
  assert.equal(fs.existsSync(path.join(out, 'Summa-Setup-0.1.0.exe')), true, 'o instalador vai para a pasta dos assets');
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.commit, git(['rev-parse', 'v0.1.0^{commit}'], root));
  assert.equal(manifest.zipBytes, fs.statSync(zipFile).size);

  const publicKey = fs.readFileSync(path.join(root, 'desk', 'update-signing-key.pub'), 'utf8');
  const verified = signature.verifySignedManifest({
    manifestBytes: fs.readFileSync(manifestFile),
    signatureBytes: fs.readFileSync(signatureFile),
    publicKey,
    announcedVersion: '0.1.0',
  });
  assert.deepEqual(verified, manifest);
  signature.assertZipMatchesManifest(fs.readFileSync(zipFile), manifest);
  const entries = updater.readZip(fs.readFileSync(zipFile));
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.name.startsWith('summa-0.1.0/')), 'prefixo que o updater-files.cjs descarta');
  /* #153: quem instala extraindo o zip já nasce com a lista gerenciada. */
  const installation = entries.find((entry) => entry.name === 'summa-0.1.0/.update-manifest.json');
  assert.ok(installation, 'o zip publicado leva o .update-manifest.json');
  const managed = JSON.parse(installation.data.toString('utf8'));
  assert.equal(managed.version, '0.1.0');
  assert.deepEqual(managed.files, ['desk/main.cjs', 'desk/package.json', 'desk/update-signing-key.pub']);

  const checked = runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root});
  assert.match(checked.stdout, /release v0\.1\.0 confere/);
  const dmgOut = path.join(out, 'Summa-0.1.0.dmg');
  fs.appendFileSync(dmgOut, 'x');
  assert.match(runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root, expectFail: true}).stderr, /O DMG tem \d+ bytes e o manifesto assinado declara \d+/);
  fs.copyFileSync(dmg, dmgOut);
  fs.rmSync(dmgOut);
  assert.match(runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root, expectFail: true}).stderr, /asset ausente: Summa-0.1.0.dmg/);
  fs.copyFileSync(dmg, dmgOut);
  fs.writeFileSync(dmgOut, Buffer.alloc(fs.statSync(dmg).size));
  assert.match(runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root, expectFail: true}).stderr, /O SHA-256 do DMG não confere/);
  fs.copyFileSync(dmg, dmgOut);

  const imageOut = path.join(out, path.basename(appImage));
  fs.appendFileSync(imageOut, 'x');
  const imageTampered = runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root, expectFail: true});
  assert.match(imageTampered.stderr, /AppImage tem \d+ bytes/);
  fs.copyFileSync(appImage, imageOut);
  fs.rmSync(imageOut);
  assert.match(runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root, expectFail: true}).stderr, /asset ausente: Summa-0.1.0-x86_64.AppImage/);
  fs.copyFileSync(appImage, imageOut);

  fs.writeFileSync(imageOut, Buffer.alloc(fs.statSync(appImage).size));
  assert.match(runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root, expectFail: true}).stderr, /SHA-256 do AppImage/);
  fs.copyFileSync(appImage, imageOut);

  /* #119: instalador trocado depois de assinar não passa na conferência. */
  fs.appendFileSync(path.join(out, 'Summa-Setup-0.1.0.exe'), 'x');
  const tampered = runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root, expectFail: true});
  assert.match(tampered.stderr, /instalador tem \d+ bytes/);
});

test('#119 sign: recusa sem o instalador ou com o instalador de outra versão', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd: root});
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'add', '-A'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'chave pública'], root);
  git(['tag', '-f', 'v0.1.0'], root);
  const out = path.join(tmp(), 'assets');
  const missing = runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out], {cwd: root, expectFail: true});
  assert.match(missing.stderr, /informe --exe <Summa-Setup-0\.1\.0\.exe>/);
  const wrong = runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', fakeInstaller('0.0.9')], {cwd: root, expectFail: true});
  assert.match(wrong.stderr, /recebido Summa-Setup-0\.0\.9\.exe; esperado Summa-Setup-0\.1\.0\.exe/);
  const missingImage = runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', fakeInstaller()], {cwd: root, expectFail: true});
  assert.match(missingImage.stderr, /informe --appimage/);
  const wrongImage = runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', fakeInstaller(), '--appimage', fakeAppImage('0.0.9')], {cwd: root, expectFail: true});
  assert.match(wrongImage.stderr, /esperado Summa-0.1.0-x86_64.AppImage/);
  assert.equal(fs.existsSync(out), false, 'recusa antes de gerar qualquer asset');
  const installer = fakeInstaller('0.1.0', git(['rev-parse', 'v0.1.0^{commit}'], root));
  const args = ['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', installer, '--appimage', fakeAppImage()];
  assert.match(runScript(args, {cwd: root, expectFail: true}).stderr, /informe --dmg/);
  assert.match(runScript([...args, '--dmg', fakeDmg('0.0.9')], {cwd: root, expectFail: true}).stderr, /DMG com nome errado/);
  const emptyDmg = fakeDmg();
  fs.truncateSync(emptyDmg, 0);
  assert.match(runScript([...args, '--dmg', emptyDmg], {cwd: root, expectFail: true}).stderr, /DMG não encontrado ou vazio/);
  const emptyImage = fakeAppImage();
  fs.truncateSync(emptyImage, 0);
  assert.match(runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out, '--exe', installer, '--appimage', emptyImage, '--dmg', fakeDmg()], {cwd: root, expectFail: true}).stderr, /AppImage não encontrado ou vazio/);
  assert.equal(fs.existsSync(out), false, 'recusa imagens ausentes, inválidas ou vazias antes de gerar assets');
});

test('#80 sign: recusa privada que não corresponde à pública commitada', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd: root});
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'add', '-A'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'chave pública'], root);
  const outra = crypto.generateKeyPairSync('ed25519').privateKey.export({type: 'pkcs8', format: 'pem'});
  const outraFile = path.join(tmp(), 'outra.pem');
  fs.writeFileSync(outraFile, outra);
  const result = runScript(['sign', 'v0.1.0', '--private-key', outraFile, '--out', path.join(tmp(), 'assets')], {cwd: root, expectFail: true});
  assert.match(result.stderr, /não corresponde a desk\/update-signing-key\.pub/);
});

test('#80 verify: recusa enquanto a chave pública for o marcador', () => {
  const root = repoFixture();
  const result = runScript(['verify', 'v0.1.0', '--dir', tmp()], {cwd: root, expectFail: true});
  assert.match(result.stderr, /marcador PLACEHOLDER/);
});
