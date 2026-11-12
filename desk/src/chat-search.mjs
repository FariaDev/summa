// @ts-check
/* Busca na conversa do tutor (#122), a parte pura: dobra de acento e caixa sem
   DOM e varredura das mensagens NA FONTE. O histórico longo nasce em casca
   (#118) e o texto rico só entra perto da vista, então a busca não pode varrer
   `innerText`: quem monta a fonte é o `showHistory` (os mesmos turnos do
   `historyTurns`), e o aplicador (`chat-search-view.mjs`) liga o resultado ao
   balão, formata a casca e destaca a ocorrência.

   O normalizador é o da busca de estudos (`foldSearch`, NFD + sem marcas), e a
   variante com mapa (`foldText`) devolve, para cada letra dobrada, o intervalo
   no texto ORIGINAL — é o que permite destacar "Formulário" ao buscar
   "formulario". */
import {foldSearch} from './model-picker.mjs';

/** @typedef {{text?: string, folded?: string|null}} SearchEntry */
/** @typedef {{text: string, el: Element, folded: string|null, source: boolean}} SearchSourceEntry */
/** @typedef {{entryIndex: number, occurrence: number}} SearchHit */
/** @typedef {{needle: string, total: number, hits: SearchHit[]}} SearchResult */

const SPACE=/\s/;

/** @param {{el: Element}} a @param {{el: Element}} b */
function domOrder(a,b){
  if(a.el===b.el||typeof a.el?.compareDocumentPosition!=='function')return 0;
  return a.el.compareDocumentPosition(b.el)&2?1:-1;
}

/**
 * Fonte ordenada da busca: o histórico entra inteiro (`set`) e a fala viva
 * entra ao terminar (`add`), atualizando a mesma bolha. Bolha desconectada
 * (envio recusado) sai da lista sozinha.
 * @returns {{set: (entries: Array<{text?: unknown, el?: Element|null}>|null) => void,
 *   add: (entry: {text?: unknown, el?: Element|null}) => SearchSourceEntry|null,
 *   get: (el: Element) => SearchSourceEntry|null, clear: () => void,
 *   list: () => SearchSourceEntry[]}}
 * @example createChatSearchSource().add({text:'fala',el:bubble}) // entry
 */
export function createChatSearchSource(){
  /** @type {SearchSourceEntry[]} */
  let entries=[];
  /** @type {WeakMap<Element, SearchSourceEntry>} */
  let byElement=new WeakMap();
  return {
    set(items){
      entries=[];
      byElement=new WeakMap();
      for(const item of Array.isArray(items)?items:[]){
        const el=item?.el;
        if(!el)continue;
        const entry={text:String(item.text??''),el,folded:null,source:true};
        entries.push(entry);
        byElement.set(el,entry);
      }
    },
    add(item){
      const el=item?.el;
      if(!el)return null;
      const text=String(item.text??'');
      const existing=byElement.get(el);
      if(existing){
        if(existing.text!==text){existing.text=text;existing.folded=null;}
        return existing;
      }
      const entry={text,el,folded:null,source:false};
      entries.push(entry);
      byElement.set(el,entry);
      return entry;
    },
    get(el){
      return el?byElement.get(el)||null:null;
    },
    clear(){
      entries=[];
      byElement=new WeakMap();
    },
    list(){
      return entries.filter(entry=>entry.el?.isConnected!==false).sort(domOrder);
    },
  };
}

/**
 * Texto dobrado para comparar: sem acento, sem caixa e com espaços colapsados.
 * @param {unknown} source
 * @returns {string} ex.: fold('  AÇÃO\n nova ') // 'acao nova'
 */
export function fold(source){
  return foldSearch(String(source??'')).replace(/\s+/g,' ');
}

/**
 * Igual a `fold`, mas guarda o intervalo original de cada letra dobrada.
 * Letras dobradas podem sumir (marcas combinantes) ou nunca mudar de tamanho
 * nos acentos latinos; o mapa cobre os dois casos.
 * @param {unknown} source
 * @returns {{folded: string, map: Array<{start: number, end: number}>}}
 * @example foldText('AÇÃO').map[1] // {start: 1, end: 2}
 */
export function foldText(source){
  const input=String(source??'');
  let folded='';
  /** @type {Array<{start: number, end: number}>} */
  const map=[];
  let index=0;
  let lastSpace=false;
  for(const ch of input){
    const piece=SPACE.test(ch)?' ':foldSearch(ch);
    if(piece===' '){
      if(!lastSpace){
        folded+=' ';
        map.push({start:index,end:index+ch.length});
        lastSpace=true;
      }
      index+=ch.length;
      continue;
    }
    for(let i=0;i<piece.length;i++){
      folded+=piece[i];
      map.push({start:index,end:index+ch.length});
    }
    if(piece)lastSpace=false;
    index+=ch.length;
  }
  return {folded,map};
}

/**
 * Procura a consulta nas entradas (texto vindo da fonte, sem DOM) e devolve as
 * ocorrências em ordem. A dobra fica no cache de cada entrada: digitar de novo
 * ou navegar não redobra a conversa inteira.
 * @param {SearchEntry[]} entries
 * @param {unknown} query
 * @returns {SearchResult}
 * @example searchEntries([{text:'Passo a passo'}], 'PASSO') // 2 ocorrências
 */
export function searchEntries(entries, query){
  /** @type {SearchResult} */
  const result={needle:fold(query).trim(),total:0,hits:[]};
  if(!result.needle)return result;
  const list=Array.isArray(entries)?entries:[];
  for(let entryIndex=0;entryIndex<list.length;entryIndex+=1){
    const entry=list[entryIndex];
    if(!entry)continue;
    if(typeof entry.folded!=='string')entry.folded=fold(entry.text);
    let at=0;
    let occurrence=0;
    while((at=entry.folded.indexOf(result.needle,at))!==-1){
      result.hits.push({entryIndex,occurrence});
      occurrence+=1;
      at+=result.needle.length;
    }
  }
  result.total=result.hits.length;
  return result;
}

/**
 * Anda o índice da ocorrência com volta: depois da última vem a primeira; antes
 * da primeira vem a última. `-1` significa "nenhuma escolhida ainda".
 * @param {number} current índice 0-based (ou -1)
 * @param {number} total ocorrências encontradas
 * @param {number} [delta] 1 para a próxima, -1 para a anterior
 * @returns {number} o próximo índice, ou -1 sem ocorrências
 * @example stepHit(2, 3, 1) // 0
 * @example stepHit(-1, 3, -1) // 2
 */
export function stepHit(current,total,delta=1){
  const count=Math.max(0,Math.trunc(Number(total)||0));
  if(!count)return -1;
  const value=Number(current);
  const base=Number.isInteger(value)&&value>=0&&value<count?value:-1;
  if(base<0)return delta<0?count-1:0;
  const direction=Number(delta)<0?-1:1;
  return (base+direction+count)%count;
}
