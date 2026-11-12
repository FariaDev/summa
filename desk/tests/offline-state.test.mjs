/* Estado de rede do renderer (#142): a regra é pequena, mas é ela que decide
   quando o aviso nasce e quando some. O teste injeta a fonte do estado, sem
   DOM nem Electron; a janela cobre a aplicação no indicador e no Sobre. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfflineWatch} from '../src/offline-state.mjs';

test('a virada avisa uma vez e não repete sem transição', () => {
  let online = true;
  const watch = createOfflineWatch({isOnline: () => online});
  const seen = [];
  watch.onChange((offline) => seen.push(offline));
  assert.equal(watch.isOffline(), false, 'começa online');
  assert.equal(watch.sync(), false, 'sem mudança, sync não avisa');
  online = false;
  assert.equal(watch.sync(), true, 'cair a rede é uma transição');
  assert.equal(watch.isOffline(), true);
  assert.deepEqual(seen, [true], 'avisa uma vez');
  assert.equal(watch.sync(), false, 'offline de novo não é transição');
  assert.deepEqual(seen, [true], 'sem anúncio em loop');
  online = true;
  assert.equal(watch.sync(), true, 'voltar a rede é uma transição');
  assert.equal(watch.isOffline(), false);
  assert.deepEqual(seen, [true, false], 'o aviso some sozinho');
});

test('nascer sem rede já é offline', () => {
  const watch = createOfflineWatch({isOnline: () => false});
  assert.equal(watch.isOffline(), true);
});

test('quem desassina não recebe mais a virada', () => {
  let online = true;
  const watch = createOfflineWatch({isOnline: () => online});
  let calls = 0;
  const off = watch.onChange(() => { calls += 1; });
  off();
  online = false;
  watch.sync();
  assert.equal(calls, 0);
});
