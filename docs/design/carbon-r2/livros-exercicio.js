/* Exercício do livro no chat (rodada 2, 2026-11-26): um cartão como os de quiz da
   #92, aberto pelo "Resolver" do bloco de exercício.
   Regras (núcleo Bend, porque custam algo ao aluno):
   - a resposta do livro (apêndice, achado pelos marcadores) só aparece depois
     da primeira tentativa; antes, o botão fica desligado;
   - as dicas vêm uma por vez, até 3, e nenhuma pode conter a resposta;
   - o tutor confere a tentativa contra a resposta do livro sem citá-la.
   Errar, pedir a resposta ou usar as 3 dicas manda o exercício ao Caderno. */

const EXERCICIOS = {
  '1.1': {q: 'A sorted playlist has 500 songs. Using binary search, what is the largest number of guesses you might need?',
    resposta: '9 (2⁹ = 512 ≥ 500)', pagApendice: 241,
    dicas: ['Cada palpite corta o que sobra pela metade. Escreva a sequência: 500 → 250 → …',
      'Conte quantas setas cabem até sobrar 1 música.', 'Procure a menor potência de 2 que passa de 500.']},
};
const MAX_DICAS = 3;
let ex = null;   // {id, tentativas: [{r, ok, fb}], dicas: n, viu: bool}

function abrirExercicio(id) {
  ex = {id, tentativas: [], dicas: 0, viu: false};
  addMsg(`<div class="ex-card" id="ex-card"></div>`, 'msg-tutor ex-wrap');
  paintEx();
}
function exHtml() {
  const e = exercicio(ex.id);
  const podeVer = ex.tentativas.length > 0;
  const tent = ex.tentativas.map((t) => `<div class="ex-try ${t.ok ? 'ok' : 'bad'}"><span class="mono">${esc(t.r)}</span><span>${t.fb}</span></div>`).join('');
  const dicas = e.dicas.slice(0, ex.dicas).map((d, k) => `<div class="ex-hint"><b>Dica ${k + 1}</b><span>${d}</span></div>`).join('');
  const resp = ex.viu ? `<div class="ex-ans"><b>Resposta do livro</b><span>${e.resposta}</span><span class="k">p. ${e.pagApendice}</span></div>` : '';
  return `<div class="ex-head"><b>Exercício ${ex.id}</b><span class="k">p. ${pg}</span><span class="grow"></span><span class="k mono">dica ${ex.dicas} / ${MAX_DICAS}</span></div>
    <p class="ex-q">${e.q}</p>${dicas}${tent}${resp}
    <form class="ex-row" id="ex-form" onsubmit="return false"><input class="field-control" id="ex-in" placeholder="Sua resposta" aria-label="Sua resposta" autocomplete="off"><button type="submit" class="btn btn-primary">Conferir</button></form>
    <div class="ex-foot">
      <button type="button" class="btn btn-ghost" data-ex-act="dica" ${ex.dicas >= MAX_DICAS ? 'disabled' : ''}>${ex.dicas ? 'Outra dica' : 'Pedir dica'}</button>
      <button type="button" class="btn btn-ghost" data-ex-act="ver" ${podeVer && !ex.viu ? '' : 'disabled'} title="${podeVer ? '' : 'Depois da primeira tentativa'}">Ver a resposta do livro</button>
    </div>`;
}
const exercicio = (id) => EXERCICIOS[id] || EXERCICIOS['1.1'];
function paintEx() { $('#ex-card').innerHTML = exHtml(); }

/* No protótipo a conferência é fixa; no app quem confere é o tutor. */
function tentar(r) {
  const ok = r.trim() === '9';
  const fb = ok ? 'Certo: 2⁹ = 512 já cobre as 500.' : r.trim() === '250'
    ? 'Esse é o que sobra depois do 1º palpite. Continue cortando até sobrar 1.'
    : 'Ainda não. Quantas vezes dá para cortar 500 pela metade?';
  ex.tentativas.push({r, ok, fb});
  paintEx();
}
$('#chat').addEventListener('click', (e) => {
  const a = e.target.closest('[data-ex-act]');
  if (!a || !ex) return;
  if (a.dataset.exAct === 'dica') ex.dicas = Math.min(MAX_DICAS, ex.dicas + 1);
  if (a.dataset.exAct === 'ver') ex.viu = true;
  paintEx();
});
$('#chat').addEventListener('submit', (e) => {
  if (e.target.id !== 'ex-form') return;
  const r = $('#ex-in').value;
  if (r.trim()) tentar(r);
});
