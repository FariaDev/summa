/* Casca do protótipo: abas de peças, sessões da Livre, conversas ligadas, a
   vista de uma matéria e os estados prontos usados nas capturas. */

/* ---------- conversa ---------- */
function addMsg(html, cls, box = $('#chat')) {
  const d = document.createElement('div');
  d.className = cls; d.innerHTML = html; box.appendChild(d);
  if (!PROTO.embed) box.scrollTop = box.scrollHeight;
  return d;
}
const pieceLink = (id, icon, title, kind) => `<button type="button" class="piece-link" data-go="${id}"><svg class="icon"><use href="#i-${icon}"/></svg>${title}<span class="k">${kind}</span></button>`;
const tools = (name, what) => `<details class="tools"><summary><svg class="icon tool-ok"><use href="#i-check"/></svg>${name}<span class="tools-what">${what}</span></summary></details>`;

/* ---------- uma peça por vez: as abas do quadro ---------- */
function buildPieceTabs(ids) {
  $('#piece-tabs').innerHTML = ids.map((id) => {
    const p = document.getElementById(id);
    return `<button type="button" class="tab" role="tab" data-piece-tab="${id}" aria-selected="false" title="${p.dataset.title}"><svg class="icon"><use href="#i-${p.dataset.icon}"/></svg><span>${p.dataset.title}</span></button>`;
  }).join('');
}
function selectPiece(id) {
  Object.values(PIECES).forEach((p) => { if (p.id !== id) p.pause(); });
  document.querySelectorAll('.piece').forEach((p) => p.classList.toggle('is-on', p.id === id));
  document.querySelectorAll('[data-piece-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.pieceTab === id)));
  const kind = document.getElementById(id).dataset.kind;
  if (PIECES[kind]) PIECES[kind].redraw();
}
$('#piece-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-piece-tab]'); if (t) selectPiece(t.dataset.pieceTab); });

/* ---------- sessões: voltar a uma conversa antiga traz o quadro dela ----------
   As peças pertencem à sessão onde nasceram e guardam o estado (como
   `mesa.state` nas atividades), então o desenho volta parado onde ficou. */
const SESSIONS = [
  {id:'p2', title:'Revisão para a P2', meta:'hoje · cena, roteiro, desenho e Lista 3', pieces:['p-cena', 'p-rot', 'p-draw', 'p-pdf'], linked:['Física I · Cinemática 2D'], open:'p-draw'},
  {id:'pit', title:'Pitágoras do zero', meta:`12 nov · desenho parado em ${clock(pitMarca('deslize', .4))}`, pieces:['p-draw'], linked:[], open:'p-draw', at:pitMarca('deslize', .4)},
  {id:'alg', title:'Árvores de busca', meta:'hoje · roteiro', pieces:['p-arv'], linked:['Algoritmos II · Busca e ordenação'], open:'p-arv'},
  {id:'vet', title:'Vetores no plano', meta:'5 nov · cena', pieces:['p-cena'], linked:['Física I · Vetores'], open:'p-cena'},
];
let session = SESSIONS[0];
function seedSession(s) {
  $('#chat').innerHTML = '';
  if (s.id === 'pit') {
    addMsg('12 nov', 'sys-line');
    addMsg('Me explica Pitágoras sem fórmula decorada.', 'msg-student');
    addMsg(`${tools('criar_peca', 'pitagoras.desenho.js · desenho · 7 passos')}<p>Desenhei a prova por rearranjo. Pause onde travar e pergunte: eu vejo o passo e o que já está no quadro.</p>${pieceLink('p-draw', 'pen', 'Teorema de Pitágoras', 'desenho')}`, 'msg-tutor');
    return;
  }
  if (s.id === 'alg') {
    /* O modelo cria, confere com a ver_peca, corrige e confere de novo antes
       de entregar; o aluno vê as ferramentas recolhidas, como hoje. */
    addMsg('Hoje', 'sys-line');
    addMsg('Me mostra a inserção numa árvore de busca com a pilha de chamadas. Recursão sempre me confunde.', 'msg-student');
    addMsg(`${tools('criar_peca', 'arvore-busca.roteiro.js · roteiro')}${verPecaHtml(ARVORE_BUSCA, {valores:'10 20 30 40 50 60 70'}, s.verAberto)}${tools('criar_peca', 'arvore-busca.roteiro.js · valores 50 30 70 20 40 60 45')}${verPecaHtml(ARVORE_BUSCA, {valores:'50 30 70 20 40 60 45'})}<p>Montei a inserção com a pilha de chamadas ao lado. Pare em qualquer passo e pergunte. Com os valores em ordem crescente a árvore vira uma fila, e o botão E se… mostra esse caso.</p>${pieceLink('p-arv', 'code', 'Árvore de busca', 'roteiro')}`, 'msg-tutor');
    return;
  }
  if (s.id === 'vet') {
    addMsg('5 nov', 'sys-line');
    addMsg('Me mostra as componentes da velocidade num lançamento.', 'msg-student');
    addMsg(`${tools('criar_peca', 'lancamento.cena.js · cena · 5 passos')}<p>Montei a cena. Toque e pause onde quiser.</p>${pieceLink('p-cena', 'scene', 'Lançamento oblíquo', 'cena')}`, 'msg-tutor');
    return;
  }
  addMsg('Hoje', 'sys-line');
  addMsg(`${pieceLink('p-cena', 'scene', 'Lançamento oblíquo', 'cena')}<span>aberta de Física I · Cinemática 2D</span>`, 'origin-note');
  addMsg('Revisando para a P2. E busca binária? Sempre me perco nos índices.', 'msg-student');
  addMsg(`${tools('criar_peca', `busca-binaria.roteiro.js · roteiro · ${PIECES.roteiro.passos()} passos`)}<p>Coloquei um roteiro que roda linha a linha. Pare em qualquer passo e pergunte; eu vejo a linha e as variáveis daquele instante.</p>${pieceLink('p-rot', 'code', 'Busca binária', 'roteiro')}`, 'msg-tutor');
  addMsg('E por que |v| = √(vx² + vy²)? Nunca entendi de onde vem.', 'msg-student');
  addMsg(`${tools('criar_peca', 'pitagoras.desenho.js · desenho · 7 passos')}<p><i class="v">vx</i> e <i class="v">vy</i> são os catetos de um triângulo retângulo e |<i class="v">v</i>| é a hipotenusa. Desenhei a prova do teorema; pause onde travar e pergunte.</p>${pieceLink('p-draw', 'pen', 'Teorema de Pitágoras', 'desenho')}`, 'msg-tutor');
}
function loadSession(id) {
  session = SESSIONS.find((s) => s.id === id);
  $('#sess-title').textContent = session.title;
  linked = new Set(session.linked); paintLinkLabel();
  buildPieceTabs(session.pieces);
  seedSession(session);
  selectPiece(session.open);
  if (session.at) PIECES.desenho.goto(session.at);
}
function paintSessions() {
  $('#sess-list').innerHTML = SESSIONS.map((s) => `<button type="button" class="sess-row" data-sess="${s.id}" aria-current="${s === session}"><span>${s.title}</span><span class="n">${s.pieces.length}</span><small>${s.meta}</small></button>`).join('');
}
$('#sess-list').addEventListener('click', (e) => {
  const r = e.target.closest('[data-sess]'); if (!r) return;
  closePops(); clearChips(); loadSession(r.dataset.sess);
});

/* ---------- ligar conversas de outras matérias ----------
   Várias ao mesmo tempo. O tutor recebe o resumo e a questão ativa de cada
   uma e abre os PDFs dela sob demanda; nada muda nas conversas ligadas. */
const LINKS = [
  ['Física I', [['Cinemática 2D', 'hoje · Lista 3 · p. 2'], ['Vetores', 'ontem · Apostila · p. 14']]],
  ['Algoritmos II', [['Busca e ordenação', 'seg · Slides 05']]],
  ['Cálculo I', [['Frações parciais', 'ter · Apostila · p. 58']]],
];
let linked = new Set();
function paintLinkLabel() {
  const first = [...linked][0];
  $('#ctx-label').textContent = first ? `${first}${linked.size > 1 ? ` +${linked.size - 1}` : ''}` : 'Ligar conversa';
}
function paintLinks() {
  $('#link-list').innerHTML = LINKS.map(([course, list]) => `<div class="link-group">${course}</div>` + list.map(([name, meta]) => {
    const key = `${course} · ${name}`;
    return `<button type="button" class="link-row" role="menuitemcheckbox" aria-checked="${linked.has(key)}" data-k="${key}"><span class="box"></span><b>${name}</b><small>${meta}</small></button>`;
  }).join('')).join('');
}
$('#link-list').addEventListener('click', (e) => {
  const r = e.target.closest('.link-row'); if (!r) return;
  if (linked.has(r.dataset.k)) linked.delete(r.dataset.k); else linked.add(r.dataset.k);
  paintLinks(); paintLinkLabel();
});

/* ---------- popovers ---------- */
function togglePop(pop, btn, paint) {
  const open = pop.hidden;
  closePops();
  if (!open) return;
  paint(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
}
function closePops() {
  [['#link-pop', '#ctx-btn'], ['#sess-pop', '#sess-btn']].forEach(([p, b]) => { $(p).hidden = true; $(b).setAttribute('aria-expanded', 'false'); });
}
$('#ctx-btn').addEventListener('click', () => togglePop($('#link-pop'), $('#ctx-btn'), paintLinks));
$('#sess-btn').addEventListener('click', () => togglePop($('#sess-pop'), $('#sess-btn'), paintSessions));
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.float-panel, #ctx-btn, #sess-btn, .chip')) { closePops(); if (!$('#payload').hidden) { $('#payload').hidden = true; paintChips(); } }
});

/* ---------- uma matéria: a peça fica na conversa e abre no quadro ---------- */
function showCourse(on) {
  $('#course').hidden = !on; $('#livre').hidden = on;
  document.querySelectorAll('#course-tabs [data-course]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.course === (on ? 'fis' : 'livre'))));
  if (!on) selectPiece(document.querySelector('.piece.is-on')?.id || session.open);
}
function seedCourse(img) {
  const box = $('#course-chat');
  box.innerHTML = '';
  addMsg('Hoje', 'sys-line', box);
  addMsg('Me mostra lançamento oblíquo de um jeito visual. A lista 3 é sobre isso.', 'msg-student', box);
  addMsg(`${tools('criar_peca', 'lancamento.cena.js · cena · 5 passos')}<p>Montei a cena. Dá para tocar aqui ou abrir no quadro da Livre, ao lado das outras peças.</p>
    <div class="inline-piece"><img alt="" src="${img}"><div class="inline-foot"><svg class="icon"><use href="#i-scene"/></svg><span class="t">Lançamento oblíquo</span><span class="k">cena</span><span class="grow"></span><button type="button" class="btn btn-layer" data-open-board="p-cena">Abrir no quadro</button></div></div>
    <p class="inline-note">Também na Livre · Revisão para a P2</p>`, 'msg-tutor', box);
}
function openFromCourse(id) {
  if (session.id !== 'p2') loadSession('p2');
  linked.add('Física I · Cinemática 2D'); paintLinkLabel();
  showCourse(false); selectPiece(id);
}
$('#course-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-course]'); if (!t) return;
  if (t.dataset.course === 'livre') showCourse(false);
  if (t.dataset.course === 'fis') {
    if (!$('#course-chat').children.length) { selectPiece('p-cena'); seedCourse(PIECES.cena.thumb()); }
    showCourse(true);
  }
});

/* ---------- links dentro das conversas ---------- */
function onChatClick(e) {
  const go = e.target.closest('[data-go]');
  if (go) { selectPiece(go.dataset.go); return; }
  const open = e.target.closest('[data-open-board]');
  if (open) { openFromCourse(open.dataset.openBoard); return; }
  const at = e.target.closest('[data-piece][data-at]');
  if (!at) return;
  const piece = PIECES[at.dataset.piece];
  selectPiece(piece.id); piece.goto(+at.dataset.at);
}
$('#chat').addEventListener('click', onChatClick);
$('#course-chat').addEventListener('click', onChatClick);

$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#msg').value.trim(), c = chips[0];
  if (!text && !c) return;
  const ref = c ? `<button type="button" class="ref" data-piece="${c.kind}" data-at="${c.at}">${c.img ? `<img alt="" src="${c.img}">` : ''}${c.label}</button>` : '';
  addMsg(`${ref}${esc(text)}`, 'msg-student');
  $('#msg').value = ''; clearChips();
  const answer = c ? PIECES[c.kind].reply(c, text) : '<p>Posso montar uma cena, um roteiro ou um desenho para isso no quadro.</p>';
  if (PROTO.embed) { addMsg(answer, 'msg-tutor'); return; }
  const th = addMsg('Pensando…', 'thinking');
  setTimeout(() => { th.remove(); addMsg(answer, 'msg-tutor'); }, 700);
});
$('#msg').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); } });

/* ---------- estados prontos ---------- */
function ask(kind, question, submit) {
  addChip(PIECES[kind].chip());
  $('#msg').value = question;
  if (submit) { $('#composer').requestSubmit(); return; }
  $('#payload').hidden = false; paintChips();
}
const PRESETS = {
  perguntar: () => { selectPiece('p-cena'); PIECES.cena.goto(PIECES.cena.stepTime(2)); ask('cena', 'Por que ela não para no topo, se a velocidade zera?'); },
  respondido: () => { selectPiece('p-cena'); PIECES.cena.goto(PIECES.cena.stepTime(2)); ask('cena', 'Por que ela não para no topo, se a velocidade zera?', true); },
  previsao: () => { selectPiece('p-cena'); PIECES.cena.openGate(); },
  roteiro: () => { selectPiece('p-rot'); PIECES.roteiro.goto(PIECES.roteiro.stepOfLine(6)); addChip(PIECES.roteiro.chip()); $('#msg').value = 'Por que aqui é mid + 1 e não só mid?'; },
  desenho: () => {
    selectPiece('p-draw');
    if (!PROTO.embed) { PIECES.desenho.play(); return; }
    PIECES.desenho.goto(pitMarca('conta', .55)); pit.playing = true; paintPit();   // quadro parado no meio da escrita, com cara de tocando
  },
  'desenho-perguntar': () => { selectPiece('p-draw'); PIECES.desenho.goto(pitMarca('deslize', .5)); ask('desenho', 'Por que a área que sobra continua igual?'); },
  'desenho-resposta': () => { selectPiece('p-draw'); PIECES.desenho.goto(pitMarca('deslize', .5)); ask('desenho', 'Por que a área que sobra continua igual?', true); },
  ligar: () => { PIECES.desenho.goto(pit.T); linked.add('Algoritmos II · Busca e ordenação'); paintLinkLabel(); $('#ctx-btn').click(); },
  sessoes: () => { PIECES.desenho.goto(pit.T); $('#sess-btn').click(); },
  estruturas: () => {
    loadSession('alg');
    PIECES.arvore.goto(PIECES.arvore.frameWhere((f) => f.linha === 2 && f.vars.v === 45));
    ask('arvore', 'Por que a pilha tem quatro chamadas aqui?');
  },
  'ver-peca': () => { SESSIONS.find((s) => s.id === 'alg').verAberto = true; loadSession('alg'); PIECES.arvore.goto(PIECES.arvore.passos() - 1); },
  materia: () => { selectPiece('p-cena'); PIECES.cena.goto(PIECES.cena.stepTime(2)); seedCourse(PIECES.cena.thumb()); showCourse(true); },
};
function preset(name) {
  Object.values(PIECES).forEach((p) => p.reset());
  SESSIONS.forEach((s) => { delete s.verAberto; });
  closePops(); $('#msg').value = ''; clearChips();
  $('#course-chat').innerHTML = ''; showCourse(false);
  loadSession('p2');
  document.querySelectorAll('#proto [data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
  (PRESETS[name] || PRESETS.desenho)();
}

if (PROTO.embed) $('#win').classList.add('narrow');
else {
  document.body.classList.add('full');
  $('#proto').hidden = false;
  $('#proto').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) preset(b.dataset.preset); });
  const repaint = () => { const kind = document.querySelector('.piece.is-on')?.dataset.kind; if (PIECES[kind]) PIECES[kind].redraw(); };
  $('#p-theme').addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; repaint(); });
  $('#p-accent').addEventListener('click', () => { root.dataset.accent = root.dataset.accent === 'violet' ? 'graphite' : 'violet'; repaint(); });
  addEventListener('resize', () => { $('#win').classList.toggle('narrow', innerWidth < 1000); repaint(); });
  $('#win').classList.toggle('narrow', innerWidth < 1000);
}
preset(PROTO.preset);
document.fonts.ready.then(() => { const kind = document.querySelector('.piece.is-on')?.dataset.kind; if (PIECES[kind]) PIECES[kind].redraw(); });
