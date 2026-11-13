/* Fatias do corredor (`--shard I/N`): cobertura completa, sem repetição e
   `1/1` igual à rodada inteira. A divisão precisa ser a mesma em toda máquina,
   senão dois jobs da matriz rodariam o mesmo arquivo e outro ficaria de fora. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseShard,shardFiles} from './suite-files.mjs';

const files=Array.from({length:19},(_,i)=>`teste-${String(i).padStart(2,'0')}-ui.mjs`);

test('as fatias juntas cobrem a lista exatamente uma vez',()=>{
 const fatias=[1,2,3,4].map(index=>shardFiles(files,{index,count:4}));
 assert.deepEqual(fatias.flat().sort(),files);
 assert.equal(new Set(fatias.flat()).size,files.length);
});

test('--shard 1/1 é a lista inteira, como sem shard',()=>{
 assert.deepEqual(shardFiles(files,parseShard('1/1')),files);
 assert.deepEqual(shardFiles(files,null),files);
 assert.equal(parseShard(null),null);
});

test('a divisão é round-robin determinístico na ordem recebida',()=>{
 const shard=parseShard('2/2');
 assert.deepEqual(shardFiles(['a','b','c','d','e'],shard),['b','d']);
 assert.deepEqual(shardFiles(['a','b','c','d','e'],shard),['b','d']);
 const counts=[1,2,3,4].map(index=>shardFiles(files,{index,count:4}).length);
 assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
});

test('--shard recusa formato e faixa que não cobrem a lista',()=>{
 for(const value of ['2','dois','1/2/3','0/4','5/4','2/0']){
  assert.throws(()=>parseShard(value),/--shard: esperava/,`aceitou "${value}"`);
 }
 assert.throws(()=>shardFiles(files,{index:0,count:4}),/--shard: esperava/);
});
