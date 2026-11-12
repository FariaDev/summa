import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavLoader, bindCitationLinks} from '../src/nav-loader.mjs';

test('a navegação é importada no primeiro comando e delega as ações', async () => {
  let imports = 0;
  const calls = [];
  const nav = createNavLoader(async () => {
    imports++;
    return {
      openRef: (...args) => { calls.push(['openRef', ...args]); return true; },
      navBack: (...args) => calls.push(['navBack', ...args]),
      toggleNav: (...args) => calls.push(['toggleNav', ...args]),
    };
  });
  assert.equal(imports, 0);
  assert.equal(await nav.openRef('Limites.pdf', 2, '/tmp/Limites.pdf'), true);
  await nav.navBack('painel');
  await nav.toggleNav('painel');
  assert.equal(imports, 1);
  assert.deepEqual(calls, [
    ['openRef', 'Limites.pdf', 2, '/tmp/Limites.pdf'],
    ['navBack', 'painel'],
    ['toggleNav', 'painel'],
  ]);
});

test('dois comandos simultâneos avaliam a navegação uma vez só', async () => {
  let imports = 0;
  const nav = createNavLoader(async () => {
    imports++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {openRef: () => true, navBack: () => {}, toggleNav: () => {}};
  });
  const [first, second] = await Promise.all([
    nav.openRef('A.pdf', 1, '/tmp/A.pdf'),
    nav.openRef('B.pdf', 2, '/tmp/B.pdf'),
  ]);
  assert.deepEqual([first, second], [true, true]);
  assert.equal(imports, 1);
});

test('o clique na citação vale antes de o nav.mjs carregar', () => {
  const doc = new EventTarget();
  const calls = [];
  const unbind = bindCitationLinks(doc, (...args) => {
    calls.push(args);
    return Promise.resolve(true);
  });
  const button = {
    dataset: {name: 'Limites.pdf', page: '3', path: '/tmp/Limites.pdf'},
    closest: (selector) => (selector === 'button.pdf-ref' ? button : null),
  };
  const citation = new Event('click', {cancelable: true});
  Object.defineProperty(citation, 'target', {value: button});
  doc.dispatchEvent(citation);
  assert.equal(citation.defaultPrevented, true);
  assert.deepEqual(calls, [['Limites.pdf', 3, '/tmp/Limites.pdf']]);

  const other = new Event('click', {cancelable: true});
  Object.defineProperty(other, 'target', {value: {closest: () => null}});
  doc.dispatchEvent(other);
  assert.deepEqual(calls, [['Limites.pdf', 3, '/tmp/Limites.pdf']]);

  unbind();
  const after = new Event('click', {cancelable: true});
  Object.defineProperty(after, 'target', {value: button});
  doc.dispatchEvent(after);
  assert.deepEqual(calls, [['Limites.pdf', 3, '/tmp/Limites.pdf']]);
});

test('falha ao abrir a citação avisa pelo toast', async () => {
  const doc = new EventTarget();
  const notices = [];
  const unbind = bindCitationLinks(
    doc,
    () => Promise.reject(Error('sem navegação')),
    (message) => notices.push(message),
  );
  const button = {
    dataset: {name: 'Limites.pdf', page: '2', path: '/tmp/Limites.pdf'},
    closest: (selector) => (selector === 'button.pdf-ref' ? button : null),
  };
  const citation = new Event('click', {cancelable: true});
  Object.defineProperty(citation, 'target', {value: button});
  doc.dispatchEvent(citation);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(notices, ['sem navegação'], 'o clique não engole mais a falha do import');
  unbind();
});
