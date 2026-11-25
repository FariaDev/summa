// A demo do site num Chromium sem tela, em PT e EN: matérias, Conferir, tinta,
// seletor de modelos, paleta, tema, download e larguras de 320 a 1440 px.
//
//   node site/test/demo-ui.mjs [pasta-de-capturas]
//
// O Playwright vem do desk/ (devDependency @playwright/test): rode `npm ci` lá antes.
// SUMMA_DESK_DIR aponta para outro desk/ com node_modules; CHROMIUM_PATH, para outro Chromium.
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '../build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const deskDir = process.env.SUMMA_DESK_DIR || join(here, '../../desk');
const {chromium} = createRequire(join(deskDir, 'package.json'))('playwright');
const shots = process.argv[2] || '';
const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png'};
// Módulos ES não carregam de file://; um servidor estático mínimo basta.
function serve(root) {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, {'content-type': TYPES[extname(path)] || 'application/octet-stream'});
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function scenario(browser, base, lang) {
  const c = (await import(`../src/assets/js/content-${lang}.js`)).default;
  const tag = `[${lang}] `;
  const ok = (cond, msg) => check(cond, tag + msg);
  const errors = [];
  const page = await browser.newPage({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + (lang === 'en' ? 'en/' : ''));
  await page.waitForFunction(() => document.querySelector('#xpp-title').textContent);
  const txt = (s) => page.$eval(s, (e) => e.textContent.trim());
  const count = (s) => page.$$eval(s, (e) => e.length);
  const lastReply = () => page.$$eval('#thread .reply', (e) => e.at(-1).textContent);
  // Com movimento normal a demo anda no tempo real; espera a resposta terminar.
  const settle = async () => { await page.waitForTimeout(100); await page.waitForFunction(() => !document.querySelector('#d-check').disabled); };
  const calc1 = c.courses.calc1, fis1 = c.courses.fis1;

  // Download: o fixture tem AppImage na v1.4.0, e o Chromium sem tela se diz Linux.
  ok((await page.$eval('#get-btn', (e) => e.href)) === 'https://example.test/Summa-1.4.0-x86_64.AppImage', 'botão aponta para o AppImage');
  ok((await txt('.os-label')) === `${c.text.downloadFor} Linux`, 'rótulo do sistema');
  ok((await txt('.get-meta')).startsWith('v1.4.0'), 'versão do instalador');
  ok((await page.$eval('.get-meta .whats-new', (e) => e.href + ' ' + e.textContent)) === `https://github.com/FariaDev/summa/releases/tag/v1.4.0 ${c.text.whatsNew}`, 'o que mudou leva às notas da versão');
  ok(!(await page.$eval('.os-panel[data-tab=linux]', (e) => e.hidden)), 'Instalar abre na aba Linux');

  // Cálculo: dois Conferir e o fim
  await page.click('#d-check'); await settle();
  ok((await count('#thread .reply')) === 1, 'cálculo: 1ª resposta');
  ok((await txt('#t-title')) === calc1.replies[0].title, 'cálculo: título');
  await page.click('#d-check'); await settle();
  ok((await count('#thread .reply')) === 2, 'cálculo: 2ª resposta');
  await page.click('#d-check'); await page.click('#d-check'); await page.waitForTimeout(100);
  ok((await page.$$eval('#thread .msg-foot', (e, end) => e.filter((x) => x.textContent.includes(end)).length, c.text.demoEnd)) === 1, 'fim da demo aparece uma vez só');

  // Física: conversa e folha próprias; o Cálculo fica como estava
  await page.click('.course-tabs [data-tab=fis1]');
  ok((await count('#thread .reply')) === 0, 'física: conversa vazia');
  ok((await txt('#t-title')) === c.text.newChat, 'física: título novo');
  ok((await txt('#r1-doc')) === c.docs.cine.name, 'física: leitor troca');
  ok((await txt('#xpp-title')).startsWith(fis1.xopp), 'física: folha troca');
  await page.click('#d-check'); await settle();
  ok((await txt('#t-title')) === fis1.replies[0].title, 'física: roteiro próprio');
  await page.click('.course-tabs [data-tab=calc1]');
  ok((await count('#thread .reply')) === 2, 'cálculo: conversa preservada');
  ok((await count('#ink path')) > 10, 'cálculo: folha preservada');
  await page.click('.course-tabs [data-tab=livre]');
  ok((await txt('#r1-paper')) === c.docs.none.blank, 'livre: leitor vazio');
  await page.click('#d-check'); await settle();
  ok((await lastReply()).includes(c.courses.livre.replies[0].blocks[0].replace(/<[^>]+>/g, '').slice(0, 20)), 'livre: folha em branco');
  await page.click('.course-tabs [data-tab=calc1]');

  // Mini a partir do GeoGebra volta para a matéria
  await page.click('.course-tabs [data-tab=ggb]');
  ok((await txt('#g-x')).includes(c.decimal), 'GeoGebra usa o separador do idioma');
  ok(!(await page.$eval('#mini-btn', (e) => e.offsetParent !== null)), 'no GeoGebra o botão do mini não aparece');
  await page.click('button.feat[data-go=mini]'); await page.waitForTimeout(300);
  ok((await page.$eval('#app', (e) => e.dataset.view)) === 'calc1', 'mini pelo recurso volta à matéria');
  await page.click('#mini-btn');
  ok((await page.$eval('#stage', (e) => e.dataset.mini)) === 'false', 'sai do mini');

  // Marca do topo: o lema começa no S do nome, e a integral passa do topo e da base dele.
  const lockGeo = await page.evaluate(() => {
    const first = (el) => { const t = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(); const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 1); return r.getBoundingClientRect(); };
    const name = first(document.querySelector('.lock')), motto = first(document.querySelector('.motto')), int = document.querySelector('.egg-int svg').getBoundingClientRect();
    return {dS: motto.left - name.left, top: int.top - name.top, bottom: int.bottom - name.bottom};
  });
  ok(Math.abs(lockGeo.dS) <= 3, `lema alinhado ao S do nome (${lockGeo.dS.toFixed(1)} px)`);
  ok(lockGeo.top < 0 && lockGeo.bottom > 0, `integral passa do topo e da base do nome (${lockGeo.top.toFixed(1)}, ${lockGeo.bottom.toFixed(1)})`);
  const cardShown = (id) => page.$eval(id, (e) => getComputedStyle(e).visibility === 'visible');
  await page.hover('.egg-int');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#egg-int')).visibility === 'visible');
  ok(!(await cardShown('#egg-motto')), 'hover na integral abre só o cartão dela');
  await page.mouse.move(2, 600);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#egg-int')).visibility === 'hidden');
  await page.click('.egg-motto');
  ok((await page.$eval('.egg-motto', (e) => e.getAttribute('aria-expanded'))) === 'true', 'clique no lema abre o cartão');
  await page.keyboard.press('Escape');
  ok((await page.$eval('.egg-motto', (e) => e.getAttribute('aria-expanded'))) === 'false', 'Esc fecha o cartão');
  ok((await page.$eval('.lock-shine', (e) => getComputedStyle(e).display)) === 'none', 'com movimento reduzido, sem brilho');
  ok((await page.$eval('#egg-motto', (e) => e.textContent)).includes('Solvitur ambulando'), 'cartão do lema traz o texto');
  await page.mouse.move(2, 600);

  // Navegação nativa do topo
  await page.click('.tabs a[href="#perguntas"]'); await page.waitForTimeout(400);
  const y = await page.$eval('#perguntas', (e) => e.getBoundingClientRect().top);
  ok(y > -5 && y < 120, `aba Perguntas rola até a seção (top=${Math.round(y)})`);
  ok(await page.$eval('.tabs a[href="#perguntas"]', (e) => e.classList.contains('active')), 'aba ativa acompanha');
  // A última seção é curta e não chega à faixa do meio: no fim da página ela é a ativa.
  const active = () => page.$eval('.tabs a.active', (e) => e.getAttribute('href'));
  await page.click('.tabs a[href="#instalar"]'); await page.waitForTimeout(400);
  ok((await active()) === '#instalar', 'aba Instalar acompanha');
  await page.click('.tabs a[href="#conectar"]'); await page.waitForTimeout(400);
  ok((await active()) === '#conectar', 'aba Conectar fica ativa no fim da página');
  await page.click('.tabs a[href="#perguntas"]'); await page.waitForTimeout(400);
  ok((await active()) === '#perguntas', 'subindo do fim, Perguntas volta a ser a ativa');
  // Salto do fim ao topo sem passar pelas seções: o observador da faixa de cima ainda acerta.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('.tabs a.active')?.getAttribute('href') === '#conectar');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('.tabs a.active')?.getAttribute('href') === '#demo', null, {timeout: 3000}).catch(() => {});
  ok((await active()) === '#demo', 'saltando do fim ao topo, Demo volta a ser a ativa');
  const preload = await page.$$eval('link[rel=modulepreload]', (ls) => ls.map((l) => l.href.split('/').pop()));
  ok(preload.includes(`content-${lang}.js`) && !preload.includes(`content-${lang === 'en' ? 'pt' : 'en'}.js`), `pré-carrega só o texto da língua (${preload.join(' ')})`);
  // Conectar: OpenCode Go abre primeiro; cada aba troca o painel, e Instalar não mexe.
  const shown = (s) => page.$$eval(`#${s} [role=tabpanel]`, (ps) => ps.filter((p) => !p.hidden).map((p) => p.dataset.tab).join());
  ok((await shown('conectar')) === 'go', 'Conectar abre no OpenCode Go');
  const installTab = await shown('instalar');
  await page.click('#conectar [role=tab][data-tab=claude]');
  ok((await shown('conectar')) === 'claude', 'aba Claude troca o painel');
  ok((await shown('instalar')) === installTab, 'as abas de Conectar não mexem em Instalar');
  ok((await page.$eval('#conectar [data-tab=claude] .code', (e) => e.textContent)).includes('opencode auth login claude-agent'), 'Claude mostra os dois comandos');
  // Teclado: só a aba escolhida entra no Tab; setas, Home e End trocam e levam o foco.
  const tabIndexes = () => page.$$eval('#conectar [role=tab]', (ts) => ts.map((t) => t.tabIndex).join());
  ok((await tabIndexes()) === '-1,-1,0,-1,-1,-1', 'só a aba escolhida tem tabindex 0');
  ok(await page.$eval('#conectar [role=tab][data-tab=claude]', (t) => document.getElementById(t.getAttribute('aria-controls'))?.dataset.tab === 'claude'), 'aria-controls aponta para o painel');
  await page.focus('#conectar [role=tab][data-tab=claude]');
  await page.keyboard.press('ArrowRight');
  ok((await shown('conectar')) === 'grok' && (await page.evaluate(() => document.activeElement.dataset.tab)) === 'grok', 'seta para a direita vai para a próxima aba');
  await page.keyboard.press('End');
  ok((await shown('conectar')) === 'other', 'End vai para a última');
  await page.keyboard.press('ArrowRight');
  ok((await shown('conectar')) === 'go', 'depois da última, volta à primeira');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Home');
  ok((await shown('conectar')) === 'go' && (await shown('instalar')) === installTab, 'Home volta à primeira sem mexer em Instalar');
  await page.click('#perguntas details:nth-of-type(5) summary');
  await page.click('#perguntas a[href="#conectar"]'); await page.waitForTimeout(400);
  ok((await active()) === '#conectar', 'a pergunta do plano leva a Conectar');
  await page.click('.tabs a[href="#perguntas"]'); await page.waitForTimeout(400);
  // Fora da demo, Ctrl+K e Ctrl+Z ficam com o navegador.
  await page.keyboard.press('Control+k');
  ok(await page.$eval('#palette', (e) => e.hidden), 'Ctrl+K longe da demo não abre a paleta');
  await page.click('.get-meta a[data-os=mac]'); await page.waitForTimeout(400);
  ok(!(await page.$eval('.os-panel[data-tab=mac]', (e) => e.hidden)), 'link do sistema no topo escolhe a aba de Instalar');
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);

  // Ferramentas
  await page.click('#attach-btn');
  ok(await page.$eval('#qr-pop', (e) => !e.hidden), 'clipe abre o QR');
  ok((await txt('#palette-kbd')) === 'Ctrl K', 'atalho mostrado como Ctrl K fora do Mac');
  await page.keyboard.press('Control+k');
  ok(await page.$eval('#palette', (e) => !e.hidden), 'Ctrl+K abre a paleta');
  await page.keyboard.type(lang === 'en' ? 'physics' : 'fisica'); await page.keyboard.press('Enter');
  ok((await page.$eval('#app', (e) => e.dataset.view)) === 'fis1', 'paleta: ir para Física I');
  await page.fill('#calc', '1/4');
  ok((await txt('#calc-out')) === `0${c.decimal}25`, 'calculadora com o separador do idioma');

  // Tema: segue o sistema, alterna e volta depois de recarregar
  ok(!(await page.evaluate(() => document.documentElement.dataset.theme)), 'sem escolha, tema do sistema');
  await page.click('#theme-btn');
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'botão liga o escuro');
  ok((await page.$eval('#theme-btn', (e) => e.getAttribute('aria-label'))) === c.text.themeToLight, 'rótulo do botão vira');
  ok((await page.$eval('.seg[data-k=theme] [data-v=dark]', (e) => e.getAttribute('aria-pressed'))) === 'true', 'Configurações acompanham');

  // Xournal++: caneta, cor, desfazer e borracha (em Física I, com a tentativa 1 na folha)
  const box = await page.$eval('#ink', (e) => { const r = e.getBoundingClientRect(); return {x: r.left, y: r.top}; });
  const users = () => count('#ink path.user');
  const drag = async (pts) => {
    await page.mouse.move(box.x + pts[0][0], box.y + pts[0][1]); await page.mouse.down();
    for (const [x, yy] of pts.slice(1)) await page.mouse.move(box.x + x, box.y + yy, {steps: 4});
    await page.mouse.up();
  };
  await drag([[60, 250], [120, 270], [180, 250]]);
  ok((await users()) === 1, 'caneta desenha um traço');
  await page.click('.ink-swatch[data-ink="#c62828"]');
  await drag([[60, 300], [160, 310]]);
  ok((await page.$eval('#ink path.user:last-of-type', (e) => e.style.stroke)).includes('198'), 'cor vermelha no traço novo');
  await page.click('#undo-btn');
  ok((await users()) === 1, 'desfazer tira o último traço');
  await page.click('[data-tool=eraser]');
  await drag([[50, 260], [200, 260]]);
  ok((await users()) === 0, 'borracha apaga o traço');
  // A Física já foi conferida uma vez, então a última tentativa é a correção, na linha de baixo.
  const lastAttempt = () => page.$$eval('#ink g[data-n]', (g) => g.at(-1).childElementCount);
  const before = await lastAttempt();
  for (const yy of [116, 124, 132, 140]) await drag([[25, yy], [230, yy]]);
  const after = await lastAttempt();
  ok(after < before * 0.6, `borracha apaga a tentativa (${before} → ${after})`);
  await page.click('#d-check'); await settle();
  ok((await lastReply()).includes(c.sheet.erased.replace(/<[^>]+>/g, '').slice(0, 15)), 'Conferir nota a tentativa apagada');
  ok((await txt('#t-title')) === fis1.replies[0].title && (await count('#thread .reply')) === 2, 'sem roteiro avançado');
  await page.keyboard.press('Control+z');
  for (let i = 0; i < 40; i++) await page.click('#undo-btn');
  ok((await lastAttempt()) === before, 'desfazer devolve a tentativa');
  await page.click('#d-check'); await settle();
  ok((await lastReply()).includes(fis1.replies[1].blocks[0].replace(/<[^>]+>/g, '').slice(0, 12)), 'Conferir segue o roteiro depois de desfazer');
  await page.click('[data-tool=pen]');

  // Seletor de modelos
  await page.click('#model-btn');
  ok(await page.$eval('#model-pop', (e) => !e.hidden), 'nome do modelo abre o seletor');
  ok((await page.$$eval('.model-group-title', (e) => e.map((x) => x.textContent).join())) === `${c.picker.recent},OpenCode Zen`, 'grupos Recentes e OpenCode Zen');
  ok((await txt('.model-group[data-group="1"] .model-row-meta')) === c.picker.policy.zero, 'linha do provedor mostra a política');
  await page.keyboard.type('glmzzz');
  ok((await txt('#model-list')) === c.picker.none('glmzzz'), 'busca vazia avisa');
  await page.fill('#model-search', 'mimo'); await page.keyboard.press('Enter');
  ok((await txt('#model-name')) === 'MiMo V2.6 Flash', 'Enter escolhe e o rótulo troca');
  await page.click('#model-btn');
  const glm = '.model-group[data-group="1"] .model-row[data-id="glm-5.3-flash-free"]';
  await page.hover(glm); await page.click(glm + ' .model-row-star');
  ok((await page.$$eval('.model-group-title', (e) => e.map((x) => x.textContent).join())) === `${c.picker.recent},${c.picker.favorites},OpenCode Zen`, 'estrela abre Favoritos sem fechar');
  await page.click('.effort-strip [data-effort=high]');
  ok((await txt('#model-level')) === `· ${c.picker.effort.high}`, 'esforço no indicador');
  await page.mouse.click(5, 5);
  ok(await page.$eval('#model-pop', (e) => e.hidden), 'clique fora fecha');
  await page.click('#new-btn');
  ok((await txt('#t-title')) === c.text.newChat && (await count('#thread .reply')) === 0, 'Nova conversa zera a matéria');
  await page.click('#d-check'); await settle();
  ok((await page.$$eval('#thread .msg-foot', (e) => e.at(-1).textContent)).includes('mimo-v2.6-flash-free'), 'resposta assinada pelo modelo escolhido');

  // O tema escolhido volta depois de recarregar, antes da pintura.
  await page.reload();
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'tema escolhido volta ao recarregar');

  // Larguras: nada estoura para os lados
  for (const w of [1440, 1024, 768, 600, 390, 320]) {
    for (const mini of [false, true]) {
      await page.setViewportSize({width: w, height: 900});
      await page.evaluate((m) => { document.getElementById('stage').dataset.mini = String(m); }, mini);
      await page.waitForTimeout(50);
      const r = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth, vw: innerWidth,
        wins: [...document.querySelectorAll('.win')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }),
      }));
      ok(r.doc <= r.vw + 1 && r.wins.every(([l, rr]) => l >= -1 && rr <= r.vw + 1), `largura ${w}${mini ? ' mini' : ''}: sem estouro`);
      // Os nomes de arquivo e o do modelo cabem inteiros (antes saíam "derivadas.xop…" e "DeepSeek V4.1 F…").
      const cut = await page.$$eval('#xpp-title, #model-name, #r1-doc, #r2-doc', (els) => els
        .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth).map((e) => `${e.id} "${e.textContent}" ${e.scrollWidth}/${e.clientWidth}`));
      ok(!cut.length, `largura ${w}${mini ? ' mini' : ''}: sem texto cortado ${cut.join(', ')}`);
    }
    if (shots && (w === 1440 || w === 390)) await page.screenshot({path: join(shots, `site-${lang}-${w}.png`), fullPage: true});
  }
  // Quem chega pela página do idioma errado precisa achar a troca também no celular.
  ok(await page.$eval('.lang', (e) => e.getBoundingClientRect().width > 0), 'PT · EN visível em 320 px');
  ok(errors.length === 0, 'sem erros no console: ' + errors.join(' | '));
  await page.close();
}

// Celular e tablet: sem instalador, os botões mandam o link para o computador.
// Sem navigator.share (o Chromium sem tela no Linux não tem), o link vai para a área de transferência.
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
// Com movimento normal: o brilho do "lendo…" anda por transform num véu, sem máscara animada.
async function motionScenario(browser, base) {
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  await page.goto(base);
  await page.waitForFunction(() => !document.querySelector('#d-check').disabled, null, {timeout: 60000});
  await page.click('#d-check');
  await page.waitForSelector('.work-shine');
  const shine = await page.$eval('.work-shine', (e) => {
    const after = getComputedStyle(e, '::after'), self = getComputedStyle(e);
    return {name: after.animationName, transform: after.transform, mask: self.maskImage || self.webkitMaskImage};
  });
  check(shine.name === 'work-shine' && shine.transform.startsWith('matrix') && shine.mask === 'none', `brilho por transform no ::after (${JSON.stringify(shine)})`);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('#stage').dataset.offscreen === 'true');
  const paused = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'work-shine').map((a) => a.playState));
  check(paused.length > 0 && paused.every((s) => s === 'paused'), `fora da tela o brilho para (${paused.join()})`);
  await page.close();
}

async function mobileScenario(browser, base, lang, device, ua) {
  const c = (await import(`../src/assets/js/content-${lang}.js`)).default;
  const ok = (cond, msg) => check(cond, `[${lang} ${device}] ${msg}`);
  const context = await browser.newContext({userAgent: ua, viewport: {width: 390, height: 844}, hasTouch: true, isMobile: device === 'iphone'});
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  // O iPad se diz Mac; quem o separa é o toque.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {get: () => 5}));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + (lang === 'en' ? 'en/' : ''));
  await page.waitForFunction(() => document.querySelector('#xpp-title').textContent);
  const label = () => page.$eval('.os-label', (e) => e.textContent);
  ok((await label()) === c.text.sendToComputer, 'botão vira "Mandar para o computador"');
  // Sem hover, o toque abre o cartão do lema e um toque fora fecha.
  await page.tap('.egg-motto');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#egg-motto')).visibility === 'visible');
  await page.tap('#egg-motto');
  ok((await page.$eval('.egg-motto', (e) => e.getAttribute('aria-expanded'))) === 'false', 'toque no cartão fecha o cartão do lema');
  await page.tap('.egg-int');
  await page.touchscreen.tap(8, 8);
  ok((await page.$eval('.egg-int', (e) => e.getAttribute('aria-expanded'))) === 'false', 'toque fora fecha o cartão da integral');
  ok((await page.$eval('.get-note', (e) => e.textContent)) === c.text.mobileNote, 'nota diz onde a Summa roda');
  ok(!(await page.$eval('#get-btn', (e) => e.href)).match(/\.(dmg|exe|AppImage)$/), 'botão não aponta para instalador');
  ok((await page.$eval('.top-actions .btn.primary', (e) => e.textContent.trim())) === c.text.sendShort, 'botão do topo vira "Mandar"');
  ok((await page.$eval('.stage', (e) => e.getBoundingClientRect().height)) < 760, 'no celular a demo encolhe (antes ocupava 862 px)');
  await page.click('#get-btn');
  ok((await label()) === c.text.linkCopied, 'sem compartilhamento, avisa que copiou');
  ok((await page.evaluate(() => navigator.clipboard.readText())) === base + (lang === 'en' ? 'en/' : ''), 'copia o link da página, sem âncora');
  ok(errors.length === 0, 'sem erros no console: ' + errors.join(' | '));
  await context.close();
}

const out = await mkdtemp(join(tmpdir(), 'summa-site-ui-'));
const server = await serve(out);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
try {
  await build({out, releases: join(here, 'fixtures/releases.json'), offline: false});
  const base = `http://127.0.0.1:${server.address().port}/`;
  for (const lang of ['pt', 'en']) await scenario(browser, base, lang);
  await motionScenario(browser, base);
  await mobileScenario(browser, base, 'pt', 'iphone', IPHONE);
  await mobileScenario(browser, base, 'en', 'ipad', IPAD);
} finally {
  await browser.close();
  server.close();
  await rm(out, {recursive: true, force: true});
}
console.log(fails.length ? `\n${fails.length} falha(s)` : '\ntudo ok');
process.exitCode = fails.length ? 1 : 0;
