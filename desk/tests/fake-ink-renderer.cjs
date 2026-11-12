/* Renderizador falso da tinta (#159): devolve um PNG 1×1 e guarda os SVGs que
   recebeu. Nome no arquivo inteiro: é o stand-in do renderizador real (a
   janela escondida de `ink-convert-host.cjs`), não um stub inline. */
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {{png?: string, delayMs?: number, never?: boolean}} [options] @returns {{render: (svg: string, options?: {signal?: AbortSignal}) => Promise<string>, calls: string[], signals: AbortSignal[], png: string}} */
function createFakeInkRenderer({png = PNG_1X1, delayMs = 0, never = false} = {}) {
  const calls = [];
  const signals = [];
  return {
    png,
    calls,
    signals,
    async render(svg, options) {
      calls.push(svg);
      if (options && options.signal) signals.push(options.signal);
      if (never) return new Promise(() => {});
      if (delayMs) await sleep(delayMs);
      return png;
    },
  };
}

module.exports = {createFakeInkRenderer, PNG_1X1};
