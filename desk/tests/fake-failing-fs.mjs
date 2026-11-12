import fs from 'node:fs';

/* Fake de fs que delega ao real, grava cada chamada em `calls` e falha quando
   `failWhen(call)` é verdadeiro — para provar a escrita atômica do plugin
   MesaPagina (#133): a falha no meio não deixa pasta parcial nem reserva. @param {{real?: typeof fs, failWhen?: ((call: {method: string, args: unknown[]}) => boolean) | null}} options
 * @returns {{fs: typeof fs, calls: Array<{method: string, args: unknown[]}>}}
 * @example const failing = fakeFailingFs({failWhen: ({method, args}) => method === 'copyFileSync' && String(args[0]).endsWith('tamanho.lua')});
 */
export function fakeFailingFs({real = fs, failWhen = null} = {}) {
  const calls = [];
  const wrapped = new Proxy(real, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== 'function') return value;
      return (...args) => {
        calls.push({method: String(prop), args});
        if (failWhen && failWhen({method: String(prop), args})) {
          const error = new Error(`falha injetada em ${String(prop)}`);
          error.code = 'EFAKE';
          throw error;
        }
        return value.apply(target, args);
      };
    },
  });
  return {fs: wrapped, calls};
}
