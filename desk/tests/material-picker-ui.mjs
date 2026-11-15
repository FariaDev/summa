// node tests/material-picker-ui.mjs — o seletor de material do leitor (#74), na
// janela: a matéria de exemplo é inventada (PDFs gerados no teste, nada de
// material de curso). O `.pdf-select` continua sendo o valor e o nome acessível;
// o clique/teclado nele abre a busca (`role=combobox`) e a lista
// (`role=listbox`) com os PDFs da raiz no topo e cada subpasta como nó dentro da
// pasta mãe (título = último pedaço do caminho, em ordem natural),
// abertos/fechados pelo título. A busca filtra pelo nome e mostra o caminho de
// cada achado; escolher um PDF de subpasta
// abre o leitor. O fechamento de um grupo fica no estado de interface
// (`desk.json` → `courseStates`), fora do `config.json`, e sobrevive a reabrir a
// Mesa.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,
 freezeMotion,tinyPdf
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const readDesk=runtime=>JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
const readConfig=runtime=>JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));
const writePdf=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,tinyPdf(text));};

const GROUPS=['Cap 3 - Derivadas','Cap 10 - Integrais','Listas','2024'];
const closedCap3=page=>page.locator('.material-pop:not([hidden]) .material-group-head[data-folder="Cap 3 - Derivadas"]');

async function openPicker(page){
 const select=page.locator('#pdf-grid .pdf-panel').first().locator('.pdf-select');
 await select.click();
 const pop=page.locator('.material-pop:not([hidden])');
 await pop.waitFor({state:'visible',timeout:5000});
 return {select,pop,search:pop.locator('.material-search-input')};
}

await withArtifacts('seletor-material',async ctx=>{
 const runtime=ctx.runtime=newRuntime('materialpicker');
 const course=seedCourse(runtime,'calc');
 const rootPdf=path.join(course,'Apostila.pdf');
 writePdf(rootPdf,'Raiz da materia');
 writePdf(path.join(course,'Cap 3 - Derivadas','Aula 2.pdf'),'Derivadas aula 2');
 writePdf(path.join(course,'Cap 3 - Derivadas','Aula 10.pdf'),'Derivadas aula 10');
 writePdf(path.join(course,'Cap 10 - Integrais','Integrais.pdf'),'Integrais');
 writePdf(path.join(course,'Listas','Lista 1.pdf'),'Lista um');
 writePdf(path.join(course,'Listas','2024','Lista 2.pdf'),'Lista dois');
 const lista10=path.join(course,'Listas','2024','Lista 10.pdf');
 writePdf(lista10,'Lista dez');
 const integrais=path.join(course,'Cap 10 - Integrais','Integrais.pdf');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}],desk:{panels:[{label:'Enunciado',prefer:['Apostila']}],pinnedExtensions:false}});
 writeDeskJson(runtime,{courseId:'calc'});

 let app=ctx.app=await launchDesk({runtime});
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);

 /* ---- estrutura: combobox na busca, listbox e grupos com rótulo ---- */
 let {select,pop,search}=await openPicker(page);
 assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('material-search-input')),true,'ao abrir, o foco vai para a busca');
 assert.deepEqual(await search.evaluate((el)=>[el.getAttribute('role'),el.getAttribute('aria-autocomplete'),el.getAttribute('aria-expanded'),el.placeholder]),
  ['combobox','list','true','Buscar materiais…']);
 const list=pop.locator('.material-list');
 assert.equal(await list.getAttribute('role'),'listbox');
 assert.equal(await search.getAttribute('aria-controls'),await list.getAttribute('id'));
 assert.match(await search.getAttribute('aria-label'),/^Buscar material$/);
 assert.deepEqual(await pop.locator('.material-group-title').allTextContents(),GROUPS,'um grupo por subpasta, em ordem natural (Cap 3 antes de Cap 10)');
 assert.equal(await pop.locator('.material-group[role="group"]').count(),4);
 assert.equal(await pop.locator('.material-list > .material-group').count(),3,'só as pastas de nível 0 ficam na raiz');
 const listasTree=pop.locator('.material-group[role="group"]:has(.material-group-head[data-folder="Listas"])');
 assert.equal(await listasTree.locator('.material-group-head[data-folder="Listas/2024"]').count(),1,'o nó 2024 mora dentro do nó Listas');
 const leftOf=file=>pop.locator('.material-row[data-path="'+file+'"] .material-row-name').evaluate(el=>el.getBoundingClientRect().left);
 const lista1Left=await leftOf(path.join(course,'Listas','Lista 1.pdf'));
 const lista2Left=await leftOf(path.join(course,'Listas','2024','Lista 2.pdf'));
 assert.ok(lista2Left>lista1Left,`o arquivo de nível 2 recua mais que o de nível 1 (${lista2Left} > ${lista1Left})`);
 const labelled=await pop.locator('.material-group').first().getAttribute('aria-labelledby');
 assert.equal(await pop.locator(`#${labelled}`).getAttribute('role'),'option','o grupo é rotulado pelo título que abre e fecha');
 assert.equal(await pop.locator('.material-group-head[aria-expanded="true"]').count(),4,'os grupos abrem por padrão');
 assert.deepEqual(await pop.locator('.material-list > .material-row[data-path] .material-row-name').allTextContents(),['Apostila.pdf'],'os PDFs da raiz ficam no topo, sem grupo');
 assert.equal(await pop.locator('.material-row[data-path="'+rootPdf+'"]').getAttribute('aria-selected'),'true','o material aberto está marcado');
 const activeId=await search.getAttribute('aria-activedescendant');
 assert.equal(await page.locator(`#${activeId}`).getAttribute('role'),'option','a linha ativa do combobox é uma opção da lista');

 /* ---- abrir/fechar pelo título do grupo; o grupo fechado some da lista ---- */
 const cap3=closedCap3(page);
 await cap3.click();
 assert.equal(await cap3.getAttribute('aria-expanded'),'false');
 assert.equal(await pop.locator('.material-row[data-path="'+path.join(course,'Cap 3 - Derivadas','Aula 2.pdf')+'"]').count(),0,'os arquivos do grupo fechado saem da lista');
 await cap3.click();
 assert.equal(await cap3.getAttribute('aria-expanded'),'true','o mesmo título reabre o grupo');
 await cap3.click();
 assert.equal(await cap3.getAttribute('aria-expanded'),'false','fecha de novo para a busca e a memória');

 /* ---- busca: filtra pelo nome e mostra o grupo de cada achado ---- */
 await search.fill('lista');
 await pollUntil(()=>pop.locator('.material-group-title').allTextContents(),titles=>titles.join()==='Listas,2024',{what:'só os grupos com achado, com o 2024 dentro de Listas'});
 assert.deepEqual(await pop.locator('.material-row[data-path] .material-row-name').allTextContents(),['Lista 2.pdf','Lista 10.pdf','Lista 1.pdf'],'subpastas antes dos arquivos da pasta, ordem natural em cada uma');
 assert.deepEqual(await pop.locator('.material-row[data-path] .material-row-folder').allTextContents(),['Listas/2024','Listas/2024','Listas'],'cada achado mostra o caminho completo da pasta de origem');
 assert.equal(await pop.locator('.material-group-head[aria-expanded="true"]').count(),2,'com busca ativa os grupos aparecem abertos mesmo com o Cap 3 fechado');
 await search.fill('zzz');
 assert.equal(await pop.locator('.material-row[data-path]').count(),0);
 assert.equal(await pop.locator('.material-empty').isVisible(),true,'sem resultado: a mensagem aparece');
 assert.match(await pop.locator('.material-empty').innerText(),/Nenhum material com “zzz”\./);

 /* ---- escolher um PDF de subpasta abre o leitor ---- */
 await search.fill('lista 10');
 const option=pop.locator('.material-row[data-path="'+lista10+'"]');
 await option.click();
 await pop.waitFor({state:'hidden',timeout:5000});
 await pollUntil(()=>select.inputValue(),value=>value===lista10,{what:'o seletor com o PDF da subpasta'});
 await pollUntil(()=>page.evaluate(()=>document.querySelector('.pdf-viewport .textLayer')?.textContent||''),text=>text.includes('Lista dez'),{timeout:15000,what:'o leitor com o conteúdo do PDF escolhido'});

 /* ---- teclado: Esc fecha e devolve o foco; Enter na busca escolhe ---- */
 await select.click();
 pop=page.locator('.material-pop:not([hidden])');
 await pop.waitFor({state:'visible',timeout:5000});
 search=pop.locator('.material-search-input');
 await search.press('Escape');
 await pop.waitFor({state:'hidden',timeout:5000});
 assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('pdf-select')),true,'Esc devolve o foco ao seletor nativo');
 await page.keyboard.press('Enter');
 await pop.waitFor({state:'visible',timeout:5000});
 assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('material-search-input')),true,'Enter no seletor abre a busca');
 await page.keyboard.type('integrais');
 await pollUntil(()=>page.evaluate(()=>document.activeElement?.getAttribute('aria-activedescendant')),id=>!!id,{what:'a linha ativa do teclado'});
 await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
 await pop.waitFor({state:'hidden',timeout:5000});
 await pollUntil(()=>select.inputValue(),value=>value===integrais,{what:'o PDF escolhido pelo teclado'});

 /* ---- o grupo fechado fica no desk.json (estado de interface, não no config) ---- */
 await pollUntil(()=>readDesk(runtime),state=>state?.courseStates?.calc?.materialFolders?.['Cap 3 - Derivadas']===false,{what:'o grupo fechado no desk.json'});
 assert.equal(Object.hasOwn(readConfig(runtime),'materialFolders'),false,'o estado não vai para o config.json');
 assert.equal(Object.hasOwn(readConfig(runtime),'courseStates'),false);

 /* ---- reabrir a Mesa: o grupo fechado continua fechado ---- */
 await pollUntil(()=>readDesk(runtime).courseStates?.calc?.pdfs?.[0]?.path,value=>value===integrais,{what:'o PDF escolhido no desk.json'});
 await app.close();ctx.app=null;
 app=ctx.app=await launchDesk({runtime});
 page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 await pollUntil(()=>page.evaluate(()=>document.querySelector('.pdf-select')?.value||''),value=>value===integrais,{what:'o PDF escolhido de volta ao reabrir'});
 ({select,pop}=await openPicker(page));
 assert.equal(await closedCap3(page).getAttribute('aria-expanded'),'false','o grupo fechado antes de reabrir a Mesa continua fechado');

 assert.deepEqual(errors,[]);
 console.log('material-picker-ui: PASS — raiz no topo, subpastas aninhadas em ordem natural com recuo por nível, abre/fecha, busca com o caminho de cada achado, escolha de PDF de subpasta abre o leitor e o grupo fechado sobrevive ao reabrir (desk.json, fora do config.json).');
});
