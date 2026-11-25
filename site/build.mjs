#!/usr/bin/env node
// Monta o site estático em site/dist: a página em português na raiz e a inglesa em
// en/, com os links de download tirados das Releases do GitHub. Sem dependências.
//
//   node site/build.mjs                       # busca as Releases na API
//   node site/build.mjs --releases r.json     # usa uma lista salva (testes)
//   node site/build.mjs --offline             # sem rede: todo botão vai à página de Releases
//   node site/build.mjs --out /tmp/site
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pickDownloads, RELEASES_PAGE} from './lib/downloads.mjs';
import {fill, downloadStrings} from './lib/render.mjs';

const SITE_URL = 'https://fariadev.github.io/summa/';
const API = 'https://api.github.com/repos/FariaDev/summa/releases?per_page=30';
const here = dirname(fileURLToPath(import.meta.url));

const LANGS = [
  {code: 'pt', dir: '', base: '', image: 'social-preview.png'},
  {code: 'en', dir: 'en', base: '../', image: 'social-preview-en.png'},
];

function parseArgs(argv) {
  const args = {out: join(here, 'dist'), releases: null, offline: false};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = resolve(argv[++i]);
    else if (argv[i] === '--releases') args.releases = resolve(argv[++i]);
    else if (argv[i] === '--offline') args.offline = true;
    else throw new Error(`argumento desconhecido: ${argv[i]} (esperava --out <pasta>, --releases <arquivo.json> ou --offline)`);
  }
  return args;
}

async function loadReleases({releases, offline}) {
  if (offline) return [];
  if (releases) return JSON.parse(await readFile(releases, 'utf8'));
  const headers = {accept: 'application/vnd.github+json', 'user-agent': 'summa-site-build'};
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(API, {headers});
  if (!res.ok) throw new Error(`API do GitHub respondeu ${res.status} em ${API} (esperava 200 com a lista de Releases)`);
  return res.json();
}

/**
 * Monta as duas páginas e copia os arquivos. Devolve o que escolheu, para o log e os testes.
 * @param {{out: string, releases: string|null, offline: boolean}} args
 * @example await build({out: 'site/dist', releases: null, offline: true})
 */
export async function build(args) {
  const downloads = pickDownloads(await loadReleases(args));
  const template = await readFile(join(here, 'src/page.html'), 'utf8');
  await rm(args.out, {recursive: true, force: true});
  await mkdir(args.out, {recursive: true});
  await cp(join(here, 'src/assets'), join(args.out, 'assets'), {recursive: true});
  for (const lang of LANGS) {
    const strings = JSON.parse(await readFile(join(here, `src/strings/${lang.code}.json`), 'utf8'));
    const page = fill(template, {
      ...strings,
      ...downloadStrings(downloads, strings, RELEASES_PAGE),
      base: lang.base,
      lang: lang.code,
      'meta.url': SITE_URL + (lang.dir ? lang.dir + '/' : ''),
      'meta.url.pt': SITE_URL,
      'meta.url.en': SITE_URL + 'en/',
      'meta.image': SITE_URL + 'assets/' + lang.image,
    });
    await mkdir(join(args.out, lang.dir), {recursive: true});
    await writeFile(join(args.out, lang.dir, 'index.html'), page);
  }
  // Sem isso, o Pages passa a pasta pelo Jekyll, que pula arquivos e pastas com "_".
  await writeFile(join(args.out, '.nojekyll'), '');
  return downloads;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const downloads = await build(args);
  for (const os of ['mac', 'win', 'linux']) {
    const item = downloads[os];
    if (item) console.log(`${os}: ${item.file}`);
    else console.warn(`aviso: nenhuma Release tem o instalador de ${os}; o link vai para ${RELEASES_PAGE}`);
  }
  console.log(`site em ${args.out} (última Release: ${downloads.latest || 'nenhuma'})`);
}
