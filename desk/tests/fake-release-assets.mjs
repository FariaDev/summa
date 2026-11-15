/* Fake nomeado do download da release antiga no ensaio (#21): serve os assets
   da v1.2.0 publicada no mesa-de-estudos por URL, sem rede. */

const RELEASE_BASE = 'https://github.com/FariaDev/mesa-de-estudos/releases/download/v1.2.0/';

/**
 * Um `fetchBuffer` de mentira com os assets da release.
 * @param {Record<string, Buffer>} assets conteúdo por nome do asset
 * @returns {(url: string) => Promise<Buffer>}
 * @example const fetchBuffer = releaseAssetsFetcher({'mesa-estudos-1.2.0.zip': zip});
 */
export function releaseAssetsFetcher(assets) {
  return async function fakeFetchReleaseAsset(url) {
    if (!url.startsWith(RELEASE_BASE)) throw Error(`URL fora da release de ensaio: ${url}`);
    const name = url.slice(RELEASE_BASE.length);
    if (!Object.hasOwn(assets, name)) throw Error(`asset ausente no fake do ensaio: ${name}`);
    return assets[name];
  };
}
