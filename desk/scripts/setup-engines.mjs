import path from 'node:path';
import {createRequire} from 'node:module';
import {userDataDirectory} from '../user-data.cjs';

/* Motores que o `npm run setup` relata (#137). O setup roda em Node puro:
   lê o `config.json` do MESMO diretório de dados que o app usa — inclusive o
   `opencodePath` escolhido nas Configurações (#102) — sem abrir Electron.
   Config ausente ou inválida não derruba o setup: `readConfig` devolve null e
   a detecção segue com os instaladores usuais. */

const require=createRequire(import.meta.url);
const {readConfig}=require('../config.cjs');
const {detectTutorEngines,engineNames,defaultEngineFrom,ENGINE_NAMES}=require('../tutor-default-engine.cjs');
const {filterDetected}=require('../visible-engines.cjs');

/**
 * Config da pessoa e motores que o setup deve anunciar.
 * @param {{configDir?: string, env?: NodeJS.ProcessEnv, home?: string, platform?: NodeJS.Platform, deskDir?: string}} [options]
 * @returns {{config: import('../types/desk-config').DeskConfig | null, engines: {claude: string, opencode: string, opencodeOld?: string},
 *   engineLabels: string[], preferredEngine: 'claude' | 'opencode', preferredLabel: string}}
 * @example setupTutorEngines({configDir: '/tmp/dados'}).engineLabels // ['OpenCode']
 */
export function setupTutorEngines({configDir,env=process.env,home,platform=process.platform,deskDir}={}){
 const dir=configDir||userDataDirectory({platform,...(home?{home}:{}),env});
 const config=readConfig(path.join(dir,'config.json'));
 const detected=detectTutorEngines({config:config||{},deskDir,env,platform,...(home?{home}:{}),testMode:false});
 const engines=filterDetected(detected,{testMode:false,env});
 const preferredEngine=defaultEngineFrom(engines);
 return {config,engines,engineLabels:engineNames(engines),preferredEngine,preferredLabel:ENGINE_NAMES[preferredEngine]};
}
