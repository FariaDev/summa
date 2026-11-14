/* VM Windows 11 limpa (#5): o download do Electron morria com
   ERR_DLOPEN_FAILED porque o `@electron-internal/extract-zip` precisa do
   vcruntime140.dll, que só vem com o Microsoft Visual C++ Redistributable x64.
   A mensagem antiga mandava apagar o node_modules, o que não resolvia. */
import fs from 'node:fs';
import path from 'node:path';

export const VC_REDIST_URL = 'https://aka.ms/vs/17/release/vc_redist.x64.exe';

const DLOPEN_FAILURE = /ERR_DLOPEN_FAILED|Cannot find native binding/;

/**
 * Diz o que instalar quando o Electron não baixa no Windows por falta do VC++
 * Redistributable; fora do Windows, ou com a dll presente e outro erro, não diz nada.
 * @param {{platform?:string, existsSync?:(file:string)=>boolean, systemRoot?:string, output?:string}} options
 *   `output` é a saída do download; vazio confere a dll antes de tentar baixar.
 * @returns {string|null} a mensagem para o setup, ou null quando não falta nada
 * @example vcRedistProblem({platform: 'win32', existsSync: () => false}) // mensagem com o link
 */
export function vcRedistProblem({platform = process.platform, existsSync = fs.existsSync, systemRoot = process.env.SystemRoot, output = ''} = {}) {
  if (platform !== 'win32') return null;
  if (output) return DLOPEN_FAILURE.test(output) ? vcRedistMessage() : null;
  const dll = path.win32.join(systemRoot || 'C:\\Windows', 'System32', 'vcruntime140.dll');
  return existsSync(dll) ? null : vcRedistMessage();
}

function vcRedistMessage() {
  return `Falta o Microsoft Visual C++ Redistributable x64 (vcruntime140.dll), necessário para baixar o Electron. Baixe em ${VC_REDIST_URL}, instale e rode npm run setup de novo.`;
}
