/* Chat lateral (#157), rodada 2: o que não precisa de janela para medir.
   - o indicador de "pensando" desliga a animação com movimento reduzido;
   - a chave `sidechat.uncertainShort` não voltou sem uso;
   - o rótulo curto do quiz em inglês cabe no orçamento da casa (≤80). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const desk=new URL('../',import.meta.url);
const css=fs.readFileSync(new URL('src/support-sidechat.css',desk),'utf8');
const readLocale=name=>JSON.parse(fs.readFileSync(new URL(`src/locales/${name}.json`,desk),'utf8'));

test('os pontos de "pensando" respeitam prefers-reduced-motion',()=>{
 const reduced=/@media \(prefers-reduced-motion:reduce\)\{[^}]*\.sidechat-thinking span\{animation:none/.exec(css);
 assert.ok(reduced,'support-sidechat.css precisa desligar .sidechat-thinking span em prefers-reduced-motion');
});

test('sidechat.uncertainShort não volta sem uso',()=>{
 for(const locale of ['pt-BR','en']){
  const keys=readLocale(locale);
  assert.equal(Object.hasOwn(keys,'sidechat.uncertainShort'),false,`${locale} ainda tem sidechat.uncertainShort`);
 }
});

test('o rótulo curto do quiz em inglês cabe no orçamento da casa',()=>{
 const en=readLocale('en');
 assert.equal(en['quiz.dontKnowButton'],'Not sure');
 assert.ok(en['quiz.dontKnowButton'].length<=80,'texto de UI ≤80 caracteres');
 assert.ok(en['quiz.dontKnow'].length<=80,'texto de UI ≤80 caracteres');
});
