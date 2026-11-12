/* Fake com nome do `readFile`/`readFileSync` que conta chamadas e bytes
   lidos (#158/F5): o teste prova que o teto de 32 MB é conferido pelo
   `stat` ANTES da leitura, sem alocar o arquivo inteiro. */

/**
 * Envolve um `readFile` assíncrono contando chamadas e bytes devolvidos.
 * @param {(file: string, ...args: any[]) => Promise<Buffer|string>} readFileImpl
 * @returns {{readFile: (file: string, ...args: any[]) => Promise<Buffer|string>, calls: Array<{file: string, bytes: number}>, bytesRead: () => number}}
 * @example const counter = createCountingReadFile(fs.promises.readFile); await counter.readFile('/a.xopp'); counter.bytesRead() // 123
 */
export function createCountingReadFile(readFileImpl) {
  const calls = [];
  async function readFile(file, ...args) {
    const bytes = await readFileImpl(file, ...args);
    calls.push({file, bytes: bytes?.length ?? 0});
    return bytes;
  }
  return {readFile, calls, bytesRead: () => calls.reduce((sum, call) => sum + call.bytes, 0)};
}

/**
 * Envolve um `readFileSync` contando chamadas e bytes devolvidos.
 * @param {(file: string, ...args: any[]) => Buffer|string} readFileImpl
 * @returns {{readFileSync: (file: string, ...args: any[]) => Buffer|string, calls: Array<{file: string, bytes: number}>, bytesRead: () => number}}
 * @example const counter = createCountingReadFileSync(fs.readFileSync); counter.readFileSync('/a.xopp'); counter.bytesRead() // 123
 */
export function createCountingReadFileSync(readFileImpl) {
  const calls = [];
  function readFileSync(file, ...args) {
    const bytes = readFileImpl(file, ...args);
    calls.push({file, bytes: bytes?.length ?? 0});
    return bytes;
  }
  return {readFileSync, calls, bytesRead: () => calls.reduce((sum, call) => sum + call.bytes, 0)};
}
