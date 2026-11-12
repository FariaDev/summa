// Estados do MesaPagina que faltavam nas capturas (#159): a página de fontes
// mistas do caderno sintético e o pedido em voo da ponte falsa para o motivo
// `busy`. Fica fora do script principal para ele seguir abaixo de 500 linhas;
// nada aqui toca no ~/.config/xournalpp real.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {gunzipSync, gzipSync} from 'node:zlib';

/* Página com fontes mistas: o diálogo do Trocar fonte mostra "Fontes
   atuais: C059, Sans." em vez de uma fonte só (#159). */
const PAGINA_FONTES_MISTAS = '<page width="595.275591" height="841.889764">\n'
  + '<background type="solid" color="#ffffffff" style="plain"/>\n<layer>\n'
  + '<text font="C059" size="14" x="100" y="320" color="#000000ff">Texto em C059</text>\n'
  + '<text font="Sans" size="12" x="100" y="360" color="#000000ff">Texto em Sans</text>\n'
  + '</layer>\n</page>\n';

/** Acrescenta a página 10 (fontes mistas) ao caderno sintético já gravado por
 * `install`; as páginas 1–9 não mudam.
 * @param {{xopp: string}} paths caminhos do `install`
 * @returns {void}
 * @example addExtraPages(install(base));
 */
export function addExtraPages(paths) {
  const xml = gunzipSync(fs.readFileSync(paths.xopp)).toString('utf8');
  const comPagina = xml.replace('</xournal>', `${PAGINA_FONTES_MISTAS}</xournal>`);
  fs.writeFileSync(paths.xopp, gzipSync(Buffer.from(comPagina, 'utf8')));
}

const SVG_DIRETO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">'
  + '<rect x="0" y="0" width="20" height="20" fill="#FFFFFF"/>'
  + '<path d="M1 1 L19 19" fill="none" stroke="#000000" stroke-width="2.0"/></svg>';

/** Manda um pedido válido direto à ponte falsa, sem o Xournal++ no meio, e
 * deixa a conversão em voo (`busy`) enquanto o `readText` do host não
 * responde. Devolve o `http.ClientRequest` para destruir e liberar a ponte.
 * @param {string} runtime pasta do runtime com `ink-convert-bridge.json`
 * @returns {import('node:http').ClientRequest}
 * @example const emVoo = postBusyRequest(paths.runtime); …; emVoo.destroy();
 */
export function postBusyRequest(runtime) {
  const {port, token} = JSON.parse(fs.readFileSync(path.join(runtime, 'ink-convert-bridge.json'), 'utf8'));
  const body = JSON.stringify({svg: SVG_DIRETO});
  const request = http.request({
    hostname: '127.0.0.1', port, path: '/converter', method: 'POST',
    headers: {'content-type': 'application/json', 'x-mesa-token': token, 'content-length': Buffer.byteLength(body)},
  }, (response) => response.resume());
  request.on('error', () => { /* a ponte pode fechar antes; busy já foi lido */ });
  request.end(body);
  return request;
}
