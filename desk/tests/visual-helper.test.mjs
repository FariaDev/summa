import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ensureVisualHelper} from '../scripts/visual-helper.mjs';

function cloneWithoutHelper(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-visual-helper-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'visual-check'));
 return root;
}

test('instalar em clone sem helper compila o helper do Conferir no macOS',t=>{
 const root=cloneWithoutHelper(t);
 const calls=[];
 const result=ensureVisualHelper({root,platform:'darwin',compile:(source,output)=>{
  calls.push([source,output]);
  fs.writeFileSync(output,'binário');
  return {status:0};
 }});
 assert.equal(result,'compiled');
 assert.deepEqual(calls,[[path.join(root,'visual-check','windows.swift'),path.join(root,'visual-check','windows')]]);
});

test('helper já compilado não recompila',t=>{
 const root=cloneWithoutHelper(t);
 fs.writeFileSync(path.join(root,'visual-check','windows'),'binário');
 const result=ensureVisualHelper({root,platform:'darwin',compile:()=>assert.fail('não deveria compilar')});
 assert.equal(result,'present');
});

test('fonte mais novo recompila o helper da instalação anterior',t=>{
 const root=cloneWithoutHelper(t);
 const helper=path.join(root,'visual-check','windows');
 const source=path.join(root,'visual-check','windows.swift');
 const old=new Date('2020-01-01T00:00:00Z');
 fs.writeFileSync(helper,'binário antigo');
 fs.utimesSync(helper,old,old);
 fs.writeFileSync(source,'fonte atualizado');
 const result=ensureVisualHelper({root,platform:'darwin',compile:(_source,output)=>{
  fs.writeFileSync(output,'binário novo');
  return {status:0};
 }});
 assert.equal(result,'compiled');
 assert.equal(fs.readFileSync(helper,'utf8'),'binário novo');
});

test('npm start recompila o helper antigo antes de abrir o Electron no macOS',{skip:process.platform!=='darwin'},t=>{
 const root=cloneWithoutHelper(t);
 const desk=path.join(root,'desk');
 const helper=path.join(root,'visual-check','windows');
 const manifest=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 fs.mkdirSync(path.join(desk,'scripts'),{recursive:true});
 fs.copyFileSync(new URL('../scripts/visual-helper.mjs',import.meta.url),path.join(desk,'scripts','visual-helper.mjs'));
 fs.writeFileSync(path.join(desk,'package.json'),JSON.stringify({...manifest,scripts:{...manifest.scripts,start:'node check-helper.cjs'}}));
 fs.writeFileSync(path.join(desk,'check-helper.cjs'),`require('node:assert/strict').equal(require('node:fs').readFileSync('../visual-check/windows','utf8'),'fonte atualizado');`);
 fs.writeFileSync(path.join(desk,'swiftc'),'#!/bin/sh\ncp "$1" "$3"\n',{mode:0o755});
 fs.writeFileSync(helper,'binário antigo');
 fs.utimesSync(helper,new Date(0),new Date(0));
 fs.writeFileSync(path.join(root,'visual-check','windows.swift'),'fonte atualizado');
 const run=spawnSync('npm',['start'],{cwd:desk,env:{...process.env,PATH:`${desk}${path.delimiter}${process.env.PATH}`},encoding:'utf8',timeout:15000});
 assert.equal(run.status,0,run.error?.message??run.stdout+run.stderr);
});

test('sem swiftc a instalação recebe "failed" em vez de exceção',t=>{
 const root=cloneWithoutHelper(t);
 assert.equal(ensureVisualHelper({root,platform:'darwin',compile:()=>({status:null})}),'failed');
});

test('compilador que sai com 0 sem gerar o binário conta como falha',t=>{
 const root=cloneWithoutHelper(t);
 assert.equal(ensureVisualHelper({root,platform:'darwin',compile:()=>({status:0})}),'failed');
});

test('fora do macOS não compila nada',t=>{
 const root=cloneWithoutHelper(t);
 assert.equal(ensureVisualHelper({root,platform:'linux',compile:()=>assert.fail('não deveria compilar')}),'not-mac');
});
