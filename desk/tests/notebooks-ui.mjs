// node tests/notebooks-ui.mjs — Vista da biblioteca de cadernos (#133, r2):
// o botão "Cadernos" do submenu Contexto abre o painel encaixado abaixo do
// cabeçalho, com os `.xopp` de cada matéria (a da aba atual primeiro); Enter
// abre via `openNotebook` e Esc/× fecham devolvendo o foco ao Mais opções.
// Medido na janela real, nos dois temas, em 1440×900 e 900×650. Capturas para
// olho humano em tests/artifacts/cadernos-… e em
// /tmp/claude-1000/r2-cadernos-composer-2/ (fora do git).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
  screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const out=screenshotDirectory('cadernos');
const columnShot=async(page,file)=>{const box=await page.locator('#chat').boundingBox();await page.screenshot({path:file,clip:box});};
const resize=async(ctx,page,width,height)=>{
  await resizeWindow(ctx.app,page,width,height,{content:true});
  await layoutStable(page,'main');
};
/* Contraste WCAG de duas cores rgb() medidas na janela. */
const contrast=(color,bg)=>{
  const parse=value=>String(value).match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number)||[0,0,0];
  const lum=rgb=>{const [r,g,b]=rgb.map(channel=>{const v=channel/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*b;};
  const [hi,lo]=[lum(parse(color)),lum(parse(bg))].sort((a,b)=>b-a);
  return (hi+0.05)/(lo+0.05);
};

/* Matéria fake com dois `.xopp` (um em subpasta, mais recente) e uma segunda
   matéria com um, para provar o agrupamento. O primeiro caderno é um gzip
   de verdade com uma página A4 (#166): a lista lê só o começo para a
   etiqueta; os outros nem são gzip e ficam sem etiqueta, como antes. */
const xoppA4=()=>zlib.gzipSync(Buffer.from('<?xml version="1.0"?><xournal version="1.2"><page width="595.275591" height="841.889764"><layer/></page></xournal>'));
function seed(tag){
  const runtime=newRuntime(tag);
  const calc=seedCourse(runtime,'calc'),fis=seedCourse(runtime,'fis');
  const pdf=path.join(calc,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
  const sub=path.join(calc,'sub');fs.mkdirSync(sub,{recursive:true});
  const nova=path.join(sub,'aula-nova.xopp'),antiga=path.join(calc,'aula-antiga.xopp'),ondas=path.join(fis,'ondas.xopp');
  fs.writeFileSync(nova,xoppA4());
  for(const file of [antiga,ondas])fs.writeFileSync(file,'caderno de teste');
  const now=new Date(),old=new Date(now.getTime()-2*86400000),older=new Date(now.getTime()-5*86400000);
  fs.utimesSync(nova,now,now);fs.utimesSync(antiga,old,old);fs.utimesSync(ondas,older,older);
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:calc,color:'#c02667'},{id:'fis',name:'Física',path:fis}]});
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  return {runtime,nova,antiga,ondas};
}

const openMenu=async page=>{
  if(await page.evaluate(()=>document.querySelector('#chat-more-pop')?.hidden!==false))await page.locator('#chat-more').click();
  await page.locator('#more-notebooks').waitFor({state:'visible',timeout:5000});
};
const openPopover=async page=>{
  await openMenu(page);
  await page.locator('#more-notebooks').click();
  await page.locator('#notebooks-pop').waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(()=>document.querySelector('.notebooks-row, .notebooks-empty'),undefined,{timeout:10000});
  assert.equal(await page.evaluate(()=>document.querySelector('#chat-more-pop')?.hidden===true),true,'ao abrir o painel, o menu Mais opções fecha');
  assert.equal(await page.evaluate(()=>document.querySelector('#context-dock')?.hidden!==false),true,'ao abrir os Cadernos, o painel Contexto fecha (só um painel por vez)');
};
const closePopover=async page=>{
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
};

await withArtifacts('notebooks',async ctx=>{
  const {runtime,nova}=ctx.seed=seed('notebooks');
  ctx.runtime=runtime;
  ctx.app=await launchDesk({runtime});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await resize(ctx,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

  /* O abrir do Xournal++ é falso no IPC: o handler real (spawn/shell) é
     trocado por um que só grava o pedido. Nenhum teste aqui abre o
     Xournal++ de verdade — e a prova é que o `shell`/spawn do host nunca
     roda, porque o handler nunca chega nele. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__opened=[];
    ipcMain.removeHandler('notebooks-open');
    ipcMain.handle('notebooks-open',async(_event,payload)=>{globalThis.__opened.push(payload);return {ok:true,path:payload.path};});
  });

  /* ---------- D2: o atalho abre e fecha o mesmo popover, com o foco na busca ---------- */
  const shortcut=process.platform==='darwin'?'Meta+Shift+K':'Control+Shift+K';
  const shortcutText=await page.evaluate(()=>window.mesaKeys.format('Mod+Shift+K'));
  /* r2: o botão ao lado do rascunho saiu; o atalho aparece no item do menu. */
  assert.equal(await page.locator('#notebooks-btn').count(),0,'o botão antigo de Cadernos saiu do painel de contexto');
  await openMenu(page);
  const menuShortcut=(await page.locator('#more-notebooks .menu-kbd').textContent()).trim();
  assert.equal(menuShortcut,shortcutText,`o item Cadernos mostra o atalho no menu (${menuShortcut} × ${shortcutText})`);
  await page.keyboard.press('Escape');
  await page.locator('#prompt').focus();
  await page.keyboard.press(shortcut);
  await page.locator('#notebooks-pop').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>document.querySelector('.notebooks-row, .notebooks-empty'),undefined,{timeout:10000});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'notebooks-search','D2: o atalho abre o popover Cadernos e leva o foco à busca');
  const shortcutShown=await page.evaluate(()=>({
    guide:document.querySelector('.guide-key[data-key="notebooks"] .guide-combo')?.textContent?.replace(/\s+/g,'')||'',
  }));
  assert.equal(shortcutShown.guide,shortcutText.replace(/\+/g,''),`D2: a lista de atalhos do Guia mostra o mesmo atalho (${JSON.stringify(shortcutShown)})`);
  await page.keyboard.press(shortcut);
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'prompt','D2: o mesmo atalho fecha e devolve o foco a quem abriu');

  /* ---------- r2: painel no fluxo, busca e leitura da tinta ---------- */
  const shots='/tmp/claude-1000/r2-cadernos-composer-2';
  fs.mkdirSync(shots,{recursive:true});
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    const hidden=await page.evaluate(()=>document.querySelector('#notebooks-pop')?.hidden===true);
    if(!hidden)await closePopover(page);
    await layoutStable(page,'main');
    await page.mouse.move(200,300);
    await page.evaluate(()=>document.activeElement?.blur());
    await columnShot(page,path.join(shots,`cadernos-fechado-${theme}.png`));
    await openMenu(page);
    await layoutStable(page,'main');
    await page.screenshot({path:path.join(shots,`contexto-cadernos-${theme}.png`)});
    await openPopover(page);
    await layoutStable(page,'main');
    await columnShot(page,path.join(shots,`cadernos-aberto-${theme}.png`));
    if(theme==='light'){
      const dock=await page.evaluate(()=>{
        const pop=document.querySelector('#notebooks-pop'),chat=document.querySelector('#chat');
        const head=document.querySelector('.chat-head'),messages=document.querySelector('#messages');
        const p=pop.getBoundingClientRect(),h=head.getBoundingClientRect(),c=chat.getBoundingClientRect(),m=messages.getBoundingClientRect();
        const style=getComputedStyle(pop);
        return {
          topGap:p.top-h.bottom,messageGap:Math.abs(p.bottom-m.top),
          width:pop.getBoundingClientRect().width,column:chat.clientWidth,leftGap:Math.abs(p.left-c.left),
          shadow:style.boxShadow,radius:style.borderTopLeftRadius,
          borderLeft:style.borderLeftWidth,borderRight:style.borderRightWidth,borderBottom:style.borderBottomWidth,
          maxHeight:style.maxHeight,height:p.height,columnHeight:c.height,messagesHeight:m.height,
        };
      });
      assert.ok(dock.topGap>=-1&&dock.topGap<=1,`o painel encaixa logo abaixo do cabeçalho (vão ${dock.topGap}px)`);
      assert.ok(dock.messageGap<=1,`a conversa começa no pé do painel (vão ${dock.messageGap}px)`);
      assert.ok(Math.abs(dock.width-dock.column)<=1,`o painel tem a largura da coluna (${dock.width} × ${dock.column})`);
      assert.ok(dock.leftGap<=1,`o painel encosta na borda esquerda da coluna (${dock.leftGap}px)`);
      assert.equal(dock.shadow,'none',`o painel encaixado não tem sombra (${dock.shadow})`);
      assert.equal(dock.radius,'0px',`o painel encaixado não tem cantos (${dock.radius})`);
      assert.equal(dock.borderLeft,'0px','sem fio lateral esquerdo');
      assert.equal(dock.borderRight,'0px','sem fio lateral direito');
      assert.equal(dock.borderBottom,'1px','só o fio de baixo separa o painel da conversa');
      assert.ok(dock.height<=dock.columnHeight*0.6+1,`o painel respeita os 60% da coluna (${dock.height.toFixed(1)} de ${dock.columnHeight.toFixed(1)})`);

      const field=await page.evaluate(()=>{
        const input=document.querySelector('#notebooks-search'),style=getComputedStyle(input),box=input.getBoundingClientRect();
        const panel=document.querySelector('#notebooks-pop').getBoundingClientRect();
        const icon=document.querySelector('.notebooks-search-field .guide-search-icon');
        const iconBox=icon?.getBoundingClientRect();
        return {
          height:box.height,fontSize:style.fontSize,border:style.borderTopWidth,background:style.backgroundColor,
          placeholder:input.getAttribute('placeholder'),
          icon:!!icon?.querySelector('svg'),iconLeft:iconBox?iconBox.left-box.left:null,
          leftGap:box.left-panel.left,rightGap:panel.right-box.right,
        };
      });
      assert.equal(field.height,40,`a busca tem 40px de altura (${field.height}px)`);
      assert.equal(field.fontSize,'14px',`a busca usa texto de 14px (${field.fontSize})`);
      assert.equal(field.border,'0px',`a busca é um campo sem borda (${field.border})`);
      assert.notEqual(field.background,'rgba(0, 0, 0, 0)',`a busca é um campo preenchido (${field.background})`);
      assert.equal(field.placeholder,'Buscar nos cadernos','o placeholder curto do r2');
      assert.equal(field.icon,true,'a busca tem a lupa à esquerda');
      assert.ok(field.iconLeft>=0&&field.iconLeft<=14,`a lupa fica à esquerda do campo (${field.iconLeft}px)`);
      assert.ok(Math.abs(field.leftGap-12)<=1,`a busca guarda 12px da borda esquerda do painel (${field.leftGap}px)`);
      assert.ok(Math.abs(field.rightGap-12)<=1,`a busca guarda 12px da borda direita do painel (${field.rightGap}px)`);

      const ink=await page.evaluate(()=>{
        const section=document.querySelector('.notebooks-ink'),style=getComputedStyle(section);
        const title=document.querySelector('.notebooks-ink-switch-text'),tStyle=getComputedStyle(title);
        const desc=document.querySelector('.notebooks-ink-desc'),dStyle=getComputedStyle(desc);
        const button=document.querySelector('#notebooks-ink-switch'),bStyle=getComputedStyle(button);
        const track=document.querySelector('.notebooks-ink-track')?.getBoundingClientRect();
        const probe=document.createElement('span');probe.style.color='var(--faint)';section.append(probe);
        const faint=getComputedStyle(probe).color;probe.remove();
        return {
          background:style.backgroundColor,borderTop:style.borderTopWidth,borderBottom:style.borderBottomWidth,
          borderLeft:style.borderLeftWidth,borderRight:style.borderRightWidth,radius:style.borderTopLeftRadius,
          weight:tStyle.fontWeight,descSize:dStyle.fontSize,descColor:dStyle.color,faint,
          buttonBg:bStyle.backgroundColor,buttonBorder:bStyle.borderTopWidth,
          trackW:track?.width??0,trackH:track?.height??0,
        };
      });
      assert.equal(ink.background,'rgba(0, 0, 0, 0)',`a leitura da tinta não tem fundo próprio (${ink.background})`);
      assert.equal(ink.borderTop,'1px','a leitura da tinta fica depois de um fio');
      assert.deepEqual([ink.borderBottom,ink.borderLeft,ink.borderRight],['0px','0px','0px'],'a leitura da tinta não tem caixa');
      assert.equal(ink.radius,'0px','a leitura da tinta não tem cantos');
      assert.equal(ink.weight,'400',`o nome fica em peso normal (${ink.weight})`);
      assert.equal(ink.descSize,'12px',`a descrição usa 12px (${ink.descSize})`);
      assert.equal(ink.descColor,ink.faint,`a descrição usa --faint (${ink.descColor})`);
      assert.equal(ink.buttonBg,'rgba(0, 0, 0, 0)',`o interruptor não tem fundo próprio (${ink.buttonBg})`);
      assert.equal(ink.buttonBorder,'0px',`o interruptor não tem borda própria (${ink.buttonBorder})`);
      assert.deepEqual([Math.round(ink.trackW),Math.round(ink.trackH)],[40,20],`interruptor 40×20 (${ink.trackW}×${ink.trackH})`);
    }
    await closePopover(page);
  }

  /* O clique fora não fecha o painel encaixado: ele não é mais sobreposto. */
  await setTheme(page,'light');
  await resize(ctx,page,1440,900);
  const closedMessages=await page.locator('#messages').evaluate(el=>el.getBoundingClientRect().height);
  await openPopover(page);
  const openMessages=await page.locator('#messages').evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(openMessages<closedMessages-40,`a conversa encolhe enquanto o painel está aberto (${closedMessages.toFixed(0)} → ${openMessages.toFixed(0)}px)`);
  await page.locator('#messages').click({position:{x:20,y:20}});
  await nextFrames(page,2);
  assert.equal(await page.evaluate(()=>document.querySelector('#notebooks-pop')?.hidden),false,'clicar fora não fecha o painel encaixado');
  await page.locator('#notebooks-close').click();
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'chat-more','o × fecha e devolve o foco ao botão Mais opções');

  /* ---------- lista, agrupamento e ordem (dois temas × dois tamanhos) ---------- */
  for(const [width,height] of [[1440,900],[900,650]]){
    await resize(ctx,page,width,height);
    for(const theme of ['light','dark']){
      await setTheme(page,theme);
      const tag=`${theme} ${width}x${height}`;
      await openPopover(page);
      assert.deepEqual(await page.locator('.notebooks-group').allTextContents(),['Cálculo I','Física'],`${tag}: matérias agrupadas, a da aba atual primeiro`);
      const titles=await page.locator('.notebooks-row .notebooks-title').allTextContents();
      assert.deepEqual(titles,['aula-nova.xopp','aula-antiga.xopp','ondas.xopp'],`${tag}: mais recente primeiro dentro de cada matéria`);
      const firstMeta=await page.locator('.notebooks-row').first().locator('.notebooks-meta').textContent();
      assert.match(firstMeta,/sub · /,`${tag}: a pasta relativa aparece na meta (${firstMeta})`);
      assert.match(firstMeta,/\d{2}:\d{2}/,`${tag}: a data aparece na meta (${firstMeta})`);
      await page.mouse.move(1,1);
      const iconFacts=await page.evaluate(()=>{
        const rows=[...document.querySelectorAll('.notebooks-row')];
        const first=rows[0],icon=first?.querySelector('.notebooks-icon'),meta=first?.querySelector('.notebooks-meta');
        if(!first||!icon||!meta)return null;
        const before=first.getBoundingClientRect().height;
        icon.style.display='none';
        const without=first.getBoundingClientRect().height;
        icon.style.display='';
        const list=document.querySelector('#notebooks-list');
        const sample=document.createElement('i');sample.style.cssText='position:fixed;color:var(--muted)';document.body.append(sample);
        const muted=getComputedStyle(sample).color;sample.remove();
        return {
          count:rows.length,
          icons:rows.every(row=>!!row.querySelector('.notebooks-icon')),
          hidden:rows.every(row=>row.querySelector('.notebooks-icon')?.getAttribute('aria-hidden')==='true'),
          muted,
          rows:rows.map(row=>({
            color:getComputedStyle(row.querySelector('.notebooks-icon')).color,
            metaColor:getComputedStyle(row.querySelector('.notebooks-meta')).color,
            badge:row.querySelector('.notebooks-format')?.textContent||'',
            label:row.getAttribute('aria-label')||'',
          })),
          width:icon.getBoundingClientRect().width,height:icon.getBoundingClientRect().height,
          before,without,
          fits:rows.every(row=>row.getBoundingClientRect().right<=list.getBoundingClientRect().right+1),
          noScroll:list.scrollWidth<=list.clientWidth+1,
        };
      });
      assert.ok(iconFacts,`${tag}: a linha tem ícone e meta para medir`);
      assert.equal(iconFacts.icons,true,`${tag}: cada caderno tem o ícone de livro`);
      assert.equal(iconFacts.hidden,true,`${tag}: o ícone é decorativo (aria-hidden)`);
      assert.equal(iconFacts.rows[0].color,'rgb(192, 38, 103)',`${tag}: a cor da matéria do config.json pinta o ícone (#166)`);
      assert.notEqual(iconFacts.rows[0].color,iconFacts.rows[0].metaColor,`${tag}: a cor da matéria não é o cinza da meta`);
      assert.equal(iconFacts.rows[2].color,iconFacts.muted,`${tag}: sem color no config.json o ícone cai em --muted (${iconFacts.rows[2].color})`);
      assert.equal(iconFacts.rows[0].badge,'A4',`${tag}: o formato lido do .xopp vira a etiqueta (${iconFacts.rows[0].badge})`);
      assert.match(iconFacts.rows[0].label,/, A4$/,`${tag}: a etiqueta entra no rótulo acessível (${iconFacts.rows[0].label})`);
      assert.deepEqual(iconFacts.rows.slice(1).map(row=>row.badge),['',''],`${tag}: caderno sem formato conhecido não ganha etiqueta`);
      assert.ok(iconFacts.width>=12&&iconFacts.height>=12,`${tag}: o ícone é pequeno mas visível (${iconFacts.width}×${iconFacts.height})`);
      assert.ok(Math.abs(iconFacts.before-iconFacts.without)<=1,`${tag}: o ícone não muda a altura da linha (${iconFacts.before} vs ${iconFacts.without})`);
      assert.equal(iconFacts.fits,true,`${tag}: as linhas cabem na largura da lista`);
      assert.equal(iconFacts.noScroll,true,`${tag}: a lista não ganha rolagem horizontal`);
      const box=await page.locator('#notebooks-pop').boundingBox();
      assert.ok(box&&box.width>0&&box.height>0&&box.x+box.width<=width+0.5&&box.y+box.height<=height+0.5,`${tag}: popover dentro da janela (${JSON.stringify(box)})`);
      await page.waitForFunction(()=>document.activeElement?.id==='notebooks-search',undefined,{timeout:5000});
      await page.screenshot({path:path.join(out,`cadernos-${theme}-${width}.png`)});
      await closePopover(page);
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'chat-more',`${tag}: Esc fecha e devolve o foco ao botão Mais opções`);
    }
  }

  /* ---------- complemento #166: Salvar as Configurações mantém a cor ---------- */
  /* O `readSettingsForm` reconstrói cada matéria só com o que está na tela;
     sem recolocar a cor da matéria de mesmo id, o config em memória (e a
     lista de cadernos) perde a cor até reabrir o app. */
  await setTheme(page,'light');
  await resize(ctx,page,1440,900);
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  await page.locator('#settings-tab-mesa').click();
  await page.locator('#cfg-title').fill('Mesa do teste');
  await page.locator('#settings-save').click();
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog')?.open,undefined,{timeout:10000});
  const savedColor=await page.evaluate(async()=>{
    const config=(await window.desk.getConfig()).config;
    return config.courses?.find(course=>course.id==='calc')?.color||'';
  });
  assert.equal(savedColor,'#c02667','Salvar as Configurações mantém a cor da matéria no config em memória (#166)');
  await openPopover(page);
  const colorAfterSave=await page.evaluate(()=>getComputedStyle(document.querySelector('.notebooks-row .notebooks-icon')).color);
  assert.equal(colorAfterSave,'rgb(192, 38, 103)','depois de Salvar, o ícone do caderno continua com a cor da matéria (#166)');
  await closePopover(page);

  /* ---------- N2: a ordem do Tab acompanha a tela (campo → linhas → tinta) ---------- */
  await setTheme(page,'light');
  await resize(ctx,page,1440,900);
  await openPopover(page);
  await page.locator('#notebooks-ink-switch').waitFor({timeout:10000});
  const tabStops=[];
  for(let step=0;step<4;step+=1){
    await page.keyboard.press('Tab');
    tabStops.push(await page.evaluate(()=>{
      const el=document.activeElement;
      if(el?.classList?.contains('notebooks-row'))return el.querySelector('.notebooks-title')?.textContent||'';
      return el?.id||'';
    }));
  }
  assert.deepEqual(tabStops,['aula-nova.xopp','aula-antiga.xopp','ondas.xopp','notebooks-ink-switch'],`Tab do campo desce a lista e só então chega ao interruptor da tinta (N2): ${JSON.stringify(tabStops)}`);
  const domOrder=await page.evaluate(()=>{
    const list=document.querySelector('#notebooks-list'),ink=document.querySelector('.notebooks-ink');
    return !!(list&&ink&&(list.compareDocumentPosition(ink)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(domOrder,true,'o painel da tinta vem depois da lista no DOM (N2)');
  await closePopover(page);

  /* ---------- achados da rodada 1: ordem, tipografia, contraste e rótulos ---------- */
  await setTheme(page,'light');
  await resize(ctx,page,1440,900);
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await openPopover(page);
    await page.locator('#notebooks-ink-switch').waitFor({timeout:10000});
    const facts=await page.evaluate(()=>{
      const top=selector=>document.querySelector(selector)?.getBoundingClientRect().top??null;
      const row=document.querySelector('.notebooks-row');
      const meta=row?.querySelector('.notebooks-meta');
      const pop=document.querySelector('#notebooks-pop');
      return {
        searchTop:top('#notebooks-search'),
        listTop:top('#notebooks-list'),
        inkTop:top('.notebooks-ink'),
        popTop:top('#notebooks-pop'),
        popBottom:document.querySelector('#notebooks-pop')?.getBoundingClientRect().bottom??null,
        inkBottom:document.querySelector('.notebooks-ink')?.getBoundingClientRect().bottom??null,
        titleSize:row?getComputedStyle(row.querySelector('.notebooks-title')).fontSize:null,
        metaSize:meta?getComputedStyle(meta).fontSize:null,
        metaColor:meta?getComputedStyle(meta).color:null,
        popBg:pop?getComputedStyle(pop).backgroundColor:null,
        rowLabel:row?.getAttribute('aria-label')??null,
        closeSvg:!!document.querySelector('#notebooks-close svg.icon'),
        closeText:document.querySelector('#notebooks-close')?.textContent?.trim()||'',
        emptyText:document.querySelector('.notebooks-empty')?.textContent?.trim()||'',
      };
    });
    assert.ok(facts.searchTop<facts.listTop&&facts.listTop<facts.inkTop,`${theme}: ordem do popover é busca → lista → tinta (${JSON.stringify(facts)})`);
    assert.ok(facts.inkTop>facts.listTop,`${theme}: o painel da tinta fica no pé, depois da lista (${facts.inkTop} vs ${facts.listTop})`);
    assert.ok(facts.inkBottom<=facts.popBottom+1,`${theme}: o painel da tinta encosta no pé do popover (${facts.inkBottom} vs ${facts.popBottom})`);
    assert.equal(facts.titleSize,'14px',`${theme}: o título do caderno usa 14px (cadernos.html)`);
    assert.equal(facts.metaSize,'12px',`${theme}: a meta do caderno usa 12px (cadernos.html)`);
    assert.match(facts.rowLabel||'',/^aula-nova\.xopp, sub · \d{2}:\d{2}, A4$/,`${theme}: o nome acessível da linha separa nome, meta e formato com vírgula (F20, #166): ${JSON.stringify(facts.rowLabel)}`);
    assert.equal(facts.closeSvg,true,`${theme}: o fechar do popover usa o ícone Lucide (F21)`);
    assert.equal(facts.closeText,'',`${theme}: o fechar não é mais o glifo de texto × (F21)`);
    const metaRatio=(()=>{const parse=value=>String(value).match(/\d+/g).slice(0,3).map(Number);const lum=rgb=>{const [r,g,b]=rgb.map(channel=>{const v=channel/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*b;};const [hi,lo]=[lum(parse(facts.metaColor)),lum(parse(facts.popBg))].sort((a,b)=>b-a);return (hi+0.05)/(lo+0.05);})();
    assert.ok(metaRatio>=4.5,`${theme}: a meta do caderno passa de 4,5:1 no r2 (medido ${metaRatio.toFixed(2)}:1)`);
    await closePopover(page);
  }

  /* ---------- teclado e abertura ---------- */
  await setTheme(page,'light');
  await resize(ctx,page,1440,900);
  await openPopover(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'notebooks-search','ao abrir com busca, o foco vai para o campo de busca');
  const focusIsFirst=()=>page.evaluate(()=>document.activeElement?.classList.contains('notebooks-row')&&document.activeElement?.querySelector('.notebooks-title')?.textContent==='aula-nova.xopp');
  await page.keyboard.press('ArrowDown');
  assert.equal(await focusIsFirst(),true,'seta para baixo a partir da busca entra no primeiro caderno');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>document.activeElement?.querySelector('.notebooks-title')?.textContent),'aula-antiga.xopp','seta para baixo anda na lista');
  await page.keyboard.press('ArrowUp');
  assert.equal(await focusIsFirst(),true,'seta para cima volta ao primeiro');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>globalThis.__opened?.length===1,undefined,{timeout:5000}).catch(async()=>{});
  const opened=await ctx.app.evaluate(()=>globalThis.__opened);
  assert.deepEqual(opened,[{courseId:'calc',path:nova}],'Enter abre o primeiro caderno com o {courseId, path} certo, sem abrir o Xournal++ de verdade');
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'chat-more','depois de abrir, o foco volta ao botão Mais opções');

  /* ---------- dois Enter seguidos não abrem duas vezes ---------- */
  /* O handler fake trava na primeira abertura (nunca resolve sozinho): com
     a guarda, o segundo Enter nem chega ao IPC (a linha está disabled); sem
     ela, dois Enter chamam o open duas vezes. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__blocked=[];
    ipcMain.removeHandler('notebooks-open');
    ipcMain.handle('notebooks-open',async(_event,payload)=>{
      globalThis.__blocked.push(payload);
      await new Promise(resolve=>{globalThis.__releaseOpen=resolve;});
      return {ok:true,path:payload.path};
    });
  });
  await openPopover(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  /* O contador mora no processo principal (o handler é do main): pollUntil
     lê de lá, como em reader-empty-ui.mjs. */
  await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__blocked?.length),count=>count>=1,{what:'a primeira abertura chegar ao IPC'});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);// espera fixa: tempo de um segundo IPC chegar ao main
  assert.equal(await ctx.app.evaluate(()=>globalThis.__blocked?.length),1,'dois Enter seguidos no mesmo caderno chamam o open uma vez só');
  assert.equal(await page.evaluate(()=>document.querySelector('.notebooks-row')?.disabled),true,'a linha trava enquanto a abertura está em voo');
  await ctx.app.evaluate(()=>globalThis.__releaseOpen?.());
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
  /* A guarda libera no `finally`: abrindo de novo, o Enter chega ao IPC. */
  await openPopover(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__blocked?.length),count=>count>=2,{what:'a segunda abertura chegar ao IPC'});
  await ctx.app.evaluate(()=>globalThis.__releaseOpen?.());
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
  /* ---------- D3: formato conhecido vira etiqueta no rótulo, com AA ---------- */
  /* Carta entra além do A4 (#184): maiúsculas forçadas apareceriam "CARTA". */
  await ctx.app.evaluate(({ipcMain})=>{
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>({notebooks:[
      {courseId:'calc',name:'aula-nova.xopp',path:'fake/aula-nova.xopp',folder:'',mtimeMs:2,format:'A4'},
      {courseId:'fis',name:'carta.xopp',path:'fake/carta.xopp',folder:'',mtimeMs:1,format:'Carta'},
      {courseId:'fis',name:'ondas.xopp',path:'fake/ondas.xopp',folder:'',mtimeMs:0},
    ]}));
  });
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await openPopover(page);
    const format=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('.notebooks-row')];
      const row=rows[0],badge=row?.querySelector('.notebooks-format'),style=badge?getComputedStyle(badge):null;
      return {
        texts:rows.map(entry=>entry.querySelector('.notebooks-format')?.textContent?.trim()||''),
        labels:rows.map(entry=>entry.getAttribute('aria-label')||''),
        hidden:badge?.getAttribute('aria-hidden')||'',color:style?.color||'',bg:style?.backgroundColor||'',
        third:!!rows[2]?.querySelector('.notebooks-format'),
      };
    });
    assert.deepEqual(format.texts,['A4','Carta',''],`${theme}: o formato conhecido vira a etiqueta curta, sem maiúsculas forçadas (#184)`);
    assert.match(format.labels[0],/, A4$/,`${theme}: a etiqueta A4 entra no rótulo acessível (${format.labels[0]})`);
    assert.match(format.labels[1],/, Carta$/,`${theme}: a etiqueta Carta entra no rótulo acessível (${format.labels[1]})`);
    assert.equal(format.hidden,'true',`${theme}: a etiqueta é lida pelo rótulo, não duas vezes`);
    assert.equal(format.third,false,`${theme}: sem formato conhecido, nenhuma etiqueta`);
    const ratio=contrast(format.color,format.bg);
    assert.ok(ratio>=4.5,`${theme}: a etiqueta passa AA (${ratio.toFixed(2)}:1)`);
    await closePopover(page);
  }

  /* ---------- título em no máximo 2 linhas e cabeçalho sticky (revisão #158) ---------- */
  await ctx.app.evaluate(({ipcMain})=>{
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>({notebooks:[
      {courseId:'calc',name:'palavra '.repeat(30)+'final.xopp',path:'fake/longo.xopp',folder:'',mtimeMs:1},
    ]}));
  });
  await openPopover(page);
  const longTitle=await page.evaluate(()=>{
    const row=document.querySelector('.notebooks-row');
    const title=row?.querySelector('.notebooks-title');
    if(!row||!title)return null;
    const style=getComputedStyle(title);
    return {
      buttonTitle:row.getAttribute('title')??row.dataset?.tip??null,text:title.textContent,
      clamp:style.getPropertyValue('-webkit-line-clamp'),display:style.display,overflow:style.overflow,
      height:title.getBoundingClientRect().height,lineHeight:parseFloat(style.lineHeight)||0,
    };
  });
  assert.ok(longTitle,`há título longo para medir (${JSON.stringify(longTitle)})`);
  assert.equal(longTitle.buttonTitle,longTitle.text,'o botão carrega o nome completo no title (M5)');
  assert.equal(longTitle.clamp,'2','título limita a 2 linhas (M5)');
  assert.equal(longTitle.overflow,'hidden','título esconde o excesso em vez de crescer (M5)');
  assert.ok(longTitle.lineHeight>0&&longTitle.height<=longTitle.lineHeight*2+1,`título ocupa no máximo 2 linhas (altura ${Math.round(longTitle.height)}px vs linha ${longTitle.lineHeight}px)`);
  await closePopover(page);

  await ctx.app.evaluate(({ipcMain})=>{
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>{
      const items=[];
      for(let i=0;i<15;i+=1)items.push({courseId:'calc',name:`calc-${i}.xopp`,path:`fake/calc-${i}.xopp`,folder:'',mtimeMs:100-i});
      for(let i=0;i<15;i+=1)items.push({courseId:'fis',name:`fis-${i}.xopp`,path:`fake/fis-${i}.xopp`,folder:'',mtimeMs:50-i});
      return {notebooks:items};
    });
  });
  await openPopover(page);
  const stickyStyle=await page.evaluate(()=>{
    const group=document.querySelector('.notebooks-group');
    const style=group?getComputedStyle(group):null;
    return {
      position:style?.position||null,transform:style?.textTransform||null,
      fontSize:style?.fontSize||null,bg:style?.backgroundColor||null,
    };
  });
  assert.equal(stickyStyle.position,'sticky','cabeçalho da matéria é sticky (M6)');
  assert.equal(stickyStyle.transform,'none','cabeçalho da matéria sem maiúsculas (cadernos.html)');
  assert.equal(stickyStyle.fontSize,'12px','cabeçalho da matéria usa 12px semibold (cadernos.html)');
  const pinned=await page.evaluate(async()=>{
    const list=document.querySelector('#notebooks-list');
    const target=document.querySelectorAll('.notebooks-group')[1];
    if(!list||!target)return null;
    list.scrollTop=list.scrollHeight;
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
    const listRect=list.getBoundingClientRect(),targetRect=target.getBoundingClientRect();
    return {delta:Math.abs(targetRect.top-listRect.top),listTop:listRect.top,targetTop:targetRect.top};
  });
  /* Encostado no topo: com margem acima do cabeçalho sticky, as linhas
     apareciam na faixa entre a borda da lista e o cabeçalho. */
  assert.ok(pinned&&pinned.delta<=1,`cabeçalho da segunda matéria fica fixo no topo ao rolar, sem faixa por cima (delta ${pinned?Math.round(pinned.delta):'sem medida'}px)`);
  await closePopover(page);

  /* F22: o vazio da biblioteca ensina como um caderno chega ali. */
  await ctx.app.evaluate(({ipcMain})=>{
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>({notebooks:[]}));
  });
  await openPopover(page);
  await page.locator('.notebooks-empty').waitFor({timeout:10000});
  const empty=await page.evaluate(()=>({
    text:document.querySelector('.notebooks-empty')?.textContent?.trim()||'',
    emptyTop:document.querySelector('.notebooks-empty')?.getBoundingClientRect().top??null,
    inkTop:document.querySelector('.notebooks-ink')?.getBoundingClientRect().top??null,
  }));
  assert.match(empty.text,/pasta da matéria/,'o vazio da biblioteca diz que o .xopp aparece ao salvar na pasta da matéria (F22)');
  assert.ok(empty.emptyTop<empty.inkTop,`o vazio da lista fica acima do painel da tinta (${empty.emptyTop} vs ${empty.inkTop})`);
  await closePopover(page);
  assert.deepEqual(errors,[],'nenhum erro de página');
});

console.log('notebooks-ui: PASS — lista agrupada nos dois temas, 1440×900 e 900×650; Enter abre via openNotebook (fake); Esc fecha e devolve o foco; D2 abre/fecha pelo atalho e D3 mede ícone e etiqueta.');
