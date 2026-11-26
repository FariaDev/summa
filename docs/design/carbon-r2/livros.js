/* Casca do protótipo da aba Livros (rodadas 1 e 2, 2026-11-26): estante,
   importação, leitor com a cortina, "Perguntar aqui", "Antes de seguir",
   sumário e estados prontos. A página e o "Ver os blocos" estão em
   livros-pagina.js; o exercício com dicas, em livros-exercicio.js. Usa $, esc,
   addChip e o tema de quadro-base.js. */

const BOOK = {
  titulo: 'Grokking Algorithms', autor: 'Aditya Y. Bhargava', paginas: 256, pagina: 6, noCaderno: 4,
  capitulos: ['Introduction to algorithms', 'Selection sort', 'Recursion', 'Quicksort', 'Hash tables',
    'Breadth-first search', "Dijkstra's algorithm", 'Greedy algorithms', 'Dynamic programming',
    'K-nearest neighbors', 'Where to go next'],
};
/* Seções do capítulo 1, como viriam dos marcadores do PDF. `blocos` conta os
   blocos que a cortina revela (parágrafos e figuras da camada de texto). */
const SECOES = [
  {t: 'Introduction', blocos: 5}, {t: 'Binary search', blocos: 8}, {t: 'A better way to search', blocos: 6},
  {t: 'Running time', blocos: 4}, {t: 'Big O notation', blocos: 9}, {t: 'Recap', blocos: 2},
];
const SEC = 1;

const FIM_DA_SECAO = 8;

let shown = 4;          // passos revelados (o atual é o último)
let sent = -1;          // passo que foi com a pergunta
let checking = false;   // "Antes de seguir" aberto

/* ---------- estante ----------
   A capa é a página 1 do PDF, desenhada pelo leitor (no protótipo, PROTO.cover
   quando a captura traz uma imagem; sem ela, uma página só com o título). O
   aluno troca a página da capa no menu do livro. */
function coverHtml() {
  if (PROTO.cover) return `<img class="cover cover-img" alt="" src="${PROTO.cover}">`;
  return `<div class="cover" aria-hidden="true"><span class="cv-a">grokking</span><span class="cv-b">algorithms</span><span class="cv-c">${BOOK.autor}</span></div>`;
}
function paintShelf() {
  const pct = Math.round(BOOK.pagina / BOOK.paginas * 100);
  $('#shelf-grid').innerHTML = `
    <article class="book-card">
      ${coverHtml()}
      <div class="book-card-body">
        <b>${BOOK.titulo}</b>
        <div class="book-prog"><span>Cap. 1 · ${SECOES[SEC].t}</span><span class="mono">${pct}%</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="book-card-foot"><button type="button" class="btn btn-primary" data-open>Continuar</button><span class="k">${BOOK.noCaderno} no Caderno</span></div>
    </article>
    ${importing ? importHtml() : '<div class="book-add"><svg class="icon"><use href="#i-plus"/></svg><span>Solte o PDF de um livro aqui</span><button type="button" class="btn btn-layer">Escolher arquivo</button></div>'}`;
}

/* ---------- importar: o que deu para ler do PDF ----------
   Nada é convertido: o PDF fica como está. A Mesa só lê a camada de texto e os
   marcadores e guarda os blocos num índice ao lado. Onde não dá, cai um nível:
   sem marcadores, as seções saem do tamanho da fonte dos títulos; sem texto
   (escaneado), a cortina anda por faixas da página e o recorte vai como imagem. */
let importing = false;
const IMPORT = {titulo: 'Introduction to Linear Algebra', linhas: [
  ['ok', 'Texto', '412 de 418 páginas'],
  ['ok', 'Sumário', '10 capítulos e 61 seções, dos marcadores do PDF'],
  ['ok', 'Blocos', 'parágrafos, figuras, tabelas e código'],
  ['warn', 'Sem texto', 'p. 1–4 e 415–418: a cortina anda por faixas'],
]};
function importHtml() {
  const rows = IMPORT.linhas.map(([st, k, v]) => `<div class="imp-row ${st}"><svg class="icon"><use href="#i-${st === 'ok' ? 'check' : 'alert'}"/></svg><span>${k}</span><span>${v}</span></div>`).join('');
  return `<article class="book-card imp">
    <div class="imp-head"><b>${IMPORT.titulo}</b><small>Lido em 6 s · o PDF não muda</small></div>
    <div class="imp-rows">${rows}</div>
    <div class="book-card-foot"><button type="button" class="btn btn-primary">Começar a ler</button><button type="button" class="btn btn-ghost">Ver os blocos</button></div>
  </article>`;
}

function paintBar() {
  const done = shown;
  $('#sec-track').innerHTML = SECOES.map((s, i) => {
    const f = i < SEC ? 1 : i > SEC ? 0 : Math.min(1, done / s.blocos);
    return `<span class="sec${i === SEC ? ' is-cur' : ''}" style="flex:${s.blocos}" title="${s.t}"><i style="width:${f * 100}%"></i></span>`;
  }).join('');
  $('#sec-read').textContent = `${Math.min(done, SECOES[SEC].blocos)} / ${SECOES[SEC].blocos}`;
  $('#reveal').disabled = checking;
}
function reveal() {
  if (mode !== 'ler' || checking || shown >= passos()) return;
  if (pg === 6 && shown === FIM_DA_SECAO) { checking = true; paintPage(); return; }
  /* Só troca as classes: redesenhar a página faria os blocos nascerem nítidos
     e borrarem na transição, um piscar do texto inteiro. */
  shown++; placeCurtain(); paintBar();
  $(`#page .blk[data-p="${shown}"]`).scrollIntoView({block: 'nearest', behavior: 'smooth'});
}

/* ---------- Antes de seguir: fim da seção ----------
   Pergunta gerada pelo tutor quando o aluno entra na seção, para não haver
   espera no fim. Errar ou pular manda o item ao Caderno. */
const Q = {q: 'Uma lista ordenada tem 1.000 nomes. No pior caso, mais ou menos quantos palpites a busca binária faz?', opts: ['10', '100', '500', '1.000'], certa: 0,
  fb: 'Certo. Cada palpite corta pela metade: 1.000 → 500 → 250 → … → 1 em uns 10 passos.'};
let marcada = -1;
function checkCard() {
  const opts = Q.opts.map((o, i) => {
    const st = marcada < 0 ? '' : i === Q.certa ? ' ok' : i === marcada ? ' bad' : '';
    return `<button type="button" class="opt${st}" data-opt="${i}" ${marcada >= 0 ? 'disabled' : ''}>${o}</button>`;
  }).join('');
  return `<section class="check" id="check" aria-label="Antes de seguir">
    <div class="check-head"><b>Antes de seguir</b><span class="k">${SECOES[SEC].t}</span><span class="grow"></span><span class="mono k">1 / 2</span></div>
    <p class="check-q">${Q.q}</p><div class="opts">${opts}</div>
    ${marcada >= 0 ? `<p class="check-fb">${marcada === Q.certa ? Q.fb : 'Ainda não. Vai para o Caderno; tente pensar em quantas vezes 1.000 cabe pela metade.'}</p>` : ''}
    <div class="check-foot">${marcada >= 0 ? '<button type="button" class="btn btn-primary">Próxima</button>' : '<button type="button" class="btn btn-ghost" id="skip">Pular</button>'}<span class="grow"></span><span class="k">Errou ou pulou: volta no Caderno</span></div>
  </section>`;
}

/* ---------- Perguntar aqui: o bloco atual vai junto ---------- */
function recorte(i) {  // no app: o recorte do bloco, desenhado pelo leitor
  const lines = Array.from({length: 3}, (_, k) => `<rect x="6" y="${8 + k * 10}" width="${k === 2 ? 60 : 108}" height="4" rx="2" fill="#8d8d8d"/>`).join('');
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#fff"/>${lines}</svg>`) + `#b${i}`;
}
/* O texto vai junto, mas o recorte também: no PDF real as ligaduras somem da
   camada de texto ("first" vira "irst"), e o modelo lê a imagem certa. */
function askHere(text) {
  const i = shown;
  sent = i;
  const trecho = doPasso(i).map((b) => b.html.replace(/<[^>]+>/g, '')).join(' ');
  addChip({img: recorte(i), label: `p. ${pg} · passo ${i}`, rows: [
    ['Livro', `${BOOK.titulo} · ${BOOK.autor}`],
    ['Onde', `<span class="mono">Cap. 1 › ${SECOES[SEC].t} · p. ${pg} · passo ${i} de ${SECOES[SEC].blocos}</span>`],
    ['Trecho', `<span class="serif">“${esc(trecho)}”</span>`],
    ['Recorte', `<img alt="Recorte do bloco" src="${recorte(i)}">`],
    ['Leu até', 'aqui; o tutor não adianta o que vem depois'],
  ]});
  paintPage();
  if (text) $('#msg').value = text;
}

/* ---------- conversa ---------- */
function addMsg(html, cls) {
  const d = document.createElement('div');
  d.className = cls; d.innerHTML = html; $('#chat').appendChild(d);
  if (!PROTO.embed) $('#chat').scrollTop = $('#chat').scrollHeight;
}
const MINI = `<svg viewBox="0 0 600 96" class="mini" role="img" aria-label="Três palpites: 50, 75, 62">
  ${[[1, 100, 50], [51, 100, 75], [51, 74, 62]].map(([a, b, g], r) => {
    const x = (v) => 40 + (v - 1) * 5.3, y = 14 + r * 28;
    return `<text x="4" y="${y + 9}" class="est-idx">${r + 1}º</text><rect x="${x(1)}" y="${y}" width="${x(100) - x(1)}" height="12" rx="2" class="est-cel" opacity=".35"/>
      <rect x="${x(a)}" y="${y}" width="${x(b) - x(a)}" height="12" rx="2" class="est-cel"/><rect x="${x(g) - 2}" y="${y - 3}" width="4" height="18" rx="1" class="est-cel atual"/>
      <text x="${x(g) + 8}" y="${y + 10}" class="est-ptr-t">${g}</text>`;
  }).join('')}</svg>`;
function seedChat() {
  $('#chat').innerHTML = '';
  addMsg('Hoje · Cap. 1', 'sys-line');
}
function answer(q) {
  addMsg(`<button type="button" class="ref"><img alt="" src="${recorte(sent)}">p. ${pg} · passo ${sent}</button>${esc(q)}`, 'msg-student');
  addMsg(`<p>Porque o 50 garante cortar metade, <i>qualquer</i> que seja a resposta. Um palpite como 80 corta muito se o número for alto, mas se eu disser “muito alto” ainda sobram 79.</p>
    <p>O meio é o palpite que deixa o pior caso o menor possível. Quantos palpites isso dá no máximo o livro mostra logo adiante; quer chutar antes de revelar?</p>
    <div class="tools-wrap"><details class="tools"><summary><svg class="icon tool-ok"><use href="#i-check"/></svg>criar_peca<span class="tools-what">roteiro · palpites de 1 a 100</span></summary></details></div>
    <div class="inline-piece">${MINI}<div class="inline-foot"><svg class="icon"><use href="#i-code"/></svg><span class="t">Palpites até 62</span><span class="k">roteiro</span><span class="grow"></span><button type="button" class="icon-btn" aria-label="Tocar"><svg class="icon icon-fill"><use href="#i-play"/></svg></button><button type="button" class="btn btn-ghost">Abrir no quadro</button></div></div>`, 'msg-tutor');
}

/* ---------- sumário ---------- */
function paintToc() {
  $('#toc-list').innerHTML = BOOK.capitulos.map((c, i) => {
    const cap = `<button type="button" class="toc-row${i === 0 ? ' open' : ''}"><span class="mono n">${i + 1}</span><span>${c}</span><span class="mono k">${i === 0 ? '2 / 6' : ''}</span></button>`;
    if (i) return cap;
    return cap + SECOES.map((s, k) => `<button type="button" class="toc-row sec-row"${k === SEC ? ' aria-current="true"' : ''}><span>${k < SEC ? '<svg class="icon"><use href="#i-check"/></svg>' : ''}</span><span>${s.t}</span><span class="mono k">${k === SEC ? `${shown} / ${s.blocos}` : ''}</span></button>`).join('');
  }).join('');
}

/* ---------- vistas e estados prontos ---------- */
function show(view) {
  $('#shelf').hidden = view !== 'shelf';
  $('#reader').hidden = view !== 'reader';
  if (view === 'reader') requestAnimationFrame(layoutPage);
}
const PRESETS = {
  estante: () => show('shelf'),
  importar: () => { importing = true; paintShelf(); show('shelf'); },
  leitura: () => show('reader'),
  perguntar: () => { shown = 7; paintPage(); show('reader'); askHere('por que 50 e não um número qualquer?'); $('#payload').hidden = false; paintChips(); },
  resposta: () => { shown = 7; paintPage(); show('reader'); askHere(); clearChips(); answer('por que 50 e não um número qualquer?'); },
  conferir: () => { shown = FIM_DA_SECAO; checking = true; marcada = 0; show('reader'); paintPage(); },
  sumario: () => { show('reader'); paintToc(); $('#toc-pop').hidden = false; $('#toc-btn').setAttribute('aria-expanded', 'true'); },
  blocos: () => { pg = 7; mode = 'blocos'; [1, 2, 3, 4, 5].forEach((i) => picked.add(i)); show('reader'); paintPage(); },
  exercicio: () => { pg = 9; shown = 3; show('reader'); paintPage(); abrirExercicio('1.1'); ex.dicas = 1; tentar('250'); },
};
/* As páginas voltam ao índice original a cada estado pronto. */
const ORIGINAL = JSON.stringify(PAGINAS);
function preset(name) {
  Object.assign(PAGINAS, JSON.parse(ORIGINAL));
  pg = 6; mode = 'ler'; picked.clear();
  shown = 4; sent = -1; checking = false; marcada = -1; importing = false;
  $('#msg').value = ''; clearChips(); $('#toc-pop').hidden = true; $('#toc-btn').setAttribute('aria-expanded', 'false');
  seedChat(); paintShelf(); paintPage();
  document.querySelectorAll('#proto [data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
  (PRESETS[name] || PRESETS.leitura)();
}

/* ---------- ligações ---------- */
$('#shelf-grid').addEventListener('click', (e) => { if (e.target.closest('[data-open]')) show('reader'); });
$('#to-shelf').addEventListener('click', () => show('shelf'));
$('#books-tab').addEventListener('click', () => show('shelf'));
$('#reveal').addEventListener('click', reveal);
$('#page').addEventListener('click', (e) => {
  if (e.target.closest('.veil')) return reveal();
  const o = e.target.closest('[data-opt]');
  if (o) { marcada = +o.dataset.opt; paintPage(); return; }
  const sv = e.target.closest('[data-ex]');
  if (sv) abrirExercicio(sv.dataset.ex);
  if (e.target.id === 'skip') { checking = false; shown++; paintPage(); }
});
$('#active-read').addEventListener('change', () => { $('#read-bar').classList.toggle('off', !$('#active-read').checked); placeCurtain(); });
$('#book-more').addEventListener('click', () => { mode = mode === 'blocos' ? 'ler' : 'blocos'; picked.clear(); paintPage(); });
$('#blocos-done').addEventListener('click', () => { mode = 'ler'; picked.clear(); paintPage(); });
$('#toc-btn').addEventListener('click', () => {
  const open = $('#toc-pop').hidden;
  if (open) paintToc();
  $('#toc-pop').hidden = !open; $('#toc-btn').setAttribute('aria-expanded', String(open));
});
addEventListener('keydown', (e) => {
  if ($('#reader').hidden || e.target.closest('textarea,input')) return;
  if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); reveal(); }
});
$('#read-bar').insertAdjacentHTML('beforeend', '<button type="button" class="ask-btn" id="ask"><svg class="icon"><use href="#i-ask"/></svg>Perguntar aqui</button>');
$('#ask').addEventListener('click', () => { askHere(); $('#msg').focus(); });
$('#composer').addEventListener('submit', () => {
  const q = $('#msg').value.trim();
  if (!q) return;
  clearChips(); $('#msg').value = ''; answer(q);
});

if (PROTO.embed) $('#win').classList.add('narrow');
else {
  document.body.classList.add('full');
  $('#proto').hidden = false;
  $('#proto').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) preset(b.dataset.preset); });
  $('#p-theme').addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; });
  $('#p-accent').addEventListener('click', () => { root.dataset.accent = root.dataset.accent === 'violet' ? 'graphite' : 'violet'; });
  addEventListener('resize', () => { $('#win').classList.toggle('narrow', innerWidth < 1000); layoutPage(); });
  $('#win').classList.toggle('narrow', innerWidth < 1000);
}
preset(PROTO.preset);
document.fonts.ready.then(layoutPage);
