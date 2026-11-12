/* Regressão da #151: com o monitor em DPMS off, o compositor da GPU para de
   entregar BeginFrames à janela escondida do teste no Linux; o rAF cai para
   ~1 Hz e a rolagem chega 1–3 s depois da tecla. O arnês passa
   `--disable-gpu` no Linux (`helpers.mjs`) e o renderizador de software mantém
   os 60 fps. Com o monitor ligado este teste passa mesmo sem a correção: ele
   guarda o caso da máquina ociosa. Cobre os três gatilhos medidos na sonda:
   boot, estilo injetado e tamanho novo. */
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,launchDesk,statusOnline,resizeWindow,pageWindow} from './helpers.mjs';

const SLOW_MS=250;
const slowIntervals=intervals=>intervals.filter(ms=>ms>SLOW_MS).map(ms=>Math.round(ms));
const readIntervals=page=>page.evaluate(()=>new Promise(done=>{
 const times=[];let last=performance.now();
 const step=()=>{const now=performance.now();times.push(now-last);last=now;if(times.length>=10)done(times);else requestAnimationFrame(step);};
 requestAnimationFrame(step);
}));
const expectedFrameRate=(label,intervals)=>{
 assert.deepEqual(slowIntervals(intervals),[],`${label}: rAF a 60 fps (intervalos: ${intervals.map(ms=>Math.round(ms)).join(',')})`);
};

await withArtifacts('quadros-janela-escondida',async ctx=>{
 const runtime=ctx.runtime=newRuntime('quadros-janela');
 const course=seedCourse(runtime,'Calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo',path:course}]});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await page.waitForLoadState('load',{timeout:30000});
 await statusOnline(page);
 const win=await pageWindow(ctx.app,page);
 assert.equal(await win.evaluate(w=>w.isVisible()),false,'a janela do teste segue escondida');
 expectedFrameRate('depois do load',await readIntervals(page));
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
 expectedFrameRate('depois de injetar estilo',await readIntervals(page));
 await resizeWindow(ctx.app,page,1300,800);
 expectedFrameRate('depois do resize',await readIntervals(page));
});
console.log('hidden-window-frames-ui: PASS — rAF a 60 fps depois do load, do estilo injetado e do resize.');
