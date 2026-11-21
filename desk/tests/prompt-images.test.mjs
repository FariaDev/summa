// Imagens do tutor que saíram do main.cjs (#43 fase 2). O nativeImage é um
// fake com nome: devolve imagem vazia, então nada é encolhido.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {PLOT_PNG} from './helpers.mjs';

const require = createRequire(import.meta.url);
const {createPromptImages} = require('../prompt-images.cjs');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-images-'));
after(() => fs.rmSync(runtime, {recursive: true, force: true}));
const learningRoot = path.join(runtime, 'learning');
fs.mkdirSync(learningRoot, {recursive: true});
const emptyNativeImage = {createFromBuffer: () => ({isEmpty: () => true})};
const images = createPromptImages({live: {}, runtime, deskDir: path.resolve(import.meta.dirname, '..'), learningRoot, nativeImage: emptyNativeImage});

test('promptImages manda PNG válido como bloco base64 e recusa tipo que não é imagem', () => {
  const [block] = images.promptImages([`data:image/png;base64,${PLOT_PNG}`]);
  assert.deepEqual(block, {type: 'image', data: PLOT_PNG, mimeType: 'image/png'});
  assert.throws(() => images.promptImages(['data:text/plain;base64,aGk=']));
  assert.deepEqual(images.promptImages([]), []);
});

test('readableImage só lê dentro de learning/ e com extensão de imagem', () => {
  const inside = path.join(learningRoot, 'fig.png');
  fs.writeFileSync(inside, Buffer.from(PLOT_PNG, 'base64'));
  fs.writeFileSync(path.join(runtime, 'fora.png'), 'x');
  assert.equal(images.readableImage(inside)?.mime, 'image/png');
  assert.equal(images.readableImage(path.join(runtime, 'fora.png')), null);
});

test('readableImage preserves hash and percent filenames in paths and encoded file URLs', () => {
  for (const name of ['Aula #3.png', '100%25.png']) {
    const file = path.join(learningRoot, name);
    fs.writeFileSync(file, Buffer.from(PLOT_PNG, 'base64'));
    const inputs = process.platform === 'win32' ? [file] : [file, `${pathToFileURL(file)}?download=1#preview`];
    for (const input of inputs) {
      assert.equal(images.readableImage(input)?.file, fs.realpathSync(file));
      assert.deepEqual(images.readableImage(input)?.bytes, Buffer.from(PLOT_PNG, 'base64'));
    }
  }
});

test('trimMessageImages mantém as últimas N mensagens com imagem e tira as antigas', () => {
  const withImage = () => ({content: [{type: 'text', text: 'a'}, {type: 'image'}]});
  const list = [withImage(), withImage(), withImage()];
  const shown = images.trimMessageImages(list, 2);
  assert.deepEqual(shown.map((m) => m.content.length), [1, 2, 2]);
  assert.notEqual(shown, list, 'a tela recebe uma lista nova');
  assert.notEqual(shown[0], list[0], 'a mensagem cortada é uma cópia');
  assert.deepEqual(list.map((m) => m.content.length), [2, 2, 2], 'a entrada fica intacta');
});
