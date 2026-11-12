/* Rótulos e formas curtas do diário de trabalho (etapa 4): duração, nome da
   ferramenta como o aluno lê, alvo da linha de leitura e duração do passo.
   Puro e sem DOM; worklog.mjs reexporta para os testes e a visão. */
import {t} from './ui-text.mjs';

/**
 * Duração curta em segundos ou minutos.
 * @param {number} ms milissegundos decorridos; 0 vira "1s" como no diário
 * @returns {string} rótulo traduzido
 * @example formatDuration(3000) // '3s'
 */
export function formatDuration(ms){
 const s=Math.max(1,Math.round(Number(ms||0)/1000));
 if(s<60)return t('work.duration.s',{s});
 const m=Math.floor(s/60),rest=s%60;
 return rest?t('work.duration.minSec',{m,s:rest}):t('work.duration.min',{m});
}

/* Nome da ferramenta como o aluno a vê: o prefixo do MCP da Mesa não acrescenta
   nada na linha (`mcp__mesa__ler_pdf` e `mesa_ler_pdf` são o mesmo `ler_pdf`). */
export function toolDisplayName(name){
 return String(name||'').replace(/^mcp__mesa__/,'').replace(/^mesa_/,'');
}

/* Leitura de PDF: a ferramenta que o registro do turno mostra como "leitura". */
export function isPdfRead(step){
 return /ler_pdf$/i.test(toolDisplayName(step?.toolName));
}

function basename(file){
 return String(file||'').split(/[/\\]/).pop()||'';
}

/* Alvo da linha do diário: arquivo · página na leitura de PDF, termo/URL nas
   outras ferramentas. Vazio quando o app não tem o dado (nada é inventado). */
export function toolTarget(step){
 if(!step)return '';
 if(isPdfRead(step)){
  const args=step.args||{};
  const file=basename(args.caminho||args.path||'');
  const first=Math.max(0,Math.trunc(Number(args.pagina??args.page)||0));
  const last=Math.max(first,Math.trunc(Number(args.ate)||0));
  const pages=first>0?(last>first?`${first}–${last}`:String(first)):'';
  const parts=[file,pages?`p. ${pages}`:''].filter(Boolean);
  if(parts.length)return parts.join(' · ');
 }
 if(step.query)return `«${step.query}»`;
 if(step.pageTitle)return String(step.pageTitle);
 if(step.domain)return String(step.domain);
 if(step.url)return String(step.url);
 const args=step.args||{};
 const free=args.titulo||args.title||args.consulta||args.query;
 return free?String(free):'';
}

/* Duração de um passo quando início e fim são instantes reais; 0 ausente não
   vira "57 anos" (mesma regra do cabeçalho do diário). */
export function stepDuration(step){
 const started=Number(step?.startedAt), ended=Number(step?.endedAt);
 if(!(started>0)||!(ended>started))return '';
 return formatDuration(ended-started);
}
