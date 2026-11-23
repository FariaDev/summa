// Os instaladores que o site oferece, tirados das Releases do GitHub.
// Até a v1.3.3 as Releases só traziam o zip e o manifesto do atualizador; os
// instaladores passam a ser anexados a partir da próxima. Por isso cada sistema
// procura o próprio arquivo na Release mais nova que o tiver, e sem nenhum o botão
// aponta para a página de Releases em vez de dar 404.

export const RELEASES_PAGE = 'https://github.com/FariaDev/summa/releases/latest';

/** O nome de cada instalador, como o release.md manda anexar. */
export const INSTALLERS = {
  mac: /^Summa-(\d+\.\d+\.\d+)\.dmg$/,
  win: /^Summa-Setup-(\d+\.\d+\.\d+)\.exe$/,
  linux: /^Summa-(\d+\.\d+\.\d+)-x86_64\.AppImage$/,
};

/**
 * @typedef {{name: string, browser_download_url: string}} ReleaseAsset
 * @typedef {{tag_name: string, draft?: boolean, prerelease?: boolean, assets: ReleaseAsset[]}} Release
 * @typedef {{version: string, file: string, url: string} | null} Download
 */

/**
 * Para cada sistema, o instalador da Release publicada mais nova que o tem.
 * `releases` vem na ordem da API (`GET /repos/{owner}/{repo}/releases`): a mais nova primeiro.
 *
 * @param {Release[]} releases
 * @returns {{latest: string, mac: Download, win: Download, linux: Download}}
 * @example
 * pickDownloads([{tag_name: 'v1.4.0', assets: [{name: 'Summa-1.4.0.dmg', browser_download_url: 'https://x/a.dmg'}]}])
 * // → {latest: 'v1.4.0', mac: {version: '1.4.0', file: 'Summa-1.4.0.dmg', url: 'https://x/a.dmg'}, win: null, linux: null}
 */
export function pickDownloads(releases) {
  if (!Array.isArray(releases)) throw new TypeError(`releases: esperava a lista da API do GitHub, veio ${typeof releases}`);
  const published = releases.filter((release) => !release.draft && !release.prerelease);
  const out = {latest: published[0]?.tag_name || '', mac: null, win: null, linux: null};
  for (const [os, pattern] of Object.entries(INSTALLERS)) out[os] = firstInstaller(published, pattern);
  return out;
}

/** @param {Release[]} releases @param {RegExp} pattern @returns {Download} */
function firstInstaller(releases, pattern) {
  for (const release of releases) {
    for (const asset of release.assets || []) {
      const match = pattern.exec(asset.name);
      if (match) return {version: match[1], file: asset.name, url: asset.browser_download_url};
    }
  }
  return null;
}
