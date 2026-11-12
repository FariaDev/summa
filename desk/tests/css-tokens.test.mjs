import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/* Etapa 1 da consistência do CSS (tipo, cor e sombra). As folhas de `desk/src/`
   não escrevem mais tamanho de texto, cor ou sombra por conta própria: tudo vem
   dos tokens de `style.css`. O teste varre as mesmas folhas de
   `radius-tokens.test.mjs` e recusa:
   - `font-size` com px literal;
   - cor hex/rgb/rgba literal;
   - `box-shadow` literal (fora dos tokens de profundidade e dos anéis de foco).
   `style.css` fica de fora porque é onde os tokens nascem. As exceções são uma
   lista fechada, cada uma com motivo; exceção que sumiu do CSS quebra o teste. */

const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SHADOW_TOKENS=new Set(['var(--shadow-pop)','var(--shadow-dialog)','var(--ring-shadow)','var(--ring-shadow-inset)']);
/* Anel de foco/recorte: tudo em zero, só o espalhamento e uma cor em token. */
const RING=/^(?:inset )?0 0 0 [0-9.]+px var\(--[\w-]+\)$/;
const PX=/(?:^|[^\w.-])[0-9]*\.?[0-9]+px\b/;

/* Exceções conscientes. `values` é fechado: valor novo no mesmo arquivo/tipo
   continua reprovando. */
const EXCEPTIONS=[
 {
  file:'src/phone-page.css',kind:'font-size',
  values:['13px','30px','17px','18px','16px','15px','14px','22px','20px'],
  reason:'página do celular não carrega style.css: só os tokens de movimento entram pelo phone-cast.cjs, então tamanho/raio literais são o contrato dela'
 },
 {
  file:'src/readers.css',kind:'font-size',
  values:['clamp(13px,3.1cqw,16px)'],
  reason:'a folha vazia do leitor escala o texto pela largura do painel (container query), não por degrau de tipo'
 },
 {
  file:'src/model-picker.css',kind:'font-size',
  values:['7px','6px','8px'],
  reason:'glifo dentro do selo/monograma de provedor, com caixa fixa de 7–13px; não é texto de interface'
 },
 {
  file:'src/header.css',kind:'font-size',
  values:['8px'],
  reason:'monograma de 16px do provedor no indicador de modelo: glifo de desenho, não texto'
 },
 {
  file:'src/trio.css',kind:'font-size',
  values:['26px','18px'],
  reason:'glifo do mascote: tamanho do desenho, não tamanho de texto'
 },
 {
  file:'src/first-run.css',kind:'color',
  values:['rgba(255,255,255,.22)','#fff','#cfcfcf'],
  reason:'miniatura ilustrativa: a folha da miniatura é fixa nos dois temas, como a arte da primeira abertura'
 },
 {
  file:'src/first-run.css',kind:'box-shadow',
  values:['0 0 0 3px var(--ring-shadow,transparent)'],
  reason:'bug existente: o valor aninhado de --ring-shadow é inválido e a declaração é descartada; corrigir mudaria o foco do campo nesta etapa'
 }
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

const used=new Set();
/** Exceção que cobre arquivo/tipo/valor, ou null. @param {string} file @param {string} kind @param {string} value */
function exceptionFor(file,kind,value){
 return EXCEPTIONS.find(item=>item.file===file&&item.kind===kind&&item.values.includes(value))||null;
}

test('tipo, cor e sombra: nada literal nas folhas fora de style.css',()=>{
 const offenses=[];
 for(const file of cssFiles()){
  const rel=path.relative(DESK,file).split(path.sep).join('/');
  if(rel==='style.css'||rel.startsWith('src/materials/'))continue;
  const css=withoutComments(fs.readFileSync(file,'utf8'));
  const report=(kind,match,value)=>{
   const exception=exceptionFor(rel,kind,value);
   if(exception){used.add(`${exception.file}|${kind}|${value}`);return;}
   const selector=selectorAt(css,match.index);
   const line=css.slice(0,match.index).split('\n').length;
   offenses.push(`${rel}:${line} ${selector} ${kind}: "${value}"`);
  };
  for(const match of css.matchAll(/font-size\s*:\s*([^;}]+)/g)){
   const value=match[1].trim();
   if(PX.test(value))report('font-size',match,value);
  }
  for(const match of css.matchAll(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g)){
   report('color',match,match[1].trim());
  }
  for(const match of css.matchAll(/box-shadow\s*:\s*([^;}]+)/g)){
   const value=match[1].trim();
   const allowed=value==='none'||SHADOW_TOKENS.has(value)||RING.test(value);
   if(!allowed)report('box-shadow',match,value);
  }
 }
 assert.deepEqual(offenses,[],`valor literal fora dos tokens (arquivo:linha seletor tipo: valor):\n${offenses.join('\n')}`);
 for(const item of EXCEPTIONS){
  for(const value of item.values){
   assert.ok(used.has(`${item.file}|${item.kind}|${value}`),`exceção sem uso: ${item.file} ${item.kind} "${value}" (${item.reason}) — remova da lista ou devolva o uso`);
  }
 }
});
