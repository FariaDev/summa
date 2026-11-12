import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {freePrompt, opencodeCommand, shellQuote} from '../triage-outputs.mjs';
import {trackTempDir} from './temp-dir.mjs';

/* O comando do "Relatar um problema" no Windows (#138). O relato sai da linha
   de comando (base64 num arquivo temporário, entregue no stdin) para o
   PowerShell 5.1 não corromper as aspas ao chamar um executável nativo e para
   a colagem não quebrar em várias linhas. O teste roda o comando de verdade
   no `powershell.exe` (5.1) e no `pwsh` quando existe; o OpenCode é um Node
   falso carregado por `--require` (`fixtures/fake-opencode-echo.cjs`), que
   grava os argumentos e o stdin recebidos. A forma antiga (relato como
   argumento) roda junto para provar que ela não entrega o relato pelo stdin.
   O caso do `opencode` do PATH usa um `opencode.cmd` de mentira (#138). O npm
   instala `opencode.cmd` e `opencode.ps1` lado a lado, e o PowerShell procura
   `.ps1` antes de qualquer extensão do PATHEXT: o `Start-Process` resolvia o
   `.ps1` e o CreateProcess não o executava, então o comando regredia para
   quem instala o OpenCode por npm. O pipe com `&` devolve o `.ps1` ao motor do
   PowerShell, que repassa o stdin como o shim do npm. */

const skip=process.platform==='win32'?false:'o `powershell.exe` só existe no Windows';

/** @returns {boolean} */
function hasPwsh(){
 return spawnSync('where.exe',['pwsh'],{encoding:'utf8'}).status===0;
}

test('o comando do PowerShell entrega o relato pelo stdin, byte a byte (#138)',{skip},()=>{
 const report=[
  '## O que aconteceu',
  'linha 1 com "aspas duplas" e \'aspas simples\'',
  'linha 2 com $HOME, $env:TEMP e $(Get-Date); crase `id`; ponto e vírgula;',
  'acentos: ação, coração, ç, ã, é — travessão e barra C:\\Users\\ana\\x',
  'linha 5 com %PATH%, || e && no fim',
 ].join('\n');
 const sandbox=trackTempDir(mkdtempSync(join(tmpdir(),'mesa-triage-ps-')));
 const preload=fileURLToPath(new URL('./fixtures/fake-opencode-echo.cjs',import.meta.url)).replace(/\\/g,'/');
 const launcher=`& ${shellQuote(process.execPath,'win32')}`;
 const facts={opencode:true,freeModel:{model:'opencode/x-free',policyKey:'k'}};
 const command=opencodeCommand({...facts,opencodeLauncher:launcher},report,'win32').command||'';
 const pathCommand=opencodeCommand({...facts,opencodeLauncher:'opencode'},report,'win32').command||'';
 const payloadOf=line=>{
  const encoded=/FromBase64String\('([A-Za-z0-9+/=]+)'\)/.exec(line)?.[1];
  return encoded?Buffer.from(encoded,'base64').toString('utf8'):'';
 };
 const prompt=payloadOf(command);
 const pathPrompt=payloadOf(pathCommand);
 const shimDir=join(sandbox,'shim');
 mkdirSync(shimDir);
 /* O shim do `opencode.cmd` que o npm instala: chama o Node (o fake vem no
    NODE_OPTIONS), repassa os argumentos e deixa o stdin herdado (#138). */
 const nodeShim=`@echo off\r\n"%MESA_FAKE_OPENCODE_NODE%" %*\r\n`;
 writeFileSync(join(shimDir,'opencode.cmd'),nodeShim);
 /* O npm põe os dois shims na mesma pasta; o `.ps1` é o que o PowerShell
    escolhe. O falso repassa o pipe para o Node como o shim do npm. */
 const npmDir=join(sandbox,'npm');
 mkdirSync(npmDir);
 writeFileSync(join(npmDir,'opencode.cmd'),nodeShim);
 writeFileSync(join(npmDir,'opencode.ps1'),[
  '$ret = 0',
  'if ($MyInvocation.ExpectingInput) { $input | & $env:MESA_FAKE_OPENCODE_NODE $args } else { & $env:MESA_FAKE_OPENCODE_NODE $args }',
  '$ret = $LASTEXITCODE',
  'exit $ret',
  '',
 ].join('\r\n'));
 const run=(shell,name,line,prefix='')=>{
  const log=join(sandbox,`${shell}-${name}.json`);
  const env={...process.env,MESA_FAKE_OPENCODE_LOG:log,MESA_FAKE_OPENCODE_NODE:process.execPath,NODE_OPTIONS:`--require "${preload}"`};
  /* Bypass isola o stdin do teste da política de execução da máquina (o
     `.ps1` do npm depende dela); o app já usa o mesmo flag em `capture-win.cjs`. */
  const result=spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',`${prefix}${line}`],{env,encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,`${shell} rodou o comando: ${result.stderr||result.error?.message||''}`);
  try{
   return JSON.parse(readFileSync(log,'utf8'));
  }catch(error){
   assert.fail(`${shell}: o fake gravou ${log}: stdout=${result.stdout} stderr=${result.stderr} (${error.message})`);
  }
 };
 /* O pipe do PowerShell acrescenta uma quebra de linha no fim (#138); o resto
    é o prompt byte a byte, inclusive acentos e as LFs internas. */
 const assertPromptStdin=(shell,name,received,expected)=>{
  assert.equal(received.stdin.replace(/\r?\n$/,''),expected,`${shell}: ${name} entrega o prompt inteiro pelo stdin`);
  assert.match(received.stdin,/\r?\n$/,`${shell}: ${name} termina com a quebra que o pipe acrescenta`);
 };
 const shells=hasPwsh()?['powershell.exe','pwsh']:['powershell.exe'];
 for(const shell of shells){
  /* A forma antiga: o relato ia como argumento e o stdin ficava vazio. É o
     caminho em que o 5.1 perdia as aspas duplas do texto. */
  const legacy=run(shell,'antigo',`${launcher} run --model opencode/x-free ${shellQuote(freePrompt(report),'win32')}`);
  assert.equal(legacy.stdin,'',`${shell}: o comando antigo não entrega o relato pelo stdin`);

  const received=run(shell,'novo',command);
  assert.notEqual(received.stdin,'',`${shell}: o relato chega pelo stdin, não pela linha de comando`);
  assert.ok(prompt,`${shell}: o comando leva o relato em base64`);
  assertPromptStdin(shell,'o lançador com `&`',received,prompt);
  assert.equal(received.stdin.includes(report),true,`${shell}: o relato hostil chega intacto`);
  assert.match(received.stdin,/^Relatório de problema da Summa/);
  assert.match(received.stdin,/\n--- fim do relatório \(id [0-9a-f]{32}\) ---/);
  assert.deepEqual(received.argv,['--model','opencode/x-free'],`${shell}: o relato não vai nos argumentos`);

  /* Só o `opencode.cmd` no PATH: o comando tem que achar e executar o shim com
     o stdin redirecionado (#138). */
  const fromPath=run(shell,'path',pathCommand,`$env:PATH = ${shellQuote(shimDir,'win32')} + ';' + $env:PATH; `);
  assert.notEqual(fromPath.stdin,'',`${shell}: o opencode do PATH recebe o relato pelo stdin`);
  assertPromptStdin(shell,'o opencode do PATH',fromPath,pathPrompt);
  assert.deepEqual(fromPath.argv,['--model','opencode/x-free'],`${shell}: o relato não vai nos argumentos do PATH`);

  /* A pasta do npm (`opencode.cmd` + `opencode.ps1`): o `.ps1` vence a busca e
     o `Start-Process` não o executava; pelo pipe ele repassa o stdin (#138). */
  const fromNpm=run(shell,'npm',pathCommand,`$env:PATH = ${shellQuote(npmDir,'win32')} + ';' + $env:PATH; `);
  assert.notEqual(fromNpm.stdin,'',`${shell}: o opencode do npm recebe o relato pelo stdin`);
  assertPromptStdin(shell,'o opencode do npm',fromNpm,pathPrompt);
  assert.deepEqual(fromNpm.argv,['--model','opencode/x-free'],`${shell}: o relato não vai nos argumentos do npm`);
 }
 assert.doesNotMatch(command,/[\r\n]/,'o comando copiado fica numa linha só');
 assert.doesNotMatch(pathCommand,/[\r\n]/,'o comando do PATH copiado fica numa linha só');
 assert.doesNotMatch(pathCommand,/Start-Process/,'o `opencode` do PATH vai pelo pipe, não pelo Start-Process (#138)');
});
