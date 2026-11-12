/* Leitura de tinta falsa (#159): devolve a mesma forma de `readInk`
   (`{text, reason: 'quota'|null}`) a partir do PNG recebido. Nome no arquivo
   inteiro: é o stand-in da ponte real (a chamada avulsa com o modelo do
   aluno), não um stub inline. */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {{text?: string, quota?: boolean, delayMs?: number, never?: boolean}} [options] */
function createFakeInkReader({text = '∫ x dx', quota = false, delayMs = 0, never = false} = {}) {
  const calls = [];
  const signals = [];
  const selections = [];
  return {
    calls,
    signals,
    selections,
    async readText(png, options) {
      calls.push(png);
      if (options && options.signal) signals.push(options.signal);
      selections.push(options && options.selection ? options.selection : null);
      if (never) return new Promise(() => {});
      if (delayMs) await sleep(delayMs);
      if (quota) return {text: null, reason: 'quota'};
      return {text, reason: null};
    },
  };
}

module.exports = {createFakeInkReader};
