import test from 'node:test';
import assert from 'node:assert/strict';
import {platformKeyText} from '../src/platform-key-text.mjs';
import {ptT,enText} from './pt-text.mjs';
import {message} from '../src/i18n.mjs';

for(const platform of ['darwin','win32','linux']){
 test(`dynamic shortcut labels on ${platform}`,()=>{
  const mac=platform==='darwin';
  assert.equal(platformKeyText(ptT('more.collapse.hide'),false,platform),mac?'Recolher o tutor (⌘\\)':'Recolher o tutor (Ctrl+\\)');
  assert.equal(platformKeyText(ptT('queue.steerNowTitle'),false,platform),mac?'Interromper a resposta e enviar agora (⌘⏎)':'Interromper a resposta e enviar agora (Ctrl+Enter)');
  assert.equal(platformKeyText('⇧⏎',false,platform),mac?'⇧⏎':'Shift+Enter');
  assert.equal(platformKeyText('⌘1…⌘9',false,platform),mac?'⌘1…⌘9':'Ctrl+1…Ctrl+9');
  const errorKey=mac?'keys.status.needModifier':'keys.status.needModifierOther';
  assert.equal(ptT(errorKey),mac?'Use ⌘, ⌥ ou ⌃ junto com uma tecla.':'Use Ctrl ou Alt junto com uma tecla.');
  assert.equal(enText(message(errorKey)),mac?'Use ⌘, ⌥ or ⌃ together with a key.':'Use Ctrl or Alt together with a key.');
  assert.equal(platformKeyText('',false,platform),'');
  assert.equal(platformKeyText('← →',false,platform),'← →');
  assert.equal(platformKeyText('⌘',true,platform),mac?'⌘':'Ctrl');
 });
}
