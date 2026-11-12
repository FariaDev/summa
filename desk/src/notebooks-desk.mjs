// @ts-check
import {S,toast} from './state.mjs';
import {getTabsCourses} from './header-tabs.mjs';
import {initNotebooks} from './notebooks.mjs';

export {toggleNotebooks,closeNotebooks} from './notebooks.mjs';

/** Liga a biblioteca de cadernos (#133) às fontes reais da Mesa: lista e
 *  abertura vêm do preload, matérias das abas, matéria atual do estado e o
 *  erro vai para o toast. Mora fora do `tutor-header.mjs` para ele caber no
 *  teto de 500 linhas sem comprimir código (tests/file-size.test.mjs); a vista
 *  (`notebooks.mjs`) segue sem depender do DOM global nos testes de unidade.
 *  Este módulo inteiro entra sob demanda por `notebooks-boot.mjs` (#desempenho).
 *  @param {()=>void} closePops fecha os popovers do cabeçalho antes de abrir
 *  @returns {{close:()=>void}}
 *  @example initDeskNotebooks(()=>closeTutorPops()); // no initTutorHeader
 */
export function initDeskNotebooks(closePops){
 return initNotebooks({
  list:()=>window.desk.notebookLibrary(),
  open:payload=>window.desk.openNotebook(payload),
  search:query=>window.desk.searchNotebooks(query),
  inkStatus:()=>window.desk.notebooksInkStatus(),
  inkSet:on=>window.desk.notebooksInkSet({on}),
  courses:()=>getTabsCourses(),
  currentCourseId:()=>S.currentCourseId,
  notify:message=>toast(message),
  closePops
 });
}
