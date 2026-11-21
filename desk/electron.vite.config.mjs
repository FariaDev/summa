// @ts-check
/* electron-vite (#43 fase 2): servidor com HMR (`npm run dev`) e build
   otimizado do renderer em `out/renderer/` (`npm run build`, `npm run preview`).

   Só o renderer passa pelo Vite. O main (`main.cjs` + `*-host.cjs` +
   `src/**` do main) e o `preload.cjs` seguem CommonJS lidos do fonte: o
   release é zip de `git archive` que o updater aplica e relança com
   `electron .` sem build, e o main resolve `index.html`, `ggb.html`,
   `pdf-render.html` e os locales por `__dirname`. Empacotar o main mudaria
   esses caminhos sem ganho; o preload continua sandboxed com
   contextIsolation porque é o mesmo arquivo de sempre
   (`renderer-entry.cjs` escolhe fonte, servidor ou build). */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'electron-vite';

const DESK = path.dirname(fileURLToPath(import.meta.url));

/* O que o renderer liga por caminho em tempo de execução, fora do bundle: as
   folhas de modelo de material (`free-study-pdf.mjs`, com `vite-ignore` no
   `index.html`) e os ícones do app (`assets/app-icon`, montados por nome).
   Vão para o build no mesmo caminho relativo. */
const RUNTIME_COPIES = [
  {dir: 'src/materials', keep: (name) => name.endsWith('.css')},
  {dir: 'assets', keep: () => true},
];

/** @returns {import('vite').Plugin} */
function copyRuntimeFiles() {
  return {
    name: 'summa-runtime-files',
    apply: 'build',
    closeBundle() {
      for (const {dir, keep} of RUNTIME_COPIES) {
        const from = path.join(DESK, dir);
        fs.cpSync(from, path.join(DESK, 'out', 'renderer', dir), {
          recursive: true,
          filter: (source) => fs.statSync(source).isDirectory() || keep(path.basename(source)),
        });
      }
    },
  };
}

/* No dev o Vite serve o `.json` já convertido em módulo JS; o atributo
   `with {type: 'json'}` (`locale-loader.mjs`, que o Node e o build entendem)
   faria o Chromium recusar a resposta pelo MIME. Só no servidor, ele sai. */
const JSON_ATTRIBUTE = /,\s*\{\s*with:\s*\{\s*type:\s*'json'\s*\}\s*\}/g;

/** @returns {import('vite').Plugin} */
function devJsonImports() {
  return {
    name: 'summa-dev-json-imports',
    apply: 'serve',
    transform(code, id) {
      if (!id.endsWith('.mjs') || !code.includes("type: 'json'")) return null;
      return {code: code.replace(JSON_ATTRIBUTE, ''), map: null};
    },
  };
}

export default defineConfig({
  renderer: {
    root: DESK,
    base: './',
    publicDir: false,
    server: {host: 'localhost', strictPort: false},
    build: {
      outDir: path.join(DESK, 'out', 'renderer'),
      emptyOutDir: true,
      target: 'chrome140',
      modulePreload: {polyfill: false},
      rollupOptions: {input: path.join(DESK, 'index.html')},
    },
    plugins: [copyRuntimeFiles(), devJsonImports()],
  },
});
