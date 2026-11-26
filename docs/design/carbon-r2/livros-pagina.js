/* Página do livro no protótipo da aba Livros (rodada 2, 2026-11-26): o índice de
   blocos que a importação grava, a cortina recortada e o "Ver os blocos".
   O texto, o código e os desenhos foram escritos para o protótipo; não são do livro.

   Cada bloco tem `passo` (a ordem da cortina) e `tipo` (texto, titulo, figura,
   codigo, nota, exercicio). O título vai no passo do bloco seguinte; a nota de
   margem vai no passo da figura ao lado (regras do teste com o PDF real). */

const FIG_RETA = `<svg viewBox="0 0 480 92" class="fig" role="img" aria-label="Reta de 1 a 100 com o palpite 50 e a metade de baixo riscada">
  <path d="M24 52H456" class="f-ink"/>${Array.from({length: 11}, (_, i) => `<path d="M${24 + i * 43.2} 46v12" class="f-ink"/>`).join('')}
  <text x="24" y="80" class="f-t" text-anchor="middle">1</text><text x="456" y="80" class="f-t" text-anchor="middle">100</text>
  <path d="M26 44 238 44" class="f-cross"/><circle cx="240" cy="52" r="9" class="f-dot"/><text x="240" y="80" class="f-t" text-anchor="middle">50</text>
  <text x="130" y="20" class="f-hand" text-anchor="middle">“too low!”</text><text x="350" y="30" class="f-hand" text-anchor="middle">still in play</text>
</svg>`;
const FIG_LIVRO = `<svg viewBox="0 0 150 210" class="fig" role="img" aria-label="Dicionário aberto no meio, com uma seta">
  <path d="M12 92q31-12 63 0q32-12 63 0v78q-31-12-63 0q-32-12-63 0z" class="f-ink"/><path d="M75 92v78" class="f-ink"/>
  ${[104, 116, 128, 140].map((y) => `<path d="M24 ${y}q20-6 40 0M86 ${y}q20-6 40 0" class="f-thin"/>`).join('')}
  <path d="M75 20v56" class="f-ink"/><path d="M66 66l9 12 9-12" class="f-ink"/>
  <text x="75" y="196" class="f-hand" text-anchor="middle">open near</text><text x="75" y="14" class="f-hand" text-anchor="middle">the middle!</text>
</svg>`;

const CODIGO = ['def find(items, target):', '    first, last = 0, len(items) - 1', '    while first <= last:',
  '        middle = (first + last) // 2', '        value = items[middle]', '        if value == target:', '            return middle',
  '        if value < target:', '            first = middle + 1', '        else:', '            last = middle - 1', '    return None'];
const cod = (a, b) => `<pre class="pcode">${CODIGO.slice(a, b).map(esc).join('\n')}</pre>`;

const PAGINAS = {
  6: {run: ['Chapter 1', 'Introduction to algorithms'], blocos: [
    {passo: 1, tipo: 'titulo', html: '<h2>Binary search</h2>'},
    {passo: 1, tipo: 'texto', html: '<p>Say you need a word in a dictionary with a few thousand pages. You could start on page one and flip forward until you reach it. Nobody does that.</p>'},
    {passo: 2, tipo: 'texto', id: 'p2', html: '<p>You open somewhere near the middle, see which side the word falls on, and ignore the other half. That move has a name: <i>binary search</i>. It has one condition: the list must be sorted.</p>'},
    {passo: 3, tipo: 'figura', margem: 'p2', html: `<figure>${FIG_LIVRO}</figure>`},
    {passo: 4, tipo: 'texto', html: '<p>Hand it a sorted list and an item, and it gives back where the item is, or <span class="code-i">null</span> if it isn’t there.</p>'},
    {passo: 5, tipo: 'texto', html: '<p>Try a game. I’m thinking of a number from 1 to 100. After each guess I only say <i>too low</i>, <i>too high</i> or <i>correct</i>.</p>'},
    {passo: 6, tipo: 'figura', html: `<figure>${FIG_RETA}</figure>`},
    {passo: 7, tipo: 'texto', html: '<p>Guess 1, then 2, then 3, and you may need a hundred tries. Guess 50 instead: whatever I answer, half of the numbers are gone in a single move.</p>'},
    {passo: 8, tipo: 'texto', html: '<p>Then guess 75 or 25, and keep going. Each guess halves what is left, so 100 numbers need at most 7 guesses.</p>'},
    {passo: 9, tipo: 'titulo', html: '<h2>A better way to search</h2>'},
    {passo: 9, tipo: 'texto', html: '<p>Now picture the contacts in a phone app. Simple search reads them one by one; binary search jumps to the middle of whatever is left.</p>'},
  ]},
  /* Página 7: a listagem com anotações saiu partida em cinco blocos, como no
     teste com a p. 127 do PDF real. O "Ver os blocos" junta. */
  7: {run: ['Binary search', '7'], blocos: [
    {passo: 1, tipo: 'texto', html: '<p>Here is the whole idea in code. Two markers, <span class="code-i">first</span> and <span class="code-i">last</span>, hold the part of the list still in play.</p>'},
    {passo: 2, tipo: 'codigo', id: 'c1', html: cod(0, 2)},
    {passo: 3, tipo: 'nota', margem: 'c1', html: '<p class="anot">← the part still in play</p>'},
    {passo: 4, tipo: 'codigo', id: 'c2', html: cod(2, 5)},
    {passo: 5, tipo: 'nota', margem: 'c2', html: '<p class="anot">← look at the middle item</p>'},
    {passo: 6, tipo: 'codigo', html: cod(5, 12)},
    {passo: 7, tipo: 'texto', html: '<p>Each turn of the loop throws away half of what is left, which is the whole trick.</p>'},
  ]},
  /* Página 9: exercícios no fim da seção. A resposta do livro fica no apêndice,
     que a importação acha pelos marcadores ("answers to exercises"). */
  9: {run: ['Chapter 1', 'Introduction to algorithms'], blocos: [
    {passo: 1, tipo: 'texto', html: '<p>Binary search only pays off when the list is sorted; sorting has its own cost, which chapter 2 deals with.</p>'},
    {passo: 2, tipo: 'titulo', html: '<h3 class="ex-h">EXERCISES</h3>'},
    {passo: 2, tipo: 'exercicio', ex: '1.1', html: '<p class="ex"><b>1.1</b> A sorted playlist has 500 songs. Using binary search, what is the largest number of guesses you might need?</p>'},
    {passo: 3, tipo: 'exercicio', ex: '1.2', html: '<p class="ex"><b>1.2</b> Would binary search still help if the playlist were shuffled? Why?</p>'},
  ]},
};

let pg = 6;               // página aberta
let mode = 'ler';          // 'ler' ou 'blocos'
let picked = new Set();    // blocos escolhidos no "Ver os blocos"
const blocos = () => PAGINAS[pg].blocos;
const passos = () => Math.max(...blocos().map((b) => b.passo));
const doPasso = (n) => blocos().map((b, i) => ({...b, i})).filter((b) => b.passo === n);

function paintPage() {
  const html = blocos().map((b, i) => {
    const cls = ['blk', `t-${b.tipo}`, b.margem ? 'margem' : '', b.passo === sent ? 'sent' : '', ...estadoDoPasso(b.passo)].join(' ');
    const resolver = b.ex && mode === 'ler' ? `<button type="button" class="solve" data-ex="${b.ex}">Resolver</button>` : '';
    return `<div class="${cls}" data-b="${i}" data-p="${b.passo}"${b.id ? ` id="b-${b.id}"` : ''}>${b.html}${resolver}</div>`;
  }).join('');
  const [l, r] = PAGINAS[pg].run;
  $('#page').innerHTML = `<div class="run" data-run><span>${l}</span><span>${r}</span></div>${html}<div class="folio">${pg}</div>
    ${checking ? checkCard() : ''}<div id="bx"></div>`;
  $('#page').classList.toggle('is-blocos', mode === 'blocos');
  $('#blocos-strip').hidden = mode !== 'blocos';
  $('.book-head .mono.k').textContent = `p. ${pg} / ${BOOK.paginas}`;
  $('#where').textContent = `Cap. 1 · Binary search · p. ${pg}`;
  layoutPage();
  paintBar();
}

/* O bloco já nasce com o borrão: se ganhasse a classe depois, a transição
   o mostraria nítido por um instante. */
function estadoDoPasso(p) {
  const on = mode === 'ler' && $('#active-read').checked;
  if (on && p > shown) return ['veil'];
  return mode === 'ler' && p === shown && !checking ? ['cur'] : [];
}

/* A nota e a figura de margem ficam na altura do bloco que acompanham. */
function layoutPage() {
  $('#page').querySelectorAll('.blk.margem').forEach((el) => {
    const host = $(`#b-${blocos()[+el.dataset.b].margem}`);
    el.style.top = `${host.offsetTop}px`;
  });
  placeCurtain();
  if (mode === 'blocos') paintBoxes();
}

/* A cortina recortada: cada bloco ainda não revelado fica borrado no lugar
   dele, então a figura de margem aparece no passo dela, não junto com o
   parágrafo vizinho. (Um recorte único com clip-path evenodd não serve: o
   Chromium ignora os furos no backdrop-filter.) No app, sobre o canvas do PDF,
   é uma caixa com backdrop-filter por bloco escondido. */
function holeOf(el, pad = 4) {
  return {x: el.offsetLeft - pad, y: el.offsetTop - pad, w: el.offsetWidth + pad * 2, h: el.offsetHeight + pad * 2};
}
function placeCurtain() {
  const page = $('#page');
  const on = mode === 'ler' && $('#active-read').checked;
  page.querySelectorAll('.blk').forEach((el) => {
    const est = estadoDoPasso(+el.dataset.p);
    el.classList.toggle('veil', est.includes('veil'));
    el.classList.toggle('cur', est.includes('cur'));
  });
  page.classList.toggle('veiled', on && shown < passos());
  page.style.minHeight = '';
  const card = $('#check');
  if (!card) return;
  const next = page.querySelector(`.blk[data-p="${shown + 1}"]`);
  card.style.top = `${next.offsetTop + 4}px`;
  page.style.minHeight = `${card.offsetTop + card.offsetHeight + 32}px`;
}

/* ---------- Ver os blocos ----------
   Caixa por bloco, com o número do passo. Clicar escolhe (⇧ para vários);
   Juntar faz um passo só; Separar parte o bloco na linha clicada; "Não é
   bloco" tira do índice (cabeçalho, marca d'água). O conserto fica no índice. */
const COR = {texto: 'plot-1', titulo: 'plot-5', codigo: 'plot-3', nota: 'plot-1', figura: 'plot-2', exercicio: 'plot-5'};
function paintBoxes() {
  const page = $('#page');
  $('#bx').innerHTML = [...page.querySelectorAll('.blk')].map((el) => {
    const h = holeOf(el, 3), i = +el.dataset.b, b = blocos()[i];
    return `<button type="button" class="bx${picked.has(i) ? ' on' : ''}" data-pick="${i}" style="left:${h.x}px;top:${h.y}px;width:${h.w}px;height:${h.h}px;--c:var(--${COR[b.tipo]})" aria-label="Bloco ${i + 1}, passo ${b.passo}, ${b.tipo}"><span>${b.passo}</span></button>`;
  }).join('');
  $('#blocos-sel').innerHTML = selBar();
}
/* As ações da escolha ficam na faixa de cima, não flutuando sobre a página:
   uma barra flutuante sempre tampa o bloco vizinho. */
function selBar() {
  if (!picked.size) return '<span class="k">clique para escolher · ⇧ para vários</span>';
  const n = picked.size;
  return `<span class="k">${n} ${n > 1 ? 'blocos' : 'bloco'}</span>
    ${n > 1 ? `<button type="button" class="btn btn-primary" data-act="juntar">Juntar num passo</button>` : '<button type="button" class="btn btn-ghost" data-act="separar">Separar aqui</button>'}
    <button type="button" class="btn btn-ghost" data-act="tirar">Não é bloco</button>`;
}
function juntar() {
  const idx = [...picked].sort((a, b) => a - b);
  const alvo = blocos()[idx[0]].passo;
  const sai = new Set(idx.map((i) => blocos()[i].passo));
  sai.delete(alvo);
  blocos().forEach((b) => { if (sai.has(b.passo)) b.passo = alvo; });
  const ordem = [...new Set(blocos().map((b) => b.passo))].sort((a, b) => a - b);
  blocos().forEach((b) => { b.passo = ordem.indexOf(b.passo) + 1; });
  picked.clear();
  paintPage();
}
$('#page').addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const i = +pick.dataset.pick;
    if (!e.shiftKey) { const had = picked.has(i) && picked.size === 1; picked.clear(); if (!had) picked.add(i); }
    else if (picked.has(i)) picked.delete(i); else picked.add(i);
    paintBoxes();
    return;
  }
});
$('#blocos-strip').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act === 'juntar') juntar();
});
