/* Cliente de `salvar_nota`: a ponte de material da sessão principal
   (`LEARNING_DESK_MATERIAL_BRIDGE`), rota `/notes`. Desde a #139 a rota só
   SUGERE a nota; quem grava é o clique "Guardar" no main. O chat lateral não
   recebe essa concessão, então a ferramenta não existe lá. */

/**
 * @param {{url?: string, token?: string} | null | undefined} bridge concessão da ponte
 * @param {{titulo?: unknown, conteudo?: unknown}} args
 * @param {{fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{suggested: boolean, id: string, title: string}>}
 * @example await suggestNote({url: 'http://127.0.0.1:9/pdf', token: 't'}, {titulo: 'Limites', conteudo: '# a'})
 */
export async function suggestNote(bridge, args, {fetchImpl = fetch} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/pdf$/.test(bridge.url || '')) {
    throw Error('Salvar nota está disponível na sessão principal da Mesa.');
  }
  const response = await fetchImpl(String(bridge.url).replace(/\/pdf$/, '/notes'), {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
    body: JSON.stringify({titulo: args?.titulo, conteudo: args?.conteudo}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.suggested !== true) throw Error((data && data.error) || 'A Mesa não confirmou a sugestão de nota.');
  return data;
}
