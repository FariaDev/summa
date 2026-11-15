/* #85: o app instalado guarda sessões, estado e o OpenCode no runtime do
   clone. O fim do `npm run install-app` precisa dizer o caminho real e que a
   pasta do clone não pode ser apagada nem movida. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeKeepNotice} from '../scripts/runtime-notice.mjs';

test('#85 o aviso mostra o runtime real e manda não apagar nem mover o clone', () => {
  const line = runtimeKeepNotice('/home/ana/summa/desk/.runtime');
  assert.ok(line.includes('/home/ana/summa/desk/.runtime'), line);
  assert.match(line, /sessões, estado e OpenCode/i);
  assert.match(line, /não apague nem mova a pasta do clone/i);
  assert.ok(!line.includes('\n'), 'o aviso é uma linha só');
});
