/* #85: decisão B — o runtime continua no clone (`installRoot()/desk/.runtime`
   ou o `runtimePath` da config), e o app instalado usa esses dados. Quem apaga
   o clone perde sessões, estado e o OpenCode baixado, então o fim do
   `npm run install-app` avisa com o caminho real em vez de deixar a surpresa. */
import path from 'node:path';

/**
 * Linha do fim do `npm run install-app` (macOS e Windows): o runtime que o app
 * instalado vai usar e, quando ele mora dentro do clone, o aviso de não apagar
 * nem mover a pasta do clone. Com `runtimePath` fora do clone o aviso seria
 * falso, então sai só o caminho.
 * @param {string} runtimeDir caminho do runtime resolvido como o app resolve
 *   (o `doctorContext().runtime`, não uma regra paralela)
 * @param {string} cloneDir raiz do clone de onde o install-app rodou
 * @returns {string} uma linha pronta para imprimir
 * @example runtimeKeepNotice('/home/ana/summa/desk/.runtime','/home/ana/summa')
 * // 'Runtime do app: /home/ana/summa/desk/.runtime. O app instalado usa os dados que estão no clone (sessões, estado e OpenCode): não apague nem mova a pasta do clone.'
 */
export function runtimeKeepNotice(runtimeDir, cloneDir) {
  const shown = String(runtimeDir || '').trim();
  if (!shown) return 'Runtime do app: (não configurado).';
  const inside = path.relative(path.resolve(cloneDir), path.resolve(shown));
  if (inside.startsWith('..') || path.isAbsolute(inside)) return `Runtime do app: ${shown}.`;
  return `Runtime do app: ${shown}. O app instalado usa os dados que estão no clone (sessões, estado e OpenCode): não apague nem mova a pasta do clone.`;
}
