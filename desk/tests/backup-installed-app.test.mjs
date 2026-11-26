import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {runtimeExclusion}=require('../src/study-data/backup-files.cjs');

/* #196: o registro da troca para o instalador é estado da máquina, como o update.json. */
test('installed-app.json não entra no backup, em nenhuma profundidade',()=>{
 for(const rel of ['installed-app.json','sub/installed-app.json'])assert.ok(runtimeExclusion(rel),`${rel} fica fora`);
 assert.equal(runtimeExclusion('desk.json'),null,'o estado da Mesa continua no backup');
});
