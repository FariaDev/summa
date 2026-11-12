import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenCodeProvidersLoader} from '../src/opencode-providers-loader.mjs';

test('OpenCode inicializa uma vez e só carrega quando setup/configuração usa o painel', async () => {
  let imports = 0;
  let initialized = 0;
  const calls = [];
  const providers = createOpenCodeProvidersLoader(async () => {
    imports++;
    return {
      initOpenCodeProviders: () => initialized++,
      refreshOpenCodeProviders: (...args) => calls.push(['refresh', ...args]),
      cancelOpenCodeProviderLogin: (...args) => calls.push(['cancel', ...args]),
    };
  });
  assert.equal(imports, 0);
  await providers.init();
  await providers.refresh('setup', {force: true});
  providers.cancel('setup');
  assert.deepEqual({imports, initialized, calls}, {
    imports: 1,
    initialized: 1,
    calls: [['refresh', 'setup', {force: true}], ['cancel', 'setup']],
  });
});

test('cancelar antes de qualquer painel não carrega o módulo', () => {
  let imports = 0;
  const providers = createOpenCodeProvidersLoader(async () => {
    imports++;
    return {
      initOpenCodeProviders: () => {},
      refreshOpenCodeProviders: () => {},
      cancelOpenCodeProviderLogin: () => {},
    };
  });
  assert.equal(providers.cancel('setup'), undefined);
  assert.equal(imports, 0);
});
