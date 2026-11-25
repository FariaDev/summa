// O sistema de quem visita decide o botão do começo: instalador ou "Mandar para o computador".
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectOs} from '../src/assets/js/os.js';

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

test('computadores recebem o instalador do próprio sistema', () => {
  assert.equal(detectOs(UA.mac), 'mac');
  assert.equal(detectOs(UA.win), 'win');
  assert.equal(detectOs(UA.linux), 'linux');
  assert.equal(detectOs(''), 'mac');
});

test('celular e tablet não recebem instalador (antes iPhone e Android caíam no .dmg)', () => {
  assert.equal(detectOs(UA.iphone, 5), 'mobile');
  assert.equal(detectOs(UA.android, 5), 'mobile');
  assert.equal(detectOs(UA.androidTablet, 5), 'mobile');
});

test('o iPad se diz Mac: o toque separa um do outro', () => {
  assert.equal(detectOs(UA.mac, 5), 'mobile');
  assert.equal(detectOs(UA.mac, 0), 'mac');
  assert.equal(detectOs(UA.mac, 1), 'mac');
});
