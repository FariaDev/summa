const fs = require('node:fs');
const zlib = require('node:zlib');

/* Formato da página do caderno `.xopp` para a lista da biblioteca (#166, D3).
   O `.xopp` é um gzip de XML; o primeiro `<page width="…" height="…">` traz o
   tamanho em pontos (72 por polegada). Ler o arquivo inteiro a cada abertura
   deixaria a biblioteca lenta com muitos cadernos, então só o começo do
   gzip é descomprimido, até a primeira página. O cache por caminho+mtime
   evita repetir a leitura enquanto o caderno não muda. */

const HEAD_CHUNK = 16 * 1024;
const HEAD_MAX = 128 * 1024;
/* Teto do XML descomprimido do cabeçalho. O primeiro `<page>` vem logo depois
   de `<xournal>`, então 1 MiB é folga de sobra para os atributos reais e corta
   a bomba de descompressão no primeiro byte a mais: sem ele, um `.xopp` de
   ~199 KiB com centenas de MiB de zeros travava a lista de Cadernos (#211). */
const HEAD_XML_MAX = 1024 * 1024;
const DEFAULT_CACHE_LIMIT = 500;
const TOLERANCE_PT = 2;

/* Tamanhos que viram etiqueta (Xournal++ em pontos). O diálogo de página do
   Xournal++ 1.3.8 oferece A3, A4, A5, Letter e Legal (`loadDefaultPaperSizes`
   em `src/core/gui/PaperFormatUtils.cpp`); A6 e Tabloide seguem na tabela
   porque já existiam (#166), e Ofício é o Legal do diálogo (#184). */
const PAGE_SIZES = [
 {label: 'A4', width: 595.275591, height: 841.889764},
 {label: 'A3', width: 841.889764, height: 1190.551181},
 {label: 'A5', width: 419.527559, height: 595.275591},
 {label: 'A6', width: 297.637795, height: 419.527559},
 {label: 'Carta', width: 612, height: 792},
 {label: 'Ofício', width: 612, height: 1008},
 {label: 'Tabloide', width: 792, height: 1224},
];

/**
 * Rótulo curto para um tamanho de página em pontos. Aceita paisagem (troca
 * largura/altura) e uma tolerância pequena para os decimais do Xournal++.
 * Tamanho fora da tabela não tem etiqueta.
 * @param {number} width largura em pontos (72 dpi)
 * @param {number} height altura em pontos (72 dpi)
 * @returns {string} "A4", "Carta", … ou '' quando não casa
 * @example formatForPage(595.275591, 841.889764) // 'A4'
 * @example formatForPage(841.889764, 595.275591) // 'A4' (paisagem)
 * @example formatForPage(500, 700) // ''
 */
function formatForPage(width, height) {
 const w = Number(width), h = Number(height);
 if (!(w > 0) || !(h > 0)) return '';
 const short = Math.min(w, h), long = Math.max(w, h);
 const hit = PAGE_SIZES.find((size) => Math.abs(size.width - short) <= TOLERANCE_PT && Math.abs(size.height - long) <= TOLERANCE_PT);
 return hit ? hit.label : '';
}

/**
 * Onde os dados deflate começam no cabeçalho gzip (10 bytes + campos
 * opcionais). -1 quando o cabeçalho ainda não está completo ou não é gzip.
 * @param {Buffer} buffer começo do arquivo comprimido
 * @returns {number}
 */
function gzipDataStart(buffer) {
 if (buffer.length < 10 || buffer[0] !== 0x1f || buffer[1] !== 0x8b || buffer[2] !== 0x08) return -1;
 const flags = buffer[3];
 let at = 10;
 if (flags & 0x04) {
  if (at + 2 > buffer.length) return -1;
  at += 2 + buffer.readUInt16LE(at);
 }
 if (flags & 0x08) at = zeroTerminatedEnd(buffer, at);
 if (flags & 0x10) at = zeroTerminatedEnd(buffer, at);
 if (flags & 0x02) at += 2;
 return at >= 0 && at <= buffer.length ? at : -1;
}

/** @param {Buffer} buffer @param {number} from @returns {number} */
function zeroTerminatedEnd(buffer, from) {
 const end = buffer.indexOf(0, from);
 return end < 0 ? -1 : end + 1;
}

/**
 * A primeira tag `<page …>` do começo do XML (null enquanto ela não apareceu).
 * @param {string} xml
 * @returns {string|null}
 */
function firstPageTag(xml) {
 return /<page\b[^>]*>/i.exec(xml)?.[0] || null;
}

/** @param {string} tag @returns {{width: number, height: number}} */
function pageSizeOf(tag) {
 const width = /width\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
 const height = /height\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
 return {width: Number(width), height: Number(height)};
}

/**
 * O formato da primeira página do `.xopp`, lendo só o começo do gzip. Arquivo
 * que não é gzip, XML sem `<page>` ou tamanho desconhecido devolve ''.
 * @param {string} file caminho do `.xopp`
 * @param {{fs?: any}} [options] `fs` injetável (os testes usam o de verdade)
 * @returns {string} "A4", "Carta", … ou '' sem etiqueta
 * @example readPageFormat('/vault/Courses/Calc/aula.xopp') // 'A4'
 */
function readPageFormat(file, {fs: fsImpl = fs} = {}) {
 let fd;
 try { fd = fsImpl.openSync(file, 'r'); } catch { return ''; }
 try {
  let compressed = Buffer.alloc(0);
  for (let total = 0; total < HEAD_MAX;) {
   const chunk = Buffer.alloc(Math.min(HEAD_CHUNK, HEAD_MAX - total));
   const bytes = fsImpl.readSync(fd, chunk, 0, chunk.length, total);
   if (!bytes) break;
   compressed = Buffer.concat([compressed, chunk.subarray(0, bytes)]);
   total += bytes;
   const format = formatFromHead(compressed);
   if (format !== null) return format;
   if (bytes < chunk.length) break;
  }
  return '';
 } finally {
  try { fsImpl.closeSync(fd); } catch { /* arquivo já fechado */ }
 }
}

/**
 * Tenta a primeira página no pedaço comprimido; null quando ainda não dá para
 * decidir (cabeçalho ou tag incompletos), '' quando a página já apareceu sem
 * tamanho conhecido ou o XML passou do teto (#211).
 * @param {Buffer} compressed
 * @returns {string|null}
 */
function formatFromHead(compressed) {
 const start = gzipDataStart(compressed);
 if (start < 0) return compressed.length >= 10 && compressed[0] === 0x1f ? null : '';
 let xml;
 try {
  xml = zlib.inflateRawSync(compressed.subarray(start), {finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: HEAD_XML_MAX}).toString('utf8');
 } catch (error) {
  return error && error.code === 'ERR_BUFFER_TOO_LARGE' ? '' : null;
 }
 const tag = firstPageTag(xml);
 if (!tag) return null;
 const size = pageSizeOf(tag);
 return formatForPage(size.width, size.height);
}

/**
 * Cache do formato por caminho+mtime: a lista pode ser reaberta sem
 * descomprimir o mesmo caderno de novo, e um caderno salvo (mtime novo) é
 * relido. `limit: 0` desliga o cache (a medição de #166 usa os dois modos).
 * @param {{fs?: any, limit?: number}} [options]
 * @returns {{formatOf: (file: string, mtimeMs: number) => string}}
 * @example const cache = createPageFormatCache(); cache.formatOf('/v/a.xopp', stat.mtimeMs) // 'A4'
 */
function createPageFormatCache({fs: fsImpl = fs, limit = DEFAULT_CACHE_LIMIT} = {}) {
 const seen = new Map();
 return {
  formatOf(file, mtimeMs) {
   const key = typeof file === 'string' ? file : '';
   if (!key) return '';
   const stamp = Number(mtimeMs) || 0;
   const hit = seen.get(key);
   if (hit && hit.mtimeMs === stamp) return hit.format;
   const format = readPageFormat(key, {fs: fsImpl});
   if (stamp && limit > 0) {
    if (!seen.has(key) && seen.size >= limit) seen.delete(seen.keys().next().value);
    seen.set(key, {mtimeMs: stamp, format});
   }
   return format;
  },
 };
}

module.exports = {formatForPage, readPageFormat, createPageFormatCache};
