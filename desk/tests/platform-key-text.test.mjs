import test from 'node:test';
import assert from 'node:assert/strict';
import {platformKeyText} from '../src/platform-key-text.mjs';
import {ptT} from './pt-text.mjs';

for(const platform of ['darwin','win32','linux']){
 test(`dynamic shortcut labels on ${platform}`,()=>{
  const mac=platform==='darwin';
  assert.equal(platformKeyText(ptT('more.collapse.hide'),false,platform),mac?'Recolher o tutor (⌘\\)':'Recolher o tutor (Ctrl+\\)');
  assert.equal(platformKeyText(ptT('queue.steerNowTitle'),false,platform),mac?'Interromper a resposta e enviar agora (⌘⏎)':'Interromper a resposta e enviar agora (Ctrl+Enter)');
  assert.equal(platformKeyText('⇧⏎',false,platform),mac?'⇧⏎':'Shift+Enter');
  assert.equal(platformKeyText('⌘1…⌘9',false,platform),mac?'⌘1…⌘9':'Ctrl+1…Ctrl+9');
  assert.equal(platformKeyText(ptT('keys.status.needModifier'),false,platform),mac?'Use ⌘, ⌥ ou ⌃ junto com uma tecla.':'Use Ctrl, Alt ou Ctrl junto com uma tecla.');
  assert.equal(platformKeyText('',false,platform),'');
  assert.equal(platformKeyText('← →',false,platform),'← →');
  assert.equal(platformKeyText('⌘',true,platform),mac?'⌘':'Ctrl');
 });
}
