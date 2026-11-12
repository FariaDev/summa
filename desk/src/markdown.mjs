import {marked} from '../node_modules/marked/lib/marked.esm.js';
import DOMPurify from '../node_modules/dompurify/dist/purify.es.mjs';
import {highlightCode} from '../highlight.mjs';
import {icon} from '../icons.mjs';
import {t} from './ui-text.mjs';
import {build,htmlNode} from './view-host.mjs';
import talkCore from './generated/talkview.core.js';
import {plotFigure} from './figures/plot-figure.mjs';
import {svgSafeConfig} from './figures/svg-guard.mjs';
import {svgFence} from './figures/svg-fence.mjs';
import {dropBlankSvg,svgFallbackHtml} from './figures/svg-blank.mjs';
import {createMathCache} from './math-cache.mjs';
import {cachedMarkup,setMarkupPipeline} from './history-render-cache.mjs';
import {mathPattern,openMathRange,codeRanges} from './stream-blocks.mjs';
import {modelAttrsPresent,stripModelAttrs} from './model-attrs.mjs';
export {modelAttrsPresent,stripModelAttrs} from './model-attrs.mjs';

/* Renderer Markdown+LaTeX compartilhado (chat principal e chat lateral). Mesmo
   pipeline do chat.mjs de sempre: o host reescreve fórmulas/figuras como
   placeholders, o marked gera o HTML, o realce de código sai fora do DOMPurify
   (spans não são tags seguras lá) e a figura/`codeblock` viram árvore do
   `core/talkview.bend` (`decorateCode`). Nada aqui conhece o DOM da conversa —
   recebe um elemento e mexe dentro dele. */

/* Versão do pipeline que entra na chave do cache de HTML (#120): mudar as
   bibliotecas, a configuração de sanitização abaixo, as figuras, o realce ou a
   passagem de atributos do modelo exige subir o número. O marked não expõe a
   versão em runtime (e o renderer não pode importar `package.json`): o número
   acompanha a dependência fixada no `package.json`/lock. O KaTeX também entra
   por número: desde o import sob demanda (#desempenho) ele não existe quando o
   módulo carrega, e ler `katex.version` aqui quebrava o arquivo inteiro. */
const MARKED_VERSION='18.1.2';
const KATEX_VERSION='0.19.1';
const MARKUP_PIPELINE=`marked=${MARKED_VERSION};katex=${KATEX_VERSION};dompurify=${DOMPurify.version};sanitize=2;figures=1;highlight=1;model-attrs=1`;
setMarkupPipeline(MARKUP_PIPELINE);

const ASSET_EXT=/\.(?:png|jpe?g|gif|webp|svg)$/i;
const ASSET_LOCAL=/^(?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])/i;
const ASSET_MARKDOWN=/!\[([^\]]*)\]\(\s*(?:<([^<>]+)>|((?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])[^)]*?\.(?:png|jpe?g|gif|webp|svg))(?:\s+"[^"]*")?)\s*\)/gi;
export function assetSource(value){const text=String(value||'').trim();return ASSET_LOCAL.test(text)&&ASSET_EXT.test(text.split(/[?#]/)[0]);}
export function assetLocalPath(value){const text=String(value||'').trim();if(!text||text.length>4096||/[\n\r]/.test(text)||!assetSource(text))return '';return text;}
export function attrValue(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
/* O marked entrega o código já escapado (&gt;, &amp;) e o realce escapa de novo — sem isso
   o bloco mostra "=&gt;" e "&amp;&amp;" na tela. Desescape único (o inverso exato do marked). */
function unescHtml(value){return String(value).replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'",'#x27':"'"}[e]));}
/* KaTeX (#desempenho): 603 KiB que só importam quando um texto com fórmula
   aparece. O primeiro desenho não espera o import — a fórmula vira um marcador
   vazio e, quando o módulo chega, o marcador é trocado pelo HTML do KaTeX no
   lugar. Assim a fórmula nunca aparece crua nem pisca com o resultado errado;
   quem pode esperar (histórico e testes de janela) chama `ensureMath` antes.
   O import entra por parâmetro para o teste simular a falha sem quebrar o
   arquivo do KaTeX (#desempenho). */
let katex=null,katexPromise=null,mathObserver=null,mathObserverTimer=0;
let mathImport=()=>import('../node_modules/katex/dist/katex.mjs');
const MATH_PENDING_CLASS='math-loading';
const MATH_MARKER_SELECTOR=`.${MATH_PENDING_CLASS}[data-math-tex]`;
/* Configuração única do desenho sanitizado do chat e da hidratação do KaTeX:
   a mesma guarda de SVG e as mesmas tags proibidas. */
const MARKUP_SANITIZE={FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['srcset']};
function renderKatex(tex,display){
 const source=display?`$$${tex}$$`:`$${tex}$`;
 try{return katex.renderToString(tex,{displayMode:display,throwOnError:false,trust:false}).replace('<span',()=>`<span data-tex="${attrValue(source)}"`);}catch{return null;}
}
function pendingKatex(tex,display){
 /* Primeira fórmula da sessão: o desenho sai agora e o import começa aqui; o
    `.then` do `ensureMath` troca os marcadores no DOM. O `data-tex` acompanha a
    fonte desde já para copiar/citar a fórmula mesmo pendente. */
 ensureMath();
 const source=attrValue(display?`$$${tex}$$`:`$${tex}$`);
 const marker=`<span class="${MATH_PENDING_CLASS}" data-math-tex="${source}" data-tex="${source}"></span>`;
 return display?`<span class="katex-display">${marker}</span>`:marker;
}
/* Uma repintura do stream reencontra todas as fórmulas já fechadas: o cache
   guarda o HTML por TeX+modo e evita renderizar de novo o que não mudou. O
   marcador provisório também é cacheado; o reset no import o descarta. */
const mathCache=createMathCache((tex,display)=>katex?renderKatex(tex,display):pendingKatex(tex,display));
/**
 * Garante o KaTeX carregado. Chamar antes de pintar um texto com fórmula evita
 * o marcador provisório; sem isso, o import chega e troca os marcadores no DOM.
 * A falha não fica presa: o próximo uso tenta de novo. O carregador entra por
 * parâmetro para o teste simular a falha (#desempenho).
 * @param {() => Promise<any>} [importModule]
 * @returns {Promise<void>}
 * @example await ensureMath(); markup('$x^2$');
 */
export function ensureMath(importModule = mathImport){
 mathImport=importModule;
 if(katex)return Promise.resolve();
 if(!katexPromise){
  katexPromise=mathImport()
   .then((module)=>{katex=module.default||module;mathCache.reset();hydrateMath();holdLateMarkers();})
   .catch((error)=>{failMath(error);katexPromise=null;});
 }
 return katexPromise;
}
/* O import falhou: o marcador deixa de ser um espaço vazio e mostra o TeX cru
   como texto (o DOM escapa), com o `data-tex` do render normal para copiar e
   citar. O log é uma linha por tentativa, sem caminho pessoal; a próxima
   fórmula zera o cache e tenta o import de novo (#desempenho). */
function failMath(error){
 try{
  const line=`KaTeX: import falhou; fórmula em TeX cru (${error?.message||error})`;
  globalThis.window?.desk?.logError?.(line)?.catch?.(()=>{});
 }catch{}
 mathCache.reset();
 if(typeof document==='undefined')return;
 for(const marker of document.querySelectorAll(MATH_MARKER_SELECTOR))marker.textContent=marker.dataset.mathTex||'';
}
/**
 * Troca cada marcador do subtree pelo HTML final do KaTeX, quando ele já
 * chegou; o wrapper de bloco é preservado para o layout não pular de inline
 * para display. Quem insere HTML desenhado antes do import (mensagem,
 * histórico) chama isto no subtree inserido, para nenhum marcador ficar órfão
 * (#desempenho). Sem KaTeX é inofensivo.
 * @param {ParentNode|null} root
 * @returns {void}
 * @example hydrateMathIn(messageBody);
 */
export function hydrateMathIn(root){
 if(!katex||!root?.querySelectorAll)return;
 for(const marker of root.querySelectorAll(MATH_MARKER_SELECTOR)){
  const source=marker.dataset.mathTex||'';
  const display=marker.parentElement?.classList.contains('katex-display')===true;
  const tex=display?source.slice(2,-2):source.slice(1,-1);
  const rendered=renderKatex(tex,display);
  if(!rendered)continue;
  /* O desenho estático passa pelo DOMPurify; a hidratação usa a mesma faixa
     para o HTML final ficar idêntico ao de antes do import. */
  const html=DOMPurify.sanitize(rendered,svgSafeConfig(DOMPurify,MARKUP_SANITIZE));
  const holder=document.createElement('template');
  holder.innerHTML=html;
  const replacement=holder.content.firstElementChild;
  if(!replacement)continue;
  (display?marker.parentElement:marker)?.replaceWith(replacement);
 }
}
function hydrateMath(){
 if(typeof document!=='undefined')hydrateMathIn(document);
}

/* Um desenho feito antes do import pode ser inserido no DOM depois que o
   `.then` já varreu a página (stream que repinta a cada 80 ms). O observador
   pega esses marcadores atrasados e desaparece quando eles param de chegar. */
function holdLateMarkers(){
 if(typeof document==='undefined')return;
 if(!mathObserver&&typeof MutationObserver==='function'){
  mathObserver=new MutationObserver((mutations)=>{
   for(const mutation of mutations){
    for(const node of mutation.addedNodes){
     if(node?.nodeType!==1)continue;
     if(node.matches?.(MATH_MARKER_SELECTOR)||node.querySelector?.(MATH_MARKER_SELECTOR)){hydrateMath();scheduleMathObserverStop();return;}
    }
   }
  });
  mathObserver.observe(document.documentElement,{childList:true,subtree:true});
 }
 scheduleMathObserverStop();
}
function scheduleMathObserverStop(){
 clearTimeout(mathObserverTimer);
 mathObserverTimer=setTimeout(()=>{hydrateMath();mathObserver?.disconnect();mathObserver=null;},2000);
}
/* Faixa do modelo antes dos nossos (#seg-markup): o `marked.parse` entrega o
   HTML do modelo cru (fórmula, figura, asset e código ainda são texto
   `PLACEHOLDER` nessa hora) e os nossos entram depois — então o que tem
   atributo aqui é do modelo, sem isenção por marca que ele também sabe
   escrever (`<span class="katex">` não vale). A passagem Allowlist
   (`model-attrs.mjs`) só roda quando a checagem barata acha atributo fora de
   código; SVG/MathML do modelo fora de cerca passam pela mesma regra. */
/* Contador de `marked.parse` para a sonda de desempenho: cada `markup` faz
   exatamente uma chamada. A repintura incremental só conta o trecho novo. */
let markupCalls=0;
let markupStrips=0;
export function markupStats(){return {calls:markupCalls,math:mathCache.stats(),strips:markupStrips};}
export function resetMarkupStats(){markupCalls=0;markupStrips=0;mathCache.reset();}
export function markup(text,allowAssets=true){
 markupCalls++;
 const math=[],assets=[];
 const value=String(text??'');
 const codeSpans=value?codeRanges(value):[];
 const inCode=(index,length)=>codeSpans.some(range=>index<range.end&&index+(length||0)>range.start);
 const withMath=value.replace(mathPattern(),(match,a,b,c,d,offset)=>{if(inCode(offset,match.length))return match;const n=math.length,tex=a??b??c??d,display=a!==undefined||b!==undefined;math.push(mathCache.render(tex,display)??match);return `MATHPLACEHOLDER${n}END`;});
 const protectedText=withMath.replace(ASSET_MARKDOWN,(match,alt,bracketed,plain)=>{const source=(bracketed??plain??'').trim();if(!assetSource(source))return match;if(!allowAssets)return `\`${source}\``;assets.push({source,alt:(alt||'').trim()});return `ASSETPLACEHOLDER${assets.length-1}END`;});
 let html=marked.parse(protectedText,{breaks:true});
 /* SVG solto que a guarda esvaziaria (#150): a cerca já virava código, mas o
    inline sumia calado e deixava um quadro em branco. O original é guardado
    antes da faixa e o token vira aviso + código depois do DOMPurify, como o
    bloco de código da cerca. */
 const blankSvgs=dropBlankSvg(html,DOMPurify,MARKUP_SANITIZE);
 html=blankSvgs.html;
 if(modelAttrsPresent(html)){html=stripModelAttrs(html);markupStrips++;}
 // realce dos blocos de código: fora do DOMPurify via placeholder (os spans não são tags seguras lá)
 const codes=[];
 html=html.replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g,(all,lang,code)=>{
  /* Cerca `plot` (#60): vira a figura (ou o aviso) e segue pelo DOMPurify junto com o resto. */
  if(lang==='plot')return plotFigure(unescHtml(code)).html;
  const svg=svgFence(unescHtml(code),lang);
  if(svg)return svg.html;
  codes.push(`<pre class="hl"><code data-lang="${attrValue(lang||'')}">${highlightCode(unescHtml(code),lang)}</code></pre>`);
  return `CODEPLACEHOLDER${codes.length-1}END`;
 });
 html=html.replace(/MATHPLACEHOLDER(\d+)END/g,(_,n)=>math[n]);
 const figure=n=>{const asset=assets[Number(n)];return `<figure class="asset" data-asset="${attrValue(asset.source)}"${asset.alt?` data-caption="${attrValue(asset.alt)}"`:''}></figure>`;};
 html=html.replace(/<p>\s*ASSETPLACEHOLDER(\d+)END\s*<\/p>/g,(_,n)=>figure(n)).replace(/ASSETPLACEHOLDER(\d+)END/g,(_,n)=>figure(n));
 return DOMPurify.sanitize(html,svgSafeConfig(DOMPurify,MARKUP_SANITIZE))
  .replace(/CODEPLACEHOLDER(\d+)END/g,(_,n)=>codes[Number(n)]||'')
  .replace(/SVGEMPTY(\d+)END/g,(_,n)=>svgFallbackHtml(blankSvgs.sources[Number(n)]||''));
}
/* Histórico (#120): o mesmo `markup`, mas reaproveitando o HTML sanitizado
   quando texto, imagens, idioma e pipeline não mudaram. O stream vivo não passa
   por aqui — a bolha só entra no cache quando fecha. */
/**
 * Markdown do histórico com cache de HTML sanitizado.
 * @param {unknown} text Markdown já passado pelo `displayUserText`
 * @param {boolean} [allowAssets]
 * @param {any[]} [images] imagens da mensagem (entram na chave, não no HTML)
 * @returns {string} a mesma saída de `markup`, cacheada por conteúdo
 * @example markupCached('**oi**', true, [])
 */
export function markupCached(text,allowAssets=true,images=[]){
 /* Antes do import do KaTeX a fórmula sai como marcador provisório; guardar
    esse HTML faria o histórico reaberto mostrar marcador em vez de pedir o
    desenho. Só entra no cache o HTML sem marcador. */
 const early=katex?null:markup(text,allowAssets);
 if(early?.includes(MATH_PENDING_CLASS))return early;
 return cachedMarkup(text,allowAssets,images,()=>early??markup(text,allowAssets));
}
/* Markdown+LaTeX de um trecho curto (opção de quiz, observação): sem o <p>
   externo quando é um parágrafo só. Sem assets — é rótulo, não figura. */
export function markupInline(text){const html=markup(text,false);const single=/^<p>([\s\S]*?)<\/p>\s*$/.exec(html);return single?single[1]:html;}
/* O stream vivo com fórmula sem fechamento (auditoria rodada 5, D3): o
   delimitador aberto (`$$`, `\[`, `\(` ou `$` com cara de fórmula) não aparece
   como fonte crua — vira uma linha quieta até fechar, e fechou renderiza. O
   desenho final (`markup`) mostra o texto como está, sem perder nada; preço
   ("custa $5 e $6") nunca é fórmula. Uma chamada só, como o `markup`. */
const MATH_PENDING_SENTINEL='MATHPENDING0END';
function escapePending(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
/**
 * @param {string} text Markdown já passado pelo `displayUserText`
 * @param {boolean} [allowAssets]
 * @returns {string} HTML sanitizado, com a fórmula aberta como linha quieta
 * @example markupLive('veja $$\int_0^1') // HTML com .math-pending, sem '$$'
 */
export function markupLive(text,allowAssets=true){
 const value=String(text??'');
 const range=openMathRange(value);
 if(!range)return markup(value,allowAssets);
 /* Só o trecho aberto vira linha quieta (auditoria rodada 5, D3): o que vem
    depois de `range.end` continua aparecendo no vivo. Uma chamada só. */
 const html=markup(value.slice(0,range.start)+MATH_PENDING_SENTINEL+value.slice(range.end),allowAssets);
 return html.replace(MATH_PENDING_SENTINEL,()=>`<span class="math-pending">${escapePending(t('talk.mathPending'))}</span>`);
}
/* A moldura `.codeblock` (etiqueta da linguagem + botão cópia) é árvore do
   `core/talkview.bend`; o `<pre>` realçado já veio do `markup`. */
export function decorateCode(body){
 for(const pre of body.querySelectorAll('pre')){
  if(pre.parentElement?.classList.contains('codeblock'))continue;
  const lang=(pre.querySelector('code')?.dataset.lang||'').trim();
  const block=build(talkCore.codeBlock(htmlNode(pre.outerHTML),lang.toUpperCase()));
  /* O botão de copiar é ícone (o mesmo da mensagem), com o nome acessível do núcleo. */
  const copy=block.querySelector('.code-copy');
  if(copy){copy.innerHTML=icon('copy');copy.title=t('talk.copy');}
  pre.replaceWith(block);
 }
}
