import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = name => fs.readFileSync(new URL(`../scripts/${name}`, import.meta.url), 'utf8');

test('o mutex por usuario precede qualquer mutacao e recusa a segunda instalacao', () => {
  const nsi = script('summa.nsi');
  const init = nsi.slice(nsi.indexOf('Function .onInit'), nsi.indexOf('FunctionEnd', nsi.indexOf('Function .onInit')));
  assert.match(init, /CreateMutexW/);
  assert.match(init, /Local\\Summa/);
  assert.match(init, /SetErrorLevel 3/);
  assert.match(init, /Quit/);
  assert.doesNotMatch(init.slice(0, init.indexOf('CreateMutexW')), /RecoverInterruptedSwap|RMDir|Delete|File \/r/);
});

test('a origem do clone so e preservada quando a copia termina sem erro', () => {
  const nsi = script('summa.nsi');
  const keep = nsi.slice(nsi.indexOf('Function KeepCloneOrigin'), nsi.indexOf('FunctionEnd', nsi.indexOf('Function KeepCloneOrigin')));
  assert.match(keep, /ClearErrors/);
  assert.match(keep, /IfErrors.*cloneCopyFailed/);
  assert.match(keep, /cloneCopyFailed:[\s\S]*Call FailInstall/);
  const section = nsi.slice(nsi.indexOf('Section "Summa"'));
  assert.ok(section.indexOf('Call KeepCloneOrigin') < section.indexOf('Call SignalReady'));
  assert.ok(section.indexOf('Call KeepCloneOrigin') < section.indexOf('Call SwapInstall'));
});

test('smoke recusa estado existente antes de escrever e limita esperas', () => {
  const smoke = script('installer-smoke.ps1');
  assert.ok(smoke.indexOf('\nAssert-CleanAccount\n') > 0);
  assert.ok(smoke.indexOf('\nAssert-CleanAccount\n') < smoke.indexOf('New-Item'));
  assert.match(smoke, /function Assert-CleanAccount[\s\S]*\$dir[\s\S]*\$key[\s\S]*\$shortcut/);
  assert.match(smoke, /finally\s*\{/);
  assert.doesNotMatch(smoke, /-PassThru -Wait|\.WaitForExit\(\)/);
});

test('o build amarra a identidade do instalador ao commit', () => {
  assert.match(script('summa.nsi'), /VIAddVersionKey.*"SummaCommit".*"\$\{COMMIT\}"/);
  assert.match(script('build-windows-installer.mjs'), /-DCOMMIT=/);
});
