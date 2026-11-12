/* O doctor calculava o diretório de dados com `Library/Application Support`
   fixo, então fora do macOS lia o config de outro lugar. O caminho agora vem
   de `user-data.cjs` (#137), a mesma conta do app e do `npm run setup`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {doctorContext} from '../doctor-checks.mjs';

const require=createRequire(import.meta.url);
const {userDataDirectory}=require('../user-data.cjs');
const home=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-doctor-context-'));

test.after(()=>fs.rmSync(home,{recursive:true,force:true}));

test('doctor lê o config do mesmo data dir da plataforma',()=>{
 const cases=[
  {platform:'linux',env:{XDG_CONFIG_HOME:path.join(home,'xdg')}},
  {platform:'win32',env:{APPDATA:path.join(home,'AppData','Roaming')}},
 ];
 for(const {platform,env} of cases){
  const expected=path.join(userDataDirectory({platform,home,env}),'config.json');
  const context=doctorContext({platform,home,env});
  assert.equal(context.configPath,expected,`${platform}: o doctor usa o data dir da plataforma`);
 }
});

test('o override LEARNING_DESK_RUNTIME vale no doctor em qualquer plataforma',()=>{
 const env={LEARNING_DESK_RUNTIME:path.join(home,'runtime')};
 const context=doctorContext({platform:'linux',home,env});
 assert.equal(context.configPath,path.join(home,'runtime','config.json'));
 assert.equal(context.runtime,path.join(home,'runtime'));
});
