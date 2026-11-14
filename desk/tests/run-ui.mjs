/* Corre os testes de janela (Electron real, runtime sintético) em paralelo
   limitado — o mesmo corredor de `npm run hunts`.

   Uso:
     npm run ui                          # todos, 3 por vez
     npm run ui -- composer              # só os arquivos que casam
     npm run ui -- --jobs 4 --verbose    # mais paralelismo, saída inteira
     npm run ui -- --shard 2/4           # a segunda de quatro fatias

   A lista de arquivos e os motivos de cada exclusão: `tests/suite-files.mjs`. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs,runSuite} from './run-suite.mjs';
import {parseShard,shardFiles,uiFiles} from './suite-files.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2);
const excludeAt=argv.indexOf('--exclude');
const exclude=excludeAt>=0?String(argv.splice(excludeAt,2)[1]||''):'';
/* A fatia vale DEPOIS de `match` e `--exclude`: a matriz do CI manda o passo do
   resto com os mesmos quatro pesados excluídos em toda fatia, e o passo dos
   pesados roda só na fatia 1 (#165). `--shard` sem valor vira '' e parseShard
   recusa com o formato esperado. */
const shardAt=argv.indexOf('--shard');
const shard=parseShard(shardAt>=0?String(argv.splice(shardAt,2)[1]??''):null);
/* Três por vez é o default (#48), medido em três rodadas seguidas por valor, sem
   outra sessão com Electron aberto: 2 por vez ~311 s, 3 por vez ~236 s, 4 por vez
   ~204 s, todas sem falha. O 4 também fechou limpo, mas deixa menos folga para
   quem abre outro programa pesado junto; `--jobs 1` serve para investigar. */
const {jobs,block,timeout,verbose,match}=parseArgs(argv,{jobs:3});

const picked=uiFiles(match,exclude);
const files=shardFiles(picked,shard);
if(!files.length){
 /* Fatia vazia (lista menor que N) não reprova: a cobertura é das fatias juntas. */
 console.log(shard?`fatia ${shard.index}/${shard.count} não tem testes de janela`:`nenhum teste de janela casa com "${match}"`);
 process.exit(shard?0:1);
}
if(shard)console.log(`fatia ${shard.index}/${shard.count}: ${files.length} de ${picked.length} arquivos`);
process.exit(await runSuite({label:'janelas',dir:here,files,jobs,block,timeout,verbose}));
