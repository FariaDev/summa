/* Zip publicado do updater (#80): `git archive` da tag com prefixo que o
   updater-files.cjs descarta. Desde a #153 o zip leva o `.update-manifest.json`
   da versão: quem instala extraindo o zip já nasce com a lista gerenciada e a
   primeira atualização remove os órfãos. Só builtins — o release não ganha
   dependência nova. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {isReplaceable} = require('../updater-files.cjs');

function git(repoRoot, args) {
  return execFileSync('git', args, {cwd: repoRoot, encoding: 'utf8'}).trim();
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Arquivos da tag que o updater gerencia — o que o manifesto do zip lista.
 * @param {string} repoRoot raiz do clone
 * @param {string} version versão sem `v`
 * @returns {string[]} caminhos relativos aceitos por `isReplaceable`
 * @example releaseManagedFiles('/repo', '1.2.0').includes('desk/main.cjs') // true
 */
export function releaseManagedFiles(repoRoot, version) {
  return git(repoRoot, ['ls-tree', '-r', '--name-only', `v${version}`])
    .split('\n')
    .filter((rel) => rel && isReplaceable(rel));
}

/**
 * Monta o zip estável da tag com o manifesto da instalação dentro (#153).
 * @param {{repoRoot: string, version: string, outDir: string}} input
 * @returns {{zipName: string, zipFile: string, zipBytes: number, zipSha256: string, files: string[]}}
 * @example buildReleaseZip({repoRoot, version: '1.2.0', outDir: '/tmp/assets'})
 */
export function buildReleaseZip({repoRoot, version, outDir}) {
  const files = releaseManagedFiles(repoRoot, version);
  const zipName = `mesa-estudos-${version}.zip`;
  const zipFile = path.join(outDir, zipName);
  fs.rmSync(zipFile, {force: true});
  const manifestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-release-manifest-'));
  const manifestFile = path.join(manifestDir, '.update-manifest.json');
  try {
    fs.writeFileSync(manifestFile, JSON.stringify({version, at: new Date().toISOString(), files}, null, 2) + '\n');
    /* `--add-file` põe o manifesto sob o mesmo prefixo do zip; o updater o
       ignora ao aplicar (caminho protegido), mas a extração manual o leva. */
    git(repoRoot, ['archive', '--format=zip', `--prefix=summa-${version}/`, `--add-file=${manifestFile}`, `--output=${zipFile}`, `v${version}`]);
  } finally {
    fs.rmSync(manifestDir, {recursive: true, force: true});
  }
  return {zipName, zipFile, zipBytes: fs.statSync(zipFile).size, zipSha256: sha256File(zipFile), files};
}
