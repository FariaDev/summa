// @ts-check
/* A frase do motivo que a coluna do tutor mostra (#23), sem o núcleo da faixa
   do Claude Code: a partida pinta a coluna e não precisa do
   `claudeversion.core.js` (52 KiB) para uma mensagem comum (#desempenho). */

/* O motivo é uma frase: a primeira do que o motor devolveu (o texto inteiro
   fica no log da Mesa). Quando a frase seguinte é uma instrução do motor
   ("Pi não encontrado. Rode npm run setup."), ela vem junto: é o que a pessoa
   precisa fazer (#23). Frase de contexto ("A sessão foi preservada…") não entra.
   O núcleo só apara; a coluna quebra em linhas em vez de cortar. */
const INSTRUCTION=/^(?:Rode|Indique|Instale|Reinstale|Atualize|Abra|Verifique|Confira|Escolha|Aponte|Configure|Defina|Reinicie|Use)\b/;
/** @param {string} text */
const sentenceEnd=text=>text.search(/[.!?](?=\s+\p{Lu})/u);
/**
 * A primeira frase do motivo (mais a instrução que vem logo depois).
 * @param {unknown} message
 * @returns {string}
 * @example reasonText('Error: Pi não encontrado. Rode npm run setup. Outra.') // 'Pi não encontrado. Rode npm run setup.'
 */
export function reasonText(message){
 const first=String(message??'').split(/\r?\n/).map(line=>line.trim()).find(Boolean)||'';
 /* O nome da classe do erro ("ClaudeAdapterError: …") não é frase para quem
    estuda (#51: a coluna mostrava "ClaudeAdapterError: Versão do Claude Code…"). */
 const clean=first.replace(/^[A-Za-z]*Error:\s*/i,'');
 const end=sentenceEnd(clean);
 if(end<=0)return clean;
 const head=clean.slice(0,end+1);
 const rest=clean.slice(end+1).trim();
 if(!INSTRUCTION.test(rest))return head;
 const next=sentenceEnd(rest);
 return `${head} ${next>0?rest.slice(0,next+1):rest}`;
}
