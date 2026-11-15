/* #85: o app instalado guarda sessões, estado e o OpenCode no runtime do
   clone. O fim do `npm run install-app` precisa dizer o caminho real e que a
   pasta do clone não pode ser apagada nem movida. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeKeepNotice} from '../scripts/runtime-notice.mjs';

test('#85 o aviso mostra o runtime real e manda não apagar nem mover o clone', () => {
  const line = runtimeKeepNotice('/home/ana/summa/desk/.runtime','/home/ana/summa');
  assert.ok(line.includes('/home/ana/summa/desk/.runtime'), line);
  assert.match(line, /sessões, estado e OpenCode/i);
  assert.match(line, /não apague nem mova a pasta do clone/i);
  assert.ok(!line.includes('\n'), 'o aviso é uma linha só');
});

test('#85 runtime fora do clone mostra só o caminho, sem o aviso falso', () => {
  const line = runtimeKeepNotice('/home/ana/dados/runtime', '/home/ana/summa');
  assert.equal(line, 'Runtime do app: /home/ana/dados/runtime.');
  assert.equal(runtimeKeepNotice('/home/ana/summa-velho/desk/.runtime', '/home/ana/summa'), 'Runtime do app: /home/ana/summa-velho/desk/.runtime.', 'pasta irmã com prefixo igual não conta como dentro');
});
