/* O seletor de acento das Configurações e da primeira abertura (#70). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCENT_IDS, accentOptionsMarkup, nextAccent} from '../src/accent-picker.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};

test('as duas opções têm rótulo traduzido, com grafite marcado', () => {
  assert.deepEqual([...ACCENT_IDS], ['graphite', 'violet'], 'a ordem do ACCENTS do state.mjs');
  for (const id of ACCENT_IDS) assert.ok(ptBR[`settings.accent.${id}`], `falta settings.accent.${id}`);
  const markup = accentOptionsMarkup();
  assert.equal((markup.match(/role="radio"/g) || []).length, ACCENT_IDS.length);
  assert.match(markup, /data-accent="graphite" aria-checked="true" tabindex="0"/);
  assert.match(markup, /data-accent="violet" aria-checked="false" tabindex="-1"/);
  assert.match(markup, /data-i18n="settings\.accent\.violet"/);
});

test('as setas andam pelos acentos dando a volta; outra tecla não muda', () => {
  assert.equal(nextAccent('graphite', 'ArrowRight'), 'violet');
  assert.equal(nextAccent('graphite', 'ArrowLeft'), 'violet');
  assert.equal(nextAccent('violet', 'ArrowDown'), 'graphite');
  assert.equal(nextAccent('desconhecido', 'ArrowRight'), 'violet', 'valor fora da lista conta como grafite');
  assert.equal(nextAccent('graphite', 'Enter'), '');
});
