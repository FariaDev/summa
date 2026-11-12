'use strict';
const path=require('node:path');
const os=require('node:os');

/* #190: o app virou Summa, mas a pasta de dados continua a antiga — sem
   migração, quem já tem matérias e sessões abre o app com tudo no lugar. */
const LEGACY_DATA_FOLDER='Mesa de Estudos';

/* Localização da pasta de dados, com o override de testes.
   Os diagnósticos Node usam o mesmo diretório. */
function userDataDirectory({platform=process.platform,home=os.homedir(),env=process.env}={}){
 if(env.LEARNING_DESK_RUNTIME)return env.LEARNING_DESK_RUNTIME;
 const base=platform==='win32'?(env.APPDATA||path.join(home,'AppData','Roaming'))
  :platform==='darwin'?path.join(home,'Library','Application Support')
  :(env.XDG_CONFIG_HOME||path.join(home,'.config'));
 return path.join(base,LEGACY_DATA_FOLDER);
}
/**
 * A pasta de dados que o app usa (#190): a antiga, salvo quando alguém já fixou
 * outra com `app.setPath('userData', …)` (o harness dos testes, #137).
 * @param {{getPath: (name: string) => string, getName: () => string}} app o `app` do Electron
 * @returns {string}
 * @example electronUserData(app) // '~/Library/Application Support/Mesa de Estudos' no Mac
 */
function electronUserData(app){
 const current=app.getPath('userData');
 const derived=path.join(app.getPath('appData'),app.getName());
 return current===derived?path.join(app.getPath('appData'),LEGACY_DATA_FOLDER):current;
}
module.exports={userDataDirectory,electronUserData,LEGACY_DATA_FOLDER};
