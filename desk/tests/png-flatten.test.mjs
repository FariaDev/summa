/* O achatamento do PNG do Ambitus sobre branco (#105): o PNG da página chega
   com o fundo transparente preto, e o modelo que lê a tinta descarta o alpha e
   vê a página inteira preta. Os PNGs deste teste são gerados aqui com o
   `node:zlib`; nenhum binário novo entra no repositório. */
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {decodePng, pixelAt} from './png-pixels.mjs';

const require = createRequire(import.meta.url);
const {flattenPng} = require('../png-flatten.cjs');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Um pedaço do PNG: tamanho + tipo + dados + CRC. @param {string} type @param {Buffer} data */
function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(data, zlib.crc32(Buffer.from(type, 'latin1'))) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** O filtro de linha da codificação (o mesmo que o decodificador desfaz). */
function filterRow(filter, line, above, channels) {
  const out = Buffer.alloc(line.length);
  for (let index = 0; index < line.length; index += 1) {
    const left = index >= channels ? line[index - channels] : 0;
    const up = above ? above[index] : 0;
    const upLeft = above && index >= channels ? above[index - channels] : 0;
    const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upLeft)][filter];
    out[index] = (line[index] - predictor) & 0xff;
  }
  return out;
}

/**
 * Gera o PNG de teste com pixels crus e um filtro por linha.
 * @param {number} width @param {number} height @param {Buffer} pixels
 * @param {{filters?: number[], colorType?: number, bitDepth?: number, interlace?: number, extra?: Buffer[]}} [options]
 * @returns {Buffer}
 */
function testPng(width, height, pixels, {filters = [], colorType = 6, bitDepth = 8, interlace = 0, extra = []} = {}) {
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let row = 0; row < height; row += 1) {
    const line = pixels.subarray(row * stride, (row + 1) * stride);
    const above = row > 0 ? pixels.subarray((row - 1) * stride, row * stride) : null;
    const filter = filters[row] || 0;
    raw[row * (stride + 1)] = filter;
    filterRow(filter, line, above, channels).copy(raw, row * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[12] = interlace;
  return Buffer.concat([SIGNATURE, pngChunk('IHDR', ihdr), ...extra, pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function pixel(png, x, y) {
  return {...pixelAt(decodePng(png.toString('base64')), x, y)};
}

test('RGBA com fundo transparente sai branco e a tinta preta continua preta (#105)', () => {
  const width = 4;
  const height = 4;
  const pixels = Buffer.alloc(width * height * 4);
  const ink = (1 * width + 1) * 4;
  pixels[ink + 3] = 255;
  const flat = flattenPng(testPng(width, height, pixels));
  assert.deepEqual(pixel(flat, 0, 0), {r: 255, g: 255, b: 255, a: 255}, 'o canto transparente sai branco');
  assert.deepEqual(pixel(flat, 1, 1), {r: 0, g: 0, b: 0, a: 255}, 'a tinta preta opaca não muda');
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) assert.equal(pixel(flat, x, y).a, 255, `o pixel (${x},${y}) sai opaco`);
  }
});

test('alpha parcial compõe com branco na proporção do alpha (#105)', () => {
  const pixels = Buffer.from([255, 0, 0, 128, 0, 0, 255, 64]);
  const flat = flattenPng(testPng(2, 1, pixels));
  assert.deepEqual(pixel(flat, 0, 0), {r: 255, g: 127, b: 127, a: 255}, 'vermelho a 50% sobre branco');
  assert.deepEqual(pixel(flat, 1, 0), {r: 191, g: 191, b: 255, a: 255}, 'azul a 25% sobre branco');
});

test('PNG RGB já opaco não muda de pixels e volta o mesmo arquivo (#105)', () => {
  const pixels = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  const png = testPng(2, 2, pixels, {colorType: 2});
  const flat = flattenPng(png);
  assert.strictEqual(flat, png, 'sem transparência, o original serve');
  assert.deepEqual(pixel(flat, 0, 0), {r: 10, g: 20, b: 30, a: 255});
  assert.deepEqual(pixel(flat, 1, 1), {r: 100, g: 110, b: 120, a: 255});
});

test('PNG fora de 8 bits RGB/RGBA volta igual e loga uma linha (#105)', () => {
  const logs = [];
  const palette = testPng(1, 1, Buffer.from([0]), {colorType: 3, extra: [pngChunk('PLTE', Buffer.from([0, 0, 0, 255, 255, 255]))]});
  const sixteen = testPng(1, 1, Buffer.alloc(6), {colorType: 2, bitDepth: 16});
  const interlaced = testPng(1, 1, Buffer.from([0, 0, 0, 255]), {colorType: 6, interlace: 1});
  const gray = testPng(1, 1, Buffer.from([0]), {colorType: 0});
  for (const [name, png] of [['paleta', palette], ['16 bits', sixteen], ['entrelaçado', interlaced], ['cinza', gray]]) {
    const before = logs.length;
    assert.strictEqual(flattenPng(png, (line) => logs.push(line)), png, `${name} volta o original`);
    assert.equal(logs.length, before + 1, `uma linha de log para ${name}`);
  }
});

test('os cinco filtros de linha decodificam para os mesmos pixels (#105)', () => {
  const width = 3;
  const height = 5;
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = index * 11;
    pixels[index * 4 + 1] = index * 7;
    pixels[index * 4 + 2] = index * 5;
    pixels[index * 4 + 3] = 255;
  }
  pixels[pixels.length - 1] = 0;
  const mixed = (x, y) => {
    const at = (y * width + x) * 4;
    const alpha = pixels[at + 3] / 255;
    return {r: Math.round(pixels[at] * alpha + 255 * (1 - alpha)), g: Math.round(pixels[at + 1] * alpha + 255 * (1 - alpha)), b: Math.round(pixels[at + 2] * alpha + 255 * (1 - alpha))};
  };
  for (let filter = 0; filter <= 4; filter += 1) {
    const flat = flattenPng(testPng(width, height, pixels, {filters: Array(height).fill(filter)}));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const {r, g, b} = mixed(x, y);
        assert.deepEqual(pixel(flat, x, y), {r, g, b, a: 255}, `filtro ${filter}, pixel (${x},${y})`);
      }
    }
  }
});
