// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

/* Checagens do `npm run doctor`, numa fonte só para o próprio doctor
   (`scripts/doctor.mjs`, que só imprime) e para o "Relatar um problema" (#62),
   que mostra o resultado no relatório limpo. Mora em `desk/` (e não em
   `scripts/`) porque o app instalado também roda a triagem e o pacote só leva
   os módulos da raiz de `desk/`. */

const require=createRequire(import.meta.url);
const {readConfig,seedConfig}=require('./config.cjs');
const {userDataDirectory}=require('./user-data.cjs');
const {mergeCourses,courseLibrary}=require('./courses.cjs');
const {detectTutorEngines,engineNames,defaultEngineFrom,ENGINE_NAMES}=require('./tutor-default-engine.cjs');
const {visibleEngines}=require('./visible-engines.cjs');
const desk=path.dirname(fileURLToPath(import.meta.url));
/* #84: o doctor dizia "Node 20+" depois que o engines subiu; o major vem do
   mesmo `engines.node` que o setup e o README citam. */
const nodeFloor=Number(JSON.parse(fs.readFileSync(path.join(desk,'package.json'),'utf8')).engines.node.replace(/[^0-9.]/g,'').split('.')[0]);
const repo=path.dirname(desk);

/** @typedef {{name: string, ok: boolean, pending?: boolean, detail: string}} DoctorRow */
/** @typedef {{config: any, configPath: string, runtime: string, vault: string, courses: Array<{id: string, name: string, path: string}>}} DoctorContext */

/**
 * Onde a Mesa guarda config e runtime, no mesmo diretório de dados do app.
 * @param {{env?: NodeJS.ProcessEnv, home?: string, platform?: NodeJS.Platform}} [options]
 * @returns {DoctorContext}
 * @example doctorContext().runtime // '~/Library/Application Support/Mesa de Estudos/runtime'
 */
export function doctorContext({env=process.env,home=os.homedir(),platform=process.platform}={}){
 const configDir=userDataDirectory({platform,home,env});
 const configPath=path.join(configDir,'config.json');
 const config=readConfig(configPath)||seedConfig({runtimePath:env.LEARNING_DESK_RUNTIME||''});
 if(env.LEARNING_VAULT)config.vaultPath=env.LEARNING_VAULT;
 const runtime=env.LEARNING_DESK_RUNTIME||config.runtimePath||path.join(path.dirname(configPath),'runtime');
 return {config,configPath,runtime,vault:config.vaultPath||'',courses:mergeCourses(config)};
}

/** @param {DoctorRow[]} rows @param {NodeJS.ProcessEnv} env @param {any} config @param {string} home @param {string} runtime */
function checkSetup(rows,env,config,home,runtime){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 const [nodeMajor]=process.versions.node.split('.').map(Number);
 /* Node só é exigência do setup a partir do código; o app e o MCP rodam no
    Node do Electron (#93). */
 check(`Node ${nodeFloor}+ (setup a partir do código)`,nodeMajor>=nodeFloor,process.version);
 const dependenciesReady=fs.existsSync(path.join(desk,'node_modules','electron'));
 check('Dependências da Mesa',dependenciesReady,dependenciesReady?'instaladas':'rode npm ci');
 const all=detectTutorEngines({config,deskDir:desk,runtime,env,home,testMode:false});
 const shown=visibleEngines({testMode:false,env});
 const engines=Object.fromEntries(Object.entries(all).filter(([id])=>shown.includes(id)));
 const labels=engineNames(engines);
 check('Tutor instalado',labels.length>0,labels.length?`${labels.join(', ')} (padrão: ${ENGINE_NAMES[defaultEngineFrom(engines)]})`:'instale o OpenCode na primeira abertura (ou use o Claude Code que já existe)');
}

/** @param {DoctorRow[]} rows @param {DoctorContext} context */
function checkVault(rows,{vault,courses,runtime,config}){
 /* Primeira abertura pendente (#89): sem vault configurado e sem matéria na
    config. Vault, políticas e matérias só nascem quando o app abre, então
    antes disso são pendentes, não falha; um vault configurado que sumiu
    continua sendo ✗. */
 const firstRun=!vault&&!(config?.courses||[]).length;
 const pendingDetail='abra o app e crie a matéria';
 const check=(name,ok,detail,pending=false)=>rows.push(pending?{name,ok:!!ok,pending:true,detail:String(detail??'')}:{name,ok:!!ok,detail:String(detail??'')});
 check('Vault / pasta de dados',vault&&fs.existsSync(vault),vault||(firstRun?pendingDetail:'não configurado'),firstRun);
 for(const name of ['TUTOR.md','LEARNER.md'])check(`Política ${name}`,vault&&fs.existsSync(path.join(vault,name)),vault?path.join(vault,name):firstRun?pendingDetail:'vault não configurado',firstRun);
 check('Capturador visual',process.platform!=='darwin'||fs.existsSync(path.join(repo,'visual-check','windows')),process.platform==='darwin'?path.join(repo,'visual-check','windows'):'não se aplica neste sistema');
 check('Matérias configuradas',courses.length>0,courses.length?`${courses.length} encontrada(s)`:firstRun?pendingDetail:'0 encontrada(s)',firstRun);
 for(const course of courses){
  const sourceCount=courseLibrary(course.path).length;
  check(`Fontes · ${course.name}`,sourceCount>0,`${sourceCount} PDF(s) acessível(is)`);
 }
 let persistence=false,why=runtime;
 try{fs.mkdirSync(runtime,{recursive:true});const probe=path.join(runtime,`.doctor-${process.pid}`);fs.writeFileSync(probe,'ok');fs.unlinkSync(probe);persistence=true;}catch(e){why=e.message;}
 check('Persistência da Mesa',persistence,why);
}

/* --- Ambiente: o temporário e o git que o updater e o verify usam --- */
/** @param {DoctorRow[]} rows @param {DoctorContext} _context @param {NodeJS.ProcessEnv} env */
function checkProfile(rows,_context,env){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 let tempOk=false,tempWhy=os.tmpdir();
 try{const probe=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-doctor-')),'.probe');fs.writeFileSync(probe,'ok');fs.rmSync(path.dirname(probe),{recursive:true,force:true});tempOk=true;}catch(e){tempWhy=e.message;}
 check('Diretório temporário gravável',tempOk,tempWhy);
 const PATH_DIRS=(env.PATH||'').split(path.delimiter).filter(Boolean);
 const GIT_NAMES=process.platform==='win32'?['git.exe','git.cmd','git']:['git'];
 const git=PATH_DIRS.flatMap(dir=>GIT_NAMES.map(name=>path.join(dir,name))).find(p=>{try{return fs.existsSync(p);}catch{return false;}});
 check('Executável git',git,git||'não encontrado no PATH — o updater por git e o verify o usam');
}

/**
 * Roda todas as checagens do doctor e devolve as linhas, sem imprimir.
 * @param {{env?: NodeJS.ProcessEnv, home?: string}} [options]
 * @returns {{rows: DoctorRow[], context: DoctorContext}}
 * @example const {rows}=doctorChecks(); rows.filter(r=>!r.ok).length // 0 com o setup pronto
 */
export function doctorChecks({env=process.env,home=os.homedir()}={}){
 const context=doctorContext({env,home});
 /** @type {DoctorRow[]} */
 const rows=[];
 checkSetup(rows,env,context.config,home,context.runtime);
 checkVault(rows,context);
 checkProfile(rows,context,env);
 return {rows,context};
}

/**
 * As linhas no formato que o `npm run doctor` sempre imprimiu; pendente da
 * primeira abertura sai com `…` e não entra na conta (#89).
 * @param {DoctorRow[]} rows
 * @returns {string}
 * @example doctorText([{name:'Node 22+ (setup a partir do código)',ok:true,detail:'v22.19.0'}]) // '✓ Node 22+ (setup a partir do código): v22.19.0\n\nSetup learning pronto.'
 */
export function doctorText(rows){
 const lines=rows.map(row=>`${row.ok?'✓':row.pending?'…':'✗'} ${row.name}: ${row.detail}`);
 const failed=rows.filter(r=>!r.ok&&!r.pending);
 return `${lines.join('\n')}\n\n${failed.length?`${failed.length} verificação(ões) precisa(m) de atenção.`:'Setup learning pronto.'}`;
}

/**
 * O código de saída do `npm run doctor`. Pendente da primeira abertura não é
 * falha (#89).
 * @param {DoctorRow[]} rows
 * @returns {number} 1 quando alguma verificação falhou; 0 quando está tudo certo
 * @example doctorExitCode([{name:'Matérias configuradas',ok:false,pending:true,detail:'abra o app e crie a matéria'}]) // 0
 */
export function doctorExitCode(rows){
 return rows.some(row=>!row.ok&&!row.pending)?1:0;
}
