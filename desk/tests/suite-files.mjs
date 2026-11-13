/* Quais arquivos cada corredor roda: uma fonte só para `run-ui`, `run-hunts` e
   para o `ui-waits.test.mjs`, que conta as esperas fixas nos mesmos arquivos.

   `npm run ui`: os `*-ui.mjs` (menos `hunt-*`, que são do `npm run hunts`), os
   `*-ipc-smoke.mjs`, o `ui-smoke.mjs` e os poucos arquivos nomeados abaixo.
   Ficam de fora, por motivo declarado:
   - `claude-*` e afins: têm corredor próprio (`npm run test:claude-ui`);
   - os que usam o Pi REAL ou o app instalado (`subjects-ui`, `session-switch`,
     `app-smoke`, `performance-smoke`, `smoke-x3`): são opt-in,
     cada um com o seu `npm run test:*`;
   - `packaged-app-ui` (#51): monta o bundle .app numa pasta temporária (só
     macOS, ~300 MB clonados); roda com `npm run test:packaged`.
   `npm run hunts`: `hunt-*.mjs` (os fakes de motor moram fora desse prefixo). */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));

const OWN_RUNNER=new Set(['claude-ui-smoke.mjs','claude-controls-ui.mjs','claude-lifecycle-ui.mjs','claude-host-recovery.mjs','claude-offline-queue-ui.mjs','sidechat-claude-recoverable-ui.mjs','mesa-claude-activity-ui.mjs','claude-executable-upgrade-ui.mjs','claude-version-range-ui.mjs']);
const OPT_IN=new Set(['packaged-app-ui.mjs','subjects-ui.mjs','app-smoke.mjs','performance-smoke.mjs','smoke-x3.mjs','session-switch.mjs','run-ui.mjs','run-claude-ui.mjs']);
const NAMED=new Set(['study-backup-e2e.mjs','sidechat-draft-reload.mjs','sidechat-ui-races.mjs','pdf-rotation.mjs']);

const uiPicks=f=>!f.startsWith('hunt-')&&(/(-ui|-ipc-smoke)\.mjs$/.test(f)||f==='ui-smoke.mjs'||NAMED.has(f));
const matches=(file,match)=>match.split(',').some(m=>file.includes(m));

/** Testes de janela de `npm run ui`; `match` filtra por trecho do nome (vírgula separa)
 * e `exclude` tira os que rodam em passo próprio (motores pesados, um por vez).
 * @param {string} [match] @param {string} [exclude] @returns {string[]} */
export function uiFiles(match='',exclude=''){
 return fs.readdirSync(here).filter(f=>uiPicks(f)&&!OWN_RUNNER.has(f)&&!OPT_IN.has(f)&&matches(f,match)&&!(exclude&&matches(f,exclude))).sort();
}

/** Hunts de `npm run hunts`; `match` filtra como em `uiFiles`. */
export function huntFiles(match=''){
 return fs.readdirSync(here).filter(f=>/^hunt-.*\.mjs$/.test(f)&&matches(f,match)).sort();
}

const SHARD_FORMAT=/^(\d+)\/(\d+)$/;

/** Lê o `--shard I/N` (I de 1 a N); `null` devolve `null`, a rodada inteira.
 * Recusa o que não cobriria a lista uma vez, como `0/4`, `5/4` ou `2/0`.
 * Exemplo: parseShard('2/4') → {index:2,count:4}; parseShard(null) → null.
 * @param {string|null} value @returns {{index:number,count:number}|null} */
export function parseShard(value){
 if(value==null)return null;
 const match=SHARD_FORMAT.exec(String(value).trim());
 if(!match)throw new Error(`--shard: esperava I/N (ex.: 2/4), recebi "${value}"`);
 const index=Number(match[1]);
 const count=Number(match[2]);
 if(index<1||count<1||index>count)throw new Error(`--shard: esperava 1 <= I <= N, recebi "${value}"`);
 return {index,count};
}

/** A `index`-ésima fatia (1-based) da lista JÁ filtrada por `match`/`exclude`.
 * Round-robin na ordem recebida: o arquivo na posição `p` vai para `p % N + 1`.
 * A trilha de tempos fica em `.runtime/` (fora do git), então no CI não há peso
 * conhecido; contar posições é o que dá a mesma divisão em toda máquina (dois
 * jobs da matriz nunca repetem arquivo nem deixam um de fora) sem tabela que
 * envelhece. Para N fatias, cada uma fica com `ceil`/`floor(n/N)` arquivos.
 * Exemplo: shardFiles(['a','b','c','d','e'],{index:2,count:2}) → ['b','d'].
 * @param {string[]} files @param {{index:number,count:number}|null} shard
 * @returns {string[]} */
export function shardFiles(files,shard){
 if(!shard)return files;
 const {index,count}=shard;
 if(!Number.isInteger(index)||!Number.isInteger(count)||index<1||count<1||index>count){
  throw new Error(`--shard: esperava 1 <= I <= N, recebi "${index}/${count}"`);
 }
 return files.filter((_,position)=>position%count===index-1);
}
