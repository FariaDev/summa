/* Um "Ambitus falso" para os testes: faz o long-poll `GET /pedido-pagina` na
   ponte da Summa e, a cada `{pedido}`, responde `POST /pagina-atual` com o que
   `page(pedido)` devolver (a página renderizada, ou `{erro: 'sem-pagina'}`).
   Lê porta e token de `ambitus-bridge.json` a cada volta, como o Ambitus de
   verdade, e recua em silêncio quando a Summa não está no ar. Só protocolo:
   nenhum código do Xournal++ nem do Ambitus mora aqui. */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {{runtime: string, page: (pedido: string) => object, retryMs?: number}} options
 * @returns {{stop: () => Promise<void>, asked: string[]}}
 * @example const ambitus = startFakeAmbitus({runtime, page: () => ({caminho: '', pagina: 1, nome: 'a', png})}); await ambitus.stop();
 */
export function startFakeAmbitus({runtime, page, retryMs = 150}) {
  const asked = [];
  const controller = new AbortController();
  const bridge = () => { try { return JSON.parse(fs.readFileSync(path.join(runtime, 'ambitus-bridge.json'), 'utf8')); } catch { return null; } };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function loop() {
    while (!controller.signal.aborted) {
      const file = bridge();
      if (!file) { await pause(retryMs); continue; }
      const base = `http://127.0.0.1:${file.port}`;
      const headers = {'x-summa-token': file.token};
      try {
        const response = await fetch(`${base}/pedido-pagina`, {headers, signal: controller.signal});
        if (response.status !== 200) { await response.arrayBuffer(); await pause(response.status === 204 ? 0 : retryMs); continue; }
        const {pedido} = await response.json();
        asked.push(pedido);
        const answer = await fetch(`${base}/pagina-atual`, {method: 'POST', headers: {...headers, 'content-type': 'application/json'}, body: JSON.stringify({pedido, ...page(pedido)}), signal: controller.signal});
        await answer.arrayBuffer();
      } catch {
        if (!controller.signal.aborted) await pause(retryMs);
      }
    }
  }
  const running = loop();
  return {asked, stop: async () => { controller.abort(); await running; }};
}
