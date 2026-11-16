'use strict';

/* O PNG da página do Ambitus (#105) chega com o fundo transparente preto: num
   visualizador o transparente aparece branco, mas o modelo que lê a tinta
   descarta o alpha e vê a página inteira preta. Aqui o PNG é achatado sobre
   branco antes de qualquer uso na ponte, para o motor, a miniatura e o que
   fica guardado receberem a mesma imagem opaca. Puro, sem Electron: recebe e
   devolve Buffer. */

const zlib = require('node:zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOR_RGB = 2;
const COLOR_RGBA = 6;
/* Mesmo teto de imagem decodificada do host, com folga: uma página de ~1600 px
   em RGBA fica abaixo de 30 MB. Acima disto não é página, e o original volta. */
const MAX_RAW_BYTES = 256 * 1024 * 1024;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/** CRC-32 (IEEE) dos bytes, como o PNG pede no fim de cada pedaço. @param {Buffer} bytes @returns {number} */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Um pedaço do PNG: tamanho + tipo + dados + CRC. @param {string} type @param {Buffer} data @returns {Buffer} */
function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** O IHDR de 13 bytes, ou o motivo de não servir. @param {Buffer} data @returns {{width: number, height: number, bitDepth: number, colorType: number, interlace: number}} */
function readIhdr(data) {
  if (data.length !== 13) throw Error(`IHDR com ${data.length} bytes; esperado 13`);
  return {width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12]};
}

/** Os campos do IHDR e os dados comprimidos; recusa bloco cortado ou PNG sem IEND. @param {Buffer} bytes @returns {{width: number, height: number, bitDepth: number, colorType: number, interlace: number, idat: Buffer[]}} */
function readChunks(bytes) {
  let header = null;
  let ended = false;
  /** @type {Buffer[]} */
  const idat = [];
  for (let at = 8; at + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const end = at + 12 + length;
    if (end > bytes.length) throw Error(`bloco ${type} com ${length} bytes passa do fim`);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') header = readIhdr(data);
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') { ended = true; break; }
    at = end;
  }
  if (!header) throw Error('PNG sem o bloco IHDR');
  if (!idat.length) throw Error('PNG sem o bloco IDAT');
  if (!ended) throw Error('PNG sem o bloco IEND');
  return {...header, idat};
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** Desfaz o filtro de uma linha; os cinco filtros do PNG. @param {number} filter @param {number} value @param {number} index @param {Buffer} out @param {Buffer|null} up @param {number} channels @returns {number} */
function unfilterByte(filter, value, index, out, up, channels) {
  const left = index >= channels ? out[index - channels] : 0;
  const above = up ? up[index] : 0;
  const upLeft = up && index >= channels ? up[index - channels] : 0;
  switch (filter) {
    case 0: return value;
    case 1: return (value + left) & 0xff;
    case 2: return (value + above) & 0xff;
    case 3: return (value + Math.floor((left + above) / 2)) & 0xff;
    case 4: return (value + paeth(left, above, upLeft)) & 0xff;
    default: throw Error(`filtro de linha ${filter}; esperado de 0 a 4`);
  }
}

/** Os pixels crus de um PNG RGB/RGBA de 8 bits sem entrelaçamento. @param {Buffer} raw @param {number} width @param {number} height @param {number} channels @returns {Buffer} */
function unfilter(raw, width, height, channels) {
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let row = 0, at = 0; row < height; row += 1) {
    const filter = raw[at];
    at += 1;
    const line = raw.subarray(at, at + stride);
    at += stride;
    const out = pixels.subarray(row * stride, (row + 1) * stride);
    const up = row > 0 ? pixels.subarray((row - 1) * stride, row * stride) : null;
    for (let index = 0; index < stride; index += 1) out[index] = unfilterByte(filter, line[index], index, out, up, channels);
  }
  return pixels;
}

/** O PNG 8 bits RGB/RGBA já desfiltrado; lança quando o formato não é tratado. @param {Buffer} bytes @returns {{width: number, height: number, colorType: number, pixels: Buffer}} */
function decodePng(bytes) {
  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw Error('não é um PNG');
  const {width, height, bitDepth, colorType, interlace, idat} = readChunks(bytes);
  if (bitDepth !== 8) throw Error(`profundidade ${bitDepth} bits; esperado 8`);
  if (colorType !== COLOR_RGB && colorType !== COLOR_RGBA) throw Error(`tipo de cor ${colorType}; esperado 2 (RGB) ou 6 (RGBA)`);
  if (interlace !== 0) throw Error(`entrelaçamento ${interlace}; esperado 0`);
  const channels = colorType === COLOR_RGBA ? 4 : 3;
  const stride = width * channels;
  const expected = height * (stride + 1);
  if (!width || !height || expected > MAX_RAW_BYTES) throw Error(`dimensões ${width}×${height} fora do teto`);
  const raw = zlib.inflateSync(Buffer.concat(idat), {maxOutputLength: expected});
  if (raw.length !== expected) throw Error(`dados com ${raw.length} bytes; esperado ${expected}`);
  return {width, height, colorType, pixels: unfilter(raw, width, height, channels)};
}

/** Compõe cada pixel RGBA sobre branco; `opaque` diz se algum alpha era menor que 255. @param {Buffer} pixels @returns {{rgb: Buffer, opaque: boolean}} */
function compositeOverWhite(pixels) {
  const rgb = Buffer.alloc(pixels.length / 4 * 3);
  let opaque = true;
  for (let source = 0, target = 0; source < pixels.length; source += 4, target += 3) {
    const alpha = pixels[source + 3];
    if (alpha !== 255) opaque = false;
    const over = alpha / 255;
    rgb[target] = Math.round(pixels[source] * over + 255 * (1 - over));
    rgb[target + 1] = Math.round(pixels[source + 1] * over + 255 * (1 - over));
    rgb[target + 2] = Math.round(pixels[source + 2] * over + 255 * (1 - over));
  }
  return {rgb, opaque};
}

/** Um PNG RGB 8 bits opaco, com linhas sem filtro. @param {number} width @param {number} height @param {Buffer} pixels @returns {Buffer} */
function encodeRgb(width, height, pixels) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let row = 0; row < height; row += 1) pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = COLOR_RGB;
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

/**
 * Achata um PNG 8 bits RGB/RGBA sobre branco (#105): cada pixel vira
 * `cor*alpha + branco*(1-alpha)`, e a saída é um PNG RGB sem transparência.
 * PNG já opaco volta como veio; paleta, 16 bits e entrelaçado também, com uma
 * linha de log, porque o objetivo é não derrubar a página por causa do formato.
 * @param {Buffer} bytes o PNG que chegou pela ponte
 * @param {(line: string) => void} [log] uma linha quando o PNG não é achatado
 * @returns {Buffer} o PNG achatado em RGB 8 bits, ou o original
 * @example const opaco = flattenPng(pngDoAmbitus, (line) => console.warn(line))
 */
function flattenPng(bytes, log = () => {}) {
  let png;
  try {
    png = decodePng(bytes);
  } catch (error) {
    log(`PNG não achatado (${/** @type {Error} */ (error).message}); mantido o original`);
    return bytes;
  }
  if (png.colorType === COLOR_RGB) return bytes;
  const {rgb, opaque} = compositeOverWhite(png.pixels);
  if (opaque) return bytes;
  return encodeRgb(png.width, png.height, rgb);
}

module.exports = {flattenPng};
