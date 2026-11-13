import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/* Etapa 1 da consistência do CSS: dois raios de uso e o círculo por natureza.
   `--r-sm` (4px) é o controle, o campo, a aba, o chip, o item de menu, a
   mensagem e o cartão pequeno; `--r-md` (8px) é o diálogo, o menu suspenso, o
   popover e o painel flutuante; `--r-round` (50%) fica para o que é círculo
   por natureza (ponto de status, botão redondo, alternador). Zero e `inherit`
   continuam válidos. Qualquer outro token (`--r-lg`, `--r-xl`, `--r-pill`,
   `--r-card`, `--r-xs`, `--r-2xs`, `--r-hairline`, `--r-2xl`, `--r-3xl`) ou
   px/% literal é recusado, mesmo fora da lista antiga. A definição em
   `style.css` não conta: o teste olha `border-radius`. */

const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ALLOWED=['--r-sm','--r-md','--r-round'];
const FORBIDDEN=['--r-pill','--r-card','--r-2xl','--r-3xl'];

/* Exceções conscientes (#90): o elemento é círculo/trilho por natureza, não um
   controle que ganhou canto redondo. No r2 o canto dessas peças passou para
   `--r-sm` (o pill de 999px e os 4–6px dos controles pequenos), então a lista
   fechada acompanha o token e continua conferida: exceção que deixou de existir
   no CSS quebra o teste. */
const EXCEPTIONS=[
 {file:'src/tutor-chat.css',selector:'#ctx-meter .bar',token:'--r-sm',reason:'barra de progresso: trilho por natureza'},
 {file:'src/conversations-dividers.css',selector:'#review-tab #review-count',token:'--r-sm',reason:'contador numérico pequeno: cápsula por natureza'},
];

/** Todas as folhas de estilo do app (sem node_modules, runtime e gerados). @returns {string[]} */
function cssFiles(){
 const out=[];
 const walk=dir=>{
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   if(['node_modules','.runtime'].includes(entry.name))continue;
   const full=path.join(dir,entry.name);
   if(entry.isDirectory()){if(entry.name!=='generated')walk(full);}
   else if(entry.name.endsWith('.css'))out.push(full);
  }
 };
 walk(DESK);
 return out.sort();
}

/** O CSS sem comentários, com os bytes trocados por espaço (linhas preservadas). @param {string} css @returns {string} */
function withoutComments(css){
 return css.replace(/\/\*[\s\S]*?\*\//g,comment=>comment.replace(/[^\n]/g,' '));
}

/** Seletores que embrulham uma declaração (a última regra antes da chave). @param {string} css @param {number} index @returns {string} */
function selectorAt(css,index){
 const open=css.lastIndexOf('{',index);
 if(open<0)return '';
 const close=css.lastIndexOf('}',open);
 return css.slice(close+1,open).replace(/\s+/g,' ').trim();
}

test('raios: só --r-sm, --r-md e --r-round (mais 0 e inherit)',()=>{
 const offenses=[];
 for(const file of cssFiles()){
  const rel=path.relative(DESK,file).split(path.sep).join('/');
  /* `src/materials/` é o modelo de PDF gerado, não a interface da Mesa: o raio
     de lá é medida do papel e fica fora desta etapa (como no teste de tokens). */
  if(rel.startsWith('src/materials/'))continue;
  const css=withoutComments(fs.readFileSync(file,'utf8'));
  for(const match of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)){
   const value=match[1].trim();
   const leftover=ALLOWED.reduce((text,token)=>text.split(`var(${token})`).join(''),value)
    .replace(/\b(?:0|inherit)\b/g,'').replace(/[\s/]+/g,'');
   if(!leftover)continue;
   const selector=selectorAt(css,match.index);
   const line=css.slice(0,match.index).split('\n').length;
   offenses.push(`${rel}:${line} ${selector} usa "${value}" (esperado ${ALLOWED.map(token=>`var(${token})`).join(', ')}, 0 ou inherit)`);
  }
 }
 assert.deepEqual(offenses,[],`raio fora dos dois tokens de uso:\n${offenses.join('\n')}`);
});

test('raios: --r-pill/--r-card/--r-2xl/--r-3xl só nas exceções documentadas',()=>{
 const fate=EXCEPTIONS.map(()=>false);
 const offenses=[];
 for(const file of cssFiles()){
  const rel=path.relative(DESK,file).split(path.sep).join('/');
  const css=withoutComments(fs.readFileSync(file,'utf8'));
  for(const match of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)){
   const value=match[1];
   const selector=selectorAt(css,match.index);
   const exception=EXCEPTIONS.findIndex(item=>item.file===rel&&item.selector===selector&&value.includes(`var(${item.token})`));
   if(exception>=0){fate[exception]=true;continue;}
   const token=FORBIDDEN.find(name=>value.includes(`var(${name})`));
   if(!token)continue;
   const line=css.slice(0,match.index).split('\n').length;
   offenses.push(`${rel}:${line} ${selector} usa ${token}`);
  }
 }
 assert.deepEqual(offenses,[],`raio grande fora da lista de exceções:\n${offenses.join('\n')}`);
 for(const [index,exception] of EXCEPTIONS.entries()){
  assert.ok(fate[index],`exceção sem uso: ${exception.file} ${exception.selector} ${exception.token} (${exception.reason}) — remova da lista ou devolva o uso`);
 }
});
