// Preenche o template da página com os textos de um idioma. Chave que falta é
// erro de build, não um "{{...}}" esquecido no site publicado.

/**
 * Troca cada `{{chave}}` do template pelo valor de `strings`.
 *
 * @param {string} template
 * @param {Record<string, string>} strings
 * @returns {string}
 * @example
 * fill('<h1>{{title}}</h1>', {title: 'Summa'}) // → '<h1>Summa</h1>'
 */
export function fill(template, strings) {
  const missing = new Set();
  const out = template.replace(/\{\{([\w.-]+)\}\}/g, (_, key) => {
    if (typeof strings[key] === 'string') return strings[key];
    missing.add(key);
    return '';
  });
  if (missing.size) throw new Error(`chaves sem texto: ${[...missing].join(', ')} (esperava uma string para cada {{chave}} do template)`);
  return out;
}

/**
 * Os textos que dependem dos instaladores: link e nome de cada um, ou o texto
 * de "sem instalador ainda" do idioma, e a versão mostrada no topo.
 *
 * @param {ReturnType<typeof import('./downloads.mjs').pickDownloads>} downloads
 * @param {Record<string, string>} strings os textos do idioma (usa `dl.missing.*`)
 * @param {string} releasesPage
 * @returns {Record<string, string>}
 * @example
 * downloadStrings({latest: 'v1.4.0', mac: null, win: null, linux: null}, {'dl.missing.mac': 'o instalador'}, 'https://x')
 * // → {'dl.mac.href': 'https://x', 'dl.mac.file': 'o instalador', …}
 */
export function downloadStrings(downloads, strings, releasesPage) {
  const out = {'dl.json': escapeJson(downloads)};
  for (const os of ['mac', 'win', 'linux']) {
    const item = downloads[os];
    out[`dl.${os}.href`] = item ? escapeAttr(item.url) : releasesPage;
    out[`dl.${os}.file`] = item ? `<b>${escapeText(item.file)}</b>` : strings[`dl.missing.${os}`] || '';
  }
  return out;
}

const escapeText = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escapeAttr = (text) => escapeText(text).replace(/"/g, '&quot;');
// Dentro de <script type="application/json">, só "</" quebraria o bloco.
const escapeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
