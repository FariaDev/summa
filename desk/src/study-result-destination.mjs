// @ts-check
/* Destino de um resultado da busca de estudos: cada tipo abre no lugar dele
   (revisão, chat lateral, nota, PDF, conversa). Saiu de `main.mjs` quando a
   #166 e a #143 juntas o levaram a 801 linhas, acima do teto de 800 do
   `tests/file-size.test.mjs`; `main.mjs` fica com a troca de matéria/sessão. */
import {toast} from './state.mjs';
import {t} from './ui-text.mjs';
import {selectTab} from './header-tabs.mjs';
import {selectTab as selectSupportTab} from './support.mjs';
import {openSavedSidechat,revealSidechatMessage} from './sidechat-loader.mjs';
import {openPdfNotes} from './pdf-notes-loader.mjs';
import {openRef} from './nav-loader.mjs';
import {revealHistoryMessage,afterHistoryLayout} from './chat.mjs';

/**
 * Abre o destino de um resultado já resolvido pelo host, com a matéria e a
 * sessão certas carregadas. Devolve se o destino abriu.
 * @param {any} destination `result.destination` de `studySearchOpen`
 * @param {any} hit o resultado da busca (id, trecho, índice da mensagem)
 * @param {any} sidechat o lateral salvo, quando o destino é o lateral
 * @param {{annotate?: boolean}} [options] abrir as notas do PDF junto
 * @returns {Promise<boolean>}
 * @example await openStudyDestination({kind:'review'}, hit, null) // true
 */
export async function openStudyDestination(destination,hit,sidechat,{annotate=false}={}){
 if(destination.kind==='review'){selectTab('review');return true;}
 /* #183: o lateral também abre na fala encontrada, como o principal. */
 if(destination.kind==='sidechat'){
  selectSupportTab('chat');await openSavedSidechat(sidechat);await afterHistoryLayout();
  revealSidechatMessage(destination.messageIndex??hit?.messageIndex,hit?.snippet);return true;
 }
 if(destination.kind==='note'){
  if(destination.unavailable)toast(t('study.noteMaterialGone'));
  else await openRef(destination.name,destination.page,destination.path);
  openPdfNotes({path:destination.path,name:destination.name,page:destination.page});return true;
 }
 if(['pdf','material'].includes(destination.kind)){
  const opened=await openRef(destination.name,destination.page||1,destination.path);
  if(annotate&&opened)openPdfNotes({path:destination.path,name:destination.name,page:destination.page||1});
  return opened;
 }
 /* #143: o resultado de conversa abre na fala encontrada, não no fim. */
 if(destination.kind==='conversation'){await afterHistoryLayout();revealHistoryMessage(destination.messageIndex??hit?.messageIndex,hit?.snippet);return true;}
 return true;
}
