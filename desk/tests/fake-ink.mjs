/* Fakes com nome do índice da tinta (#158, passo 2): relógio/timers
   injetados, `readInk` falso contando chamadas e exportador falso do PNG.
   O teste conta as chamadas para provar que nada roda desligado, que só
   página mudada com tinta vai ao modelo e que o quota para a fila. */

/**
 * Timers falsos do vigia da tinta: guarda o callback do `setInterval`
 * para o teste disparar os ticks à mão, sem esperar 3 s de verdade.
 * @returns {{setIntervalImpl: Function, clearIntervalImpl: Function, tick: (count?: number) => Promise<void>, active: () => number}}
 * @example const timers = createFakeInkTimers(); await timers.tick(); // 1 tick do vigia
 */
export function createFakeInkTimers() {
  let callback = null;
  let isActive = false;
  const handle = {unref: () => {}};
  return {
    setIntervalImpl: (fn) => {
      callback = fn;
      isActive = true;
      return handle;
    },
    clearIntervalImpl: () => {
      isActive = false;
    },
    /** Dispara `count` ticks; cada tick é aguardado (o vigia lê async). */
    tick: async (count = 1) => {
      for (let at = 0; at < count; at += 1) {
        if (isActive && callback) await callback();
        /* Cede o loop para o drain da fila terminar antes do próximo tick. */
        for (let turn = 0; turn < 5; turn += 1) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
    },
    /** 1 quando o intervalo está armado, 0 quando `stop()` o desarmou. */
    active: () => (isActive ? 1 : 0),
  };
}

/**
 * Relógio falso do vigia da tinta (#158, passo 2, ajustes B1/M2): o teste
 * avança o tempo à mão para provar a espera crescente sem esperar de
 * verdade. `nowMs` entra no vigia como dependência.
 * @param {number} [startMs] instante inicial em ms desde a época
 * @returns {{nowMs: () => number, advance: (ms: number) => void}}
 * @example const clock = createFakeInkClock(); clock.advance(31000); // 31 s no futuro
 */
export function createFakeInkClock(startMs = 1000000) {
  let current = startMs;
  return {
    nowMs: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

/**
 * `readInk` falso do índice da tinta: conta chamadas e devolve o texto
 * enfileirado (ou o texto padrão). Em `quota`, devolve quota sem texto.
 * Escopo #158 (ajustes): `throwOnCalls` lança timeout/erro (falha
 * transitória) nas chamadas listadas; `quotaOnCalls` devolve quota só
 * nelas; `delayMs`/`delayOnCalls` seguram a chamada (ou só as listadas)
 * para o teste parar no meio; o `signal` abortado cancela à espera e
 * conta em `aborted` — é assim que o teste prova que `stop()` cancela.
 * @param {{texts?: string[], quota?: boolean, quotaOnCalls?: number[], throwOnCalls?: number[], delayMs?: number, delayOnCalls?: number[]|null, text?: string}} [options]
 * @returns {{readInk: (args: {png?: unknown, signal?: AbortSignal|null}) => Promise<{text: string|null, reason: string|null}>, calls: Array<{png: unknown, signal: AbortSignal|null}>, aborted: number}}
 * @example const reader = createFakeInkReader({texts: ['integral x dx']}); await reader.readInk({bridge: {}, png: 'AA=='}) // {text: 'integral x dx', reason: null}
 */
export function createFakeInkReader({texts = [], quota = false, quotaOnCalls = [], throwOnCalls = [], delayMs = 0, delayOnCalls = null, text = 'texto particular da tinta'} = {}) {
  const queue = [...texts];
  const calls = [];
  const api = {readInk, calls, aborted: 0};
  /** Espera `ms` com `signal`, ou resmunga o abort como o `readInk` real. @param {AbortSignal|null} [signal] @param {number} ms @returns {Promise<void>} */
  async function waitForRead(signal, ms) {
    if (!ms && !signal) return;
    return new Promise((resolve, reject) => {
      /** @type {ReturnType<typeof setTimeout>|null} */
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        api.aborted += 1;
        cleanup();
        reject(Error('leitura da tinta cancelada'));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      if (ms > 0) timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
      else queueMicrotask(resolve);
      signal?.addEventListener('abort', onAbort, {once: true});
    });
  }
  /** @param {{png?: unknown, signal?: AbortSignal|null}} [args] @returns {Promise<{text: string|null, reason: string|null}>} */
  async function readInk(args = {}) {
    /* O vigia manda o PNG em base64; a chamada conta mesmo sem ponte. */
    calls.push({png: args.png, signal: args.signal ?? null});
    const callNumber = calls.length;
    const wantsDelay = delayMs > 0 && (delayOnCalls === null || delayOnCalls.includes(callNumber));
    await waitForRead(args.signal ?? null, wantsDelay ? delayMs : 0);
    if (throwOnCalls.includes(callNumber)) throw Error('falha na leitura da tinta (timeout)');
    if (quota || quotaOnCalls.includes(callNumber)) return {text: null, reason: 'quota'};
    return {text: queue.length ? queue.shift() : text, reason: null};
  }
  return api;
}

/**
 * Exportador falso do PNG da página: conta chamadas e devolve um Buffer
 * PNG mínimo, sem Xournal++ nenhum. `failPages` lança nas páginas
 * listadas (falha transitória de exportação). `calls` guarda o `signal`
 * que o vigia mandou: o `exportPageImage` real não aceita AbortSignal,
 * mas o falso registra para o teste dizer que o vigia passou o sinal.
 * @param {{bytes?: Buffer, failPages?: number[]}} [options]
 * @returns {{exportInkPng: (args: {file: string, page: number, signal?: AbortSignal|null}) => Promise<Buffer>, calls: Array<{file: string, page: number, signal: AbortSignal|null}>}}
 * @example const exporter = createFakeInkExporter(); const png = await exporter.exportInkPng({file: 'a.xopp', page: 2}); // Buffer
 */
export function createFakeInkExporter({bytes, failPages = []} = {}) {
  const calls = [];
  const png = bytes || Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  return {
    exportInkPng: async ({file, page, signal} = {}) => {
      calls.push({file, page, signal: signal ?? null});
      if (failPages.includes(page)) throw Error(`página ${page} sem PNG`);
      return png;
    },
    calls,
  };
}
