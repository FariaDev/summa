import fs from 'node:fs';

/* Fake nomeado do fs da limpeza dos restos de cadernos: delega ao fs real,
   registra cada chamada e falha quando `failWhen(call)` for verdadeiro — para
   provar que um passo com erro não derruba os outros nem toca fora dos
   caminhos. @param {{real?: typeof fs, failWhen?: ((call: {method: string, args: unknown[]}) => boolean) | null}} options
 * @returns {{fs: typeof fs, calls: Array<{method: string, args: unknown[]}>}}
 * @example const fake = fakeLeftoversFs({failWhen: ({method, args}) => method === 'rmSync' && String(args[0]).endsWith('ink-convert-bridge.json')});
 */
export function fakeLeftoversFs({real = fs, failWhen = null} = {}) {
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
