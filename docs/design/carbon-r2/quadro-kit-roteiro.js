/* quadro-kit-roteiro.js: kit de estruturas do roteiro (vetor, árvore, pilha).
   O modelo escreve só o algoritmo e os pontos de parada (k.linha), como em
   busca-binaria.roteiro.js. O kit grava cada passo como instantâneo e é dono
   do desenho, das cores (tokens), do ritmo, da transição e do "Perguntar aqui".
   verPeca é a ver_peca do protótipo: grava duas vezes, confere e devolve
   avisos e quadros-chave, como a ver_figura faz com as figuras (#60). */

const ROTEIRO_RITMO = {passo: 600, maxPassos: 400};
const EST = {W: 480, pad: 12, cel: 40, celH: 34, gap: 4, nomeW: 28, ptrRow: 20, dx: 44, dy: 54, r: 16};
const COR_PONTEIRO = ['var(--plot-1)', 'var(--plot-2)', 'var(--plot-5)', 'var(--plot-3)'];
const LIMITE = {nota: 110, celulas: 11, largura: 10, niveis: 6, pilha: 7, item: 24, passos: 120};
const ESTADOS = {vetor: ['atual', 'achado'], arvore: ['atual', 'novo', 'caminho']};
const attrEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- gravação: roda o roteiro uma vez e guarda os passos ---------- */
function conferirEstado(tipo, estado) {
  if (ESTADOS[tipo].includes(estado)) return;
  throw new Error(`estado de ${tipo} deve ser ${ESTADOS[tipo].map((e) => `'${e}'`).join(' ou ')}; recebi ${JSON.stringify(estado)}`);
}
function novoVetor(nome, valores) {
  const s = {tipo: 'vetor', nome, valores: [...valores], faixa: null, ponteiros: {}, marcas: {}, cores: {}};
  const api = {
    faixa(lo, hi) { s.faixa = [lo, hi]; },
    ponteiros(p) {
      s.ponteiros = {...p};
      for (const n in p) if (!(n in s.cores)) s.cores[n] = Object.keys(s.cores).length % COR_PONTEIRO.length;
    },
    marcar(i, estado) { conferirEstado('vetor', estado); s.marcas[i] = estado; },
    definir(i, v) { s.valores[i] = v; },
    limpar() { s.marcas = {}; },
  };
  return {api, snap: () => structuredClone(s)};
}
function novaArvore(nome) {
  const s = {tipo: 'arvore', nome, nos: []};
  let seq = 0;
  const no = (id) => {
    const n = s.nos.find((x) => x.id === id);
    if (!n) throw new Error(`nó ${JSON.stringify(id)} não existe em "${nome}"; use o id que raiz() ou filho() devolveu`);
    return n;
  };
  const criar = (v, pai, lado) => { const id = `n${++seq}`; s.nos.push({id, v, pai, lado, estado: ''}); return id; };
  const api = {
    raiz(v) {
      if (s.nos.some((n) => !n.pai)) throw new Error(`"${nome}" já tem raiz; para outro nó use filho(pai, 'esq' | 'dir', valor)`);
      return criar(v, null, null);
    },
    filho(pai, lado, v) {
      no(pai);
      if (lado !== 'esq' && lado !== 'dir') throw new Error(`lado deve ser 'esq' ou 'dir'; recebi ${JSON.stringify(lado)}`);
      if (s.nos.some((n) => n.pai === pai && n.lado === lado)) throw new Error(`o nó ${pai} já tem filho à ${lado}`);
      return criar(v, pai, lado);
    },
    /* Só um nó é o atual; o anterior vira caminho, e o rastro fica visível. */
    marcar(id, estado) {
      conferirEstado('arvore', estado);
      if (estado === 'atual') s.nos.forEach((n) => { if (n.estado === 'atual') n.estado = 'caminho'; });
      no(id).estado = estado;
    },
    limpar() { s.nos.forEach((n) => { n.estado = ''; }); },
  };
  return {api, snap: () => structuredClone(s)};
}
function novaPilha(nome) {
  const s = {nome, itens: []};
  const api = {
    empilhar(t) { s.itens.push(String(t)); },
    desempilhar() {
      if (!s.itens.length) throw new Error(`desempilhar com "${nome}" vazia; cada desempilhar precisa de um empilhar antes`);
      s.itens.pop();
    },
  };
  return {api, snap: () => structuredClone(s)};
}

function gravar(def, entradas) {
  const frames = [], marcos = [], estruturas = [];
  let pilha = null;
  const guardar = (s) => { estruturas.push(s); return s.api; };
  const k = {
    vetor: (nome, valores) => guardar(novoVetor(nome, valores)),
    arvore: (nome) => guardar(novaArvore(nome)),
    pilha(nome) {
      if (pilha) throw new Error(`um roteiro tem uma pilha só; recebi a segunda: "${nome}"`);
      pilha = novaPilha(nome);
      return pilha.api;
    },
    marco(label) { marcos.push({t: frames.length, label: String(label)}); },
    linha(n, nota, vars = {}) {
      if (frames.length >= ROTEIRO_RITMO.maxPassos) throw new Error(`o roteiro passou de ${ROTEIRO_RITMO.maxPassos} passos; diminua a entrada ou os pontos de parada`);
      frames.push({linha: n, nota: String(nota ?? ''), vars: {...vars}, est: estruturas.map((s) => s.snap()), pilha: pilha && pilha.snap()});
    },
  };
  def.roteiro(k, entradas);
  if (!frames.length) throw new Error('o roteiro não chamou k.linha nenhuma vez; sem passos não há o que mostrar');
  if (!marcos.length || marcos[0].t > 0) marcos.unshift({t: 0, label: def.titulo});
  return {frames, marcos, ...medidas(frames)};
}

/* ---------- medidas: o palco tem o tamanho do maior passo, e não pula ---------- */
function layoutArvore(e) {
  const filho = (id, lado) => e.nos.find((n) => n.pai === id && n.lado === lado);
  const pos = {};
  let i = 0, prof = 0;
  const visita = (n, d) => {
    if (!n) return;
    visita(filho(n.id, 'esq'), d + 1);
    pos[n.id] = {i: i++, d}; prof = Math.max(prof, d);
    visita(filho(n.id, 'dir'), d + 1);
  };
  visita(e.nos.find((n) => !n.pai), 0);
  return {pos, n: i, prof, filho};
}
const MEDIR = {
  vetor: (e) => ({w: EST.nomeW + e.valores.length * (EST.cel + EST.gap), h: EST.celH + 22 + Object.keys(e.cores).length * EST.ptrRow}),
  arvore(e) {
    const L = layoutArvore(e);
    return {w: L.n * EST.dx, h: e.nos.length ? 2 * EST.r + L.prof * EST.dy : 0, niveis: e.nos.length ? L.prof + 1 : 0, largura: L.n};
  },
};
function medidas(frames) {
  const alt = [], larg = [];
  let maxPilha = 0;
  for (const f of frames) {
    f.est.forEach((e, j) => { const m = MEDIR[e.tipo](e); alt[j] = Math.max(alt[j] || 0, m.h); larg[j] = Math.max(larg[j] || 0, m.w); });
    if (f.pilha) maxPilha = Math.max(maxPilha, f.pilha.itens.length);
  }
  const topo = [], layout = fixarLayouts(frames);
  let y = EST.pad;
  alt.forEach((h) => { topo.push(y); y += h + 2 * EST.pad; });
  return {topo, layout, W: Math.max(EST.W, ...larg.map((w) => w + 2 * EST.pad)), H: Math.max(y - EST.pad, 2 * EST.pad), maxPilha};
}
/* Layout da árvore fixo para a gravação inteira, tirado da união dos nós de
   todos os passos: inserir um nó não empurra os outros (rodada 3: com o
   layout por passo a árvore inteira escorregava a cada inserção). */
function fixarLayouts(frames) {
  const unioes = [];
  for (const f of frames) f.est.forEach((e, j) => {
    if (e.tipo !== 'arvore') return;
    const u = unioes[j] = unioes[j] || new Map();
    e.nos.forEach((n) => u.set(n.id, n));
  });
  return unioes.map((u) => u && layoutArvore({nos: [...u.values()]}));
}
const niveisDe = (rec) => Math.max(0, ...rec.frames.flatMap((f) => f.est.filter((e) => e.tipo === 'arvore').map((e) => MEDIR.arvore(e).niveis)));

/* ---------- desenho: cada passo vira uma lista de itens com chave ----------
   Cores e tamanhos vêm das classes est-* (tokens); só a cor do ponteiro é
   inline, e ainda assim como var(--plot-n). */
const em = (x, y) => ({transform: `translate(${x}px,${y}px)`});
function itensVetor(e, top, W, out) {
  const {cel, celH, gap, nomeW, ptrRow} = EST, passo = cel + gap;
  const x0 = (W - (nomeW + e.valores.length * passo - gap)) / 2 + nomeW;
  out.push({k: `${e.nome}:nome`, camada: 2, tag: 'text', cls: 'est-nome', a: {x: x0 - 10, y: top + celH / 2 + 4.5, 'text-anchor': 'end'}, t: e.nome});
  e.valores.forEach((v, i) => {
    const m = e.marcas[i] || '', fora = e.faixa && (i < e.faixa[0] || i > e.faixa[1]) && m !== 'achado';
    const s = {...em(x0 + i * passo, top), opacity: fora ? .35 : 1};
    out.push({k: `${e.nome}:c${i}`, camada: 1, tag: 'rect', cls: `est-cel ${m}`, a: {width: cel, height: celH, rx: 4}, s});
    out.push({k: `${e.nome}:v${i}`, camada: 2, tag: 'text', cls: `est-val ${m}`, a: {x: cel / 2, y: celH / 2 + 4.5, 'text-anchor': 'middle'}, s, t: String(v)});
    out.push({k: `${e.nome}:i${i}`, camada: 2, tag: 'text', cls: 'est-idx', a: {x: x0 + i * passo + cel / 2, y: top + celH + 14, 'text-anchor': 'middle'}, t: String(i)});
  });
  const fila = {};
  for (const [nome, i] of Object.entries(e.ponteiros)) {
    if (!Number.isInteger(i) || i < 0 || i >= e.valores.length) continue;   // hi = −1 não aponta para célula nenhuma
    const row = fila[i] = (fila[i] ?? -1) + 1;
    const s = {...em(x0 + i * passo + cel / 2, top + celH + 22 + row * ptrRow), fill: COR_PONTEIRO[e.cores[nome]]};
    out.push({k: `${e.nome}:pa:${nome}`, camada: 2, tag: 'path', cls: 'est-ptr', a: {d: 'M0 0l-4.5 6h9z'}, s});
    out.push({k: `${e.nome}:pt:${nome}`, camada: 2, tag: 'text', cls: 'est-ptr-t', a: {y: 17, 'text-anchor': 'middle'}, s, t: nome});
  }
}
/* O nó novo nasce na posição do pai e desce até o lugar dele, com a aresta
   crescendo junto (`de` é o estilo inicial, só na criação). O anel do nó
   atual é um item só, então ele percorre a descida em vez de piscar. */
function itensArvore(e, top, W, out, L = layoutArvore(e)) {
  const {dx, dy, r} = EST, porId = new Map(e.nos.map((n) => [n.id, n]));
  const x0 = (W - L.n * dx) / 2 + dx / 2;
  const xy = (id) => [x0 + L.pos[id].i * dx, top + r + L.pos[id].d * dy];
  const aceso = (n) => n && ['caminho', 'atual'].includes(n.estado);
  for (const no of e.nos) {
    const [x, y] = xy(no.id), pai = no.pai && porId.get(no.pai);
    const [px, py] = pai ? xy(pai.id) : [x, y], de = pai ? em(px, py) : null;
    if (pai) out.push({k: `${e.nome}:e:${no.id}`, camada: 0, tag: 'path', cls: `est-aresta${aceso(pai) && (aceso(no) || no.estado === 'novo') ? ' caminho' : ''}`, s: {d: `path("M${px} ${py}L${x} ${y}")`}, de: {d: `path("M${px} ${py}L${px} ${py}")`}});
    out.push({k: `${e.nome}:n:${no.id}`, camada: 1, tag: 'circle', cls: `est-no ${no.estado}`, a: {r}, s: em(x, y), de});
    out.push({k: `${e.nome}:t:${no.id}`, camada: 2, tag: 'text', cls: `est-no-t ${no.estado}`, a: {y: 4.5, 'text-anchor': 'middle'}, s: em(x, y), de, t: String(no.v)});
  }
  const atual = e.nos.find((n) => n.estado === 'atual');
  if (atual) out.push({k: `${e.nome}:cursor`, camada: 2, tag: 'circle', cls: 'est-cursor', a: {r: r + 5}, s: em(...xy(atual.id))});
}
const ITENS = {vetor: itensVetor, arvore: itensArvore};
function itensDoPasso(f, rec) {
  const out = [];
  f.est.forEach((e, j) => ITENS[e.tipo](e, rec.topo[j], rec.W, out, rec.layout[j] || undefined));
  return out;
}

/* Reconciliação por chave: o elemento que já existe só muda de atributo, então
   a transição CSS anda (ponteiro desliza, nó acende); camadas fixas evitam
   reordenar nós no DOM. */
function syncStage(svg, itens) {
  const camadas = svg.querySelectorAll('[data-camada]'), anima = svg.classList.contains('anima');
  const vivos = new Map([...svg.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el]));
  for (const it of itens) {
    let el = vivos.get(it.k);
    if (el) vivos.delete(it.k);
    else {
      el = document.createElementNS('http://www.w3.org/2000/svg', it.tag); el.dataset.k = it.k; camadas[it.camada].appendChild(el);
      if (it.de && anima) { for (const [n, v] of Object.entries(it.de)) el.style.setProperty(n, v); el.getBoundingClientRect(); }
    }
    el.setAttribute('class', it.cls);
    for (const [n, v] of Object.entries(it.a || {})) el.setAttribute(n, v);
    for (const [n, v] of Object.entries(it.s || {})) el.style.setProperty(n, v);
    if (it.t != null && el.textContent !== it.t) el.textContent = it.t;
  }
  vivos.forEach((el) => el.remove());
}
/* Mesmo desenho como texto, para os quadros-chave da ver_peca. */
function svgDe(itens, W, H) {
  const camadas = [[], [], []];
  for (const it of itens) {
    const a = Object.entries(it.a || {}).map(([n, v]) => ` ${n}="${attrEsc(v)}"`).join('');
    const s = Object.entries(it.s || {}).map(([n, v]) => `${n}:${v}`).join(';');
    camadas[it.camada].push(`<${it.tag} class="${it.cls}"${a}${s ? ` style="${attrEsc(s)}"` : ''}>${it.t != null ? esc(it.t) : ''}</${it.tag}>`);
  }
  return `<svg class="est-stage" viewBox="0 0 ${W} ${H}" aria-hidden="true">${camadas.flat().join('')}</svg>`;
}

/* ---------- a peça ---------- */
const ICONE = (id, cls = '') => `<svg class="icon ${cls}"><use href="#i-${id}"/></svg>`;
function marcacaoRoteiro(def) {
  const ents = Object.entries(def.entradas || {}).map(([n, e]) => `<label class="ent"><span>${esc(e.rotulo || n)}</span><input class="field-control" data-ent="${attrEsc(n)}" value="${attrEsc(e.valor)}" size="${Math.max(3, String(e.valor).length)}" spellcheck="false"></label>`).join('');
  return `<div class="piece-head"><span class="piece-title">${esc(def.titulo)}</span><span class="piece-kind">roteiro · ${esc(def.linguagem)}</span><span class="grow"></span>
    <button type="button" class="icon-btn" data-r="restart" aria-label="Recomeçar">${ICONE('restart')}</button>
    <button type="button" class="icon-btn" aria-label="Mais opções do roteiro">${ICONE('menu')}</button></div>
  <div class="transport">
    <button type="button" class="play-btn" data-r="play"><svg class="icon icon-fill" data-when="paused"><use href="#i-play"/></svg><svg class="icon" data-when="playing" hidden><use href="#i-pause"/></svg><span>Rodar</span></button>
    <button type="button" class="icon-btn" data-r="prev" aria-label="Passo anterior">${ICONE('prev')}</button>
    <button type="button" class="icon-btn" data-r="next" aria-label="Próximo passo">${ICONE('next')}</button>
    <div class="scrub" data-r="scrub" role="slider" aria-label="Passo do roteiro" tabindex="0"></div>
    <span class="t-read" data-r="read"></span>
    <button type="button" class="ask-btn" data-r="ask">${ICONE('ask')}Perguntar aqui</button>
  </div>
  <div class="script-grid">
    <pre class="code" data-r="code"></pre>
    <div class="est-col">
      <svg class="est-stage" data-r="stage" role="img" aria-label="${attrEsc(def.titulo)}: estado do passo"><g data-camada="0"></g><g data-camada="1"></g><g data-camada="2"></g></svg>
      <div class="est-row" data-r="row"></div>
      <p class="script-note" data-r="nota" aria-live="polite"></p>
      <div class="ents">${ents}<button type="button" class="btn btn-ghost" data-r="fork">E se…</button></div>
    </div>
  </div>`;
}
function pilhaHtml(pl, max) {
  if (!pl) return '';
  const itens = [...pl.itens].reverse().map((t, j) => `<div class="pilha-item${j ? '' : ' topo'}">${esc(t)}</div>`);
  return `<div class="pilha" style="min-height:${20 + max * 30}px"><span class="est-rot">${esc(pl.nome)}</span>${itens.join('') || '<span class="pilha-vazia">vazia</span>'}</div>`;
}
function varsHtml(vars, ant) {
  return `<div class="vars">${Object.entries(vars).map(([n, v]) => `<div class="var${ant && n in ant && ant[n] !== v ? ' changed' : ''}"><span>${esc(n)}</span><b>${v == null ? '—' : esc(v)}</b></div>`).join('')}</div>`;
}
function pintarRoteiro(p) {
  const {frames, W, H} = p.rec, f = frames[p.i], ant = frames[p.i - 1];
  p.r('code').innerHTML = p.def.codigo.map((l, k) => `<div class="code-line${k + 1 === f.linha ? ' cur' : ''}"><span class="ln">${k + 1}</span><span>${esc(l)}</span></div>`).join('');
  const st = p.r('stage');
  st.setAttribute('viewBox', `0 0 ${W} ${H}`); st.style.maxWidth = `${W}px`; st.hidden = !f.est.length;
  syncStage(st, itensDoPasso(f, p.rec));
  p.r('row').innerHTML = pilhaHtml(f.pilha, p.rec.maxPilha) + varsHtml(f.vars, ant && ant.vars);
  p.r('row').classList.toggle('sem-pilha', !f.pilha);
  p.r('nota').textContent = f.nota;
  p.r('read').textContent = `passo ${p.i + 1} / ${frames.length}`;
  paintScrubAt(p.r('scrub'), p.i, Math.max(1, frames.length - 1), `passo ${p.i + 1} de ${frames.length}`);
  setPlay(p.r('play'), p.playing, p.playing ? 'Pausar' : 'Rodar');
  p.r('ask').hidden = p.playing;
}
const valoresIniciais = (def) => Object.fromEntries(Object.entries(def.entradas || {}).map(([n, e]) => [n, String(e.valor)]));
function regravar(p, entradas) {
  p.rec = gravar(p.def, entradas); p.entradas = entradas;
  buildScrub(p.r('scrub'), p.rec.marcos, Math.max(1, p.rec.frames.length - 1));
}
function ligarRoteiro(p) {
  const ultimo = () => p.rec.frames.length - 1;
  p.ir = (i) => { p.i = Math.max(0, Math.min(ultimo(), i)); pintarRoteiro(p); };
  p.parar = () => { p.playing = false; clearInterval(p.timer); pintarRoteiro(p); };
  p.r('next').onclick = () => { p.parar(); p.ir(p.i + 1); };
  p.r('prev').onclick = () => { p.parar(); p.ir(p.i - 1); };
  p.r('restart').onclick = () => { p.parar(); p.ir(0); };
  p.r('play').onclick = () => {
    if (p.playing) { p.parar(); return; }
    if (p.i >= ultimo()) p.i = 0;
    p.playing = true; pintarRoteiro(p);
    p.timer = setInterval(() => (p.i >= ultimo() ? p.parar() : p.ir(p.i + 1)), ROTEIRO_RITMO.passo);
  };
  const scrub = p.r('scrub');
  bindScrub(scrub, {total: ultimo, seek: (t) => p.ir(Math.round(t)), pause: () => { if (p.playing) p.parar(); }});
  scrub.addEventListener('keydown', (e) => {
    const d = {ArrowLeft: -1, ArrowRight: 1}[e.key];
    if (d) { e.preventDefault(); p.parar(); p.ir(p.i + d); }
  });
  p.el.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-ent]');
    if (!inp) return;
    try { regravar(p, {...p.entradas, [inp.dataset.ent]: inp.value}); }
    catch (err) { p.r('nota').textContent = `Não deu para rodar com essa entrada: ${err.message}`; return; }
    p.parar(); p.ir(0);
  });
  p.r('fork').onclick = () => { p.parar(); addChip(chipRoteiro(p, true)); $('#msg').value = p.opts.ese?.pergunta || 'E se '; $('#msg').focus(); };
  p.r('ask').onclick = () => { p.parar(); addChip(chipRoteiro(p, false)); $('#msg').focus(); };
}

/* ---------- Perguntar aqui: o instante exato do roteiro ---------- */
const varsTexto = (vars) => Object.entries(vars).map(([n, v]) => `${n} = ${v == null ? '—' : v}`).join(' · ');
const entradasTexto = (ent) => Object.entries(ent).map(([n, v]) => `${n} = ${v}`).join(' · ');
const listaPt = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} e ${a.at(-1)}` : String(a[0] ?? ''));
const RESUMO = {
  vetor(e) {
    const marcas = Object.entries(e.marcas).map(([i, m]) => ` · ${m} em ${i}`).join('');
    return `${e.nome} = [${e.valores.join(', ')}]${e.faixa ? ` · faixa ${e.faixa[0]} a ${e.faixa[1]}` : ''}${marcas}`;
  },
  arvore(e) {
    const {filho} = layoutArvore(e);
    const txt = (n) => {
      if (!n) return '·';
      const a = filho(n.id, 'esq'), b = filho(n.id, 'dir');
      return a || b ? `${n.v}(${txt(a)}, ${txt(b)})` : String(n.v);
    };
    const atual = e.nos.find((n) => n.estado === 'atual');
    return e.nos.length ? `${txt(e.nos.find((n) => !n.pai))}${atual ? ` · atual ${atual.v}` : ''}` : 'vazia';
  },
};
function chipRoteiro(p, fork) {
  const {frames} = p.rec, f = frames[p.i], n = frames.length;
  const pilha = f.pilha && (f.pilha.itens.length ? `${[...f.pilha.itens].reverse().join(' · ')} (topo primeiro)` : 'vazia');
  return {
    kind: p.key, icon: 'code', img: null, at: p.i, step: p.i, fork,
    label: `${fork ? 'Ramo' : 'Roteiro'} · linha ${f.linha} · passo ${p.i + 1} de ${n}`,
    rows: [
      ['Linha', `<span class="mono">${f.linha}: ${esc((p.def.codigo[f.linha - 1] || '').trim())}</span>`],
      ['Variáveis', `<span class="mono">${esc(varsTexto(f.vars))}</span>`],
      ...(pilha ? [['Pilha', `<span class="mono">${esc(pilha)}</span>`]] : []),
      ...f.est.map((e) => [e.tipo === 'vetor' ? 'Vetor' : 'Árvore', `<span class="mono">${esc(RESUMO[e.tipo](e))}</span>`]),
      ['Entrada', `<span class="mono">${esc(entradasTexto(p.entradas))}</span>`],
      ['Passo', `${p.i + 1} de ${n}: ${esc(f.nota)}`],
      ...(fork ? [['Ramo', 'outra execução com a entrada nova; a sua não muda']] : []),
    ],
  };
}
/* O "E se…" reexecuta o roteiro com outra entrada (é determinístico), em vez
   de mexer no estado no meio da execução. A do aluno fica como estava. */
function respostaRoteiro(p, c, text) {
  if (c.fork || /^E se/i.test(text)) {
    const ese = p.opts.ese || {entradas: {}}, ramo = gravar(p.def, {...p.entradas, ...ese.entradas});
    const fim = ese.nota ? ese.nota(ramo) : esc(ramo.frames.at(-1).nota);
    return `<p>Rodei uma cópia com ${esc(entradasTexto(ese.entradas))}. Ela tem ${ramo.frames.length} passos. ${fim} O seu roteiro continua onde estava.</p>`;
  }
  const f = p.rec.frames[c.step];
  return `<p>Na linha ${f.linha}, com ${esc(varsTexto(f.vars))}: ${esc(f.nota)}</p>${p.opts.explica ? p.opts.explica(p, c.step) : ''}`;
}

/* ---------- ver_peca: o modelo confere a peça antes de entregar ---------- */
function verPeca(def, entradas) {
  const a = gravar(def, entradas), b = gravar(def, entradas), fr = a.frames, avisos = [];
  const passos = (fn) => fr.flatMap((f, i) => (fn(f, i) ? [i] : []));
  const aviso = (texto, lista) => { if (lista.length) avisos.push({texto, passos: lista}); };
  const maior = (fn) => Math.max(0, ...fr.flatMap(fn));
  if (JSON.stringify(fr) !== JSON.stringify(b.frames)) avisos.push({texto: 'duas gravações com a mesma entrada deram passos diferentes; tire Math.random, Date e afins do roteiro', passos: []});
  aviso('passo sem nota', passos((f) => !f.nota.trim()));
  aviso(`nota com ${maior((f) => f.nota.length)} caracteres; o limite é ${LIMITE.nota}`, passos((f) => f.nota.length > LIMITE.nota));
  aviso(`linha fora do código; o código vai de 1 a ${def.codigo.length}`, passos((f) => !(f.linha >= 1 && f.linha <= def.codigo.length)));
  aviso('passo igual ao anterior; o aluno aperta “próximo” e nada muda', passos((f, i) => i > 0 && JSON.stringify(f) === JSON.stringify(fr[i - 1])));
  const vetores = (f) => f.est.filter((e) => e.tipo === 'vetor'), arvores = (f) => f.est.filter((e) => e.tipo === 'arvore');
  aviso(`vetor com ${maior((f) => vetores(f).map((e) => e.valores.length))} células; o quadro lê bem até ${LIMITE.celulas}`, passos((f) => vetores(f).some((e) => e.valores.length > LIMITE.celulas)));
  aviso(`árvore com ${maior((f) => arvores(f).map((e) => MEDIR.arvore(e).niveis))} níveis; o quadro lê bem até ${LIMITE.niveis}`, passos((f) => arvores(f).some((e) => MEDIR.arvore(e).niveis > LIMITE.niveis)));
  aviso(`árvore com ${maior((f) => arvores(f).map((e) => MEDIR.arvore(e).largura))} nós lado a lado; o quadro lê bem até ${LIMITE.largura}`, passos((f) => arvores(f).some((e) => MEDIR.arvore(e).largura > LIMITE.largura)));
  aviso(`pilha com ${maior((f) => (f.pilha ? [f.pilha.itens.length] : []))} chamadas; o quadro lê bem até ${LIMITE.pilha}`, passos((f) => f.pilha && f.pilha.itens.length > LIMITE.pilha));
  aviso(`chamada com mais de ${LIMITE.item} caracteres na pilha`, passos((f) => f.pilha && f.pilha.itens.some((t) => t.length > LIMITE.item)));
  if (fr.length > LIMITE.passos) avisos.push({texto: `${fr.length} passos; acima de ${LIMITE.passos} o aluno não chega ao fim`, passos: []});
  return {passos: fr.length, avisos, imagens: quadrosChave(a), rec: a};
}
/* O fim de cada marco; sem marcos, quatro instantes espalhados. */
function quadrosChave(rec) {
  const n = rec.frames.length;
  const fins = [...new Set(rec.marcos.map((m, j) => (rec.marcos[j + 1]?.t ?? n) - 1).filter((i) => i >= 0))];
  const espalha = (lista, k) => [...new Set(Array.from({length: k}, (_, j) => lista[Math.round(j * (lista.length - 1) / (k - 1))]))];
  if (fins.length < 3) return espalha([...Array(n).keys()], Math.min(4, n));
  return fins.length <= 6 ? fins : espalha(fins, 6);
}
function faixaPassos(lista) {
  const a = lista.map((i) => i + 1);
  return a.length > 3 ? `${a[0]} a ${a.at(-1)} (${a.length})` : a.join(', ');
}
function verPecaHtml(def, entradas, aberto) {
  const v = verPeca(def, entradas), n = v.avisos.length;
  const marcoDe = (i) => [...v.rec.marcos].reverse().find((m) => m.t <= i)?.label;
  const quadros = v.imagens.map((i) => `<figure>${svgDe(itensDoPasso(v.rec.frames[i], v.rec), v.rec.W, v.rec.H)}<figcaption>passo ${i + 1}${v.rec.marcos.length > 1 ? ` · ${esc(marcoDe(i))}` : ''}</figcaption></figure>`).join('');
  const lista = n ? `<ul class="avisos">${v.avisos.map((a) => `<li>${esc(a.texto)}${a.passos.length ? `<span> · passo ${faixaPassos(a.passos)}</span>` : ''}</li>`).join('')}</ul>` : '';
  return `<details class="tools"${aberto ? ' open' : ''}><summary>${n ? ICONE('alert', 'tool-warn') : ICONE('check', 'tool-ok')}ver_peca<span class="tools-what">${esc(def.arquivo)} · ${v.passos} passos · ${n ? `${n} aviso${n > 1 ? 's' : ''}` : 'sem avisos'}</span></summary><div class="ver-body">${lista}<div class="ver-sheet">${quadros}</div></div></details>`;
}

/* ---------- montar: uma peça por roteiro ---------- */
function montarRoteiro(key, def, opts) {
  const el = document.getElementById(opts.id);
  Object.assign(el.dataset, {kind: key, icon: 'code', title: opts.aba || def.titulo});
  el.setAttribute('aria-label', `Roteiro: ${def.titulo}`);
  el.innerHTML = marcacaoRoteiro(def);
  const p = {key, def, opts, el, i: 0, playing: false, timer: 0, r: (nome) => el.querySelector(`[data-r="${nome}"]`)};
  if (!PROTO.embed) p.r('stage').classList.add('anima');   // na captura estática a transição só atrapalha
  regravar(p, valoresIniciais(def));
  ligarRoteiro(p);
  PIECES[key] = {
    id: el.id,
    chip: () => chipRoteiro(p, false),
    reply: (c, text) => respostaRoteiro(p, c, text),
    goto: (i) => { p.parar(); p.ir(i); },
    pause: () => { if (p.playing) p.parar(); },
    redraw: () => pintarRoteiro(p),
    reset() {
      p.parar(); regravar(p, valoresIniciais(def));
      el.querySelectorAll('[data-ent]').forEach((inp) => { inp.value = p.entradas[inp.dataset.ent]; });
      p.ir(0);
    },
    stepOfLine: (n) => p.rec.frames.findIndex((f) => f.linha === n),
    frameWhere: (fn) => p.rec.frames.findIndex(fn),
    passos: () => p.rec.frames.length,
  };
}

/* ---------- as duas peças do protótipo (respostas prontas do tutor) ---------- */
montarRoteiro('roteiro', BUSCA_BINARIA, {
  id: 'p-rot',
  ese: {pergunta: 'E se o alvo fosse 40?', entradas: {alvo: '40'}, nota: (r) => `${esc(r.frames.at(-1).nota)} O 40 cairia entre 38 e 56, e o intervalo fecha com lo = 7 e hi = 6.`},
  explica(p, i) {
    const j = Math.min(p.rec.frames.length - 1, i + 1);
    return `<p>O truque para não se perder: [lo, hi] é sempre o trecho onde o alvo <em>ainda pode</em> estar. Por isso é <span class="mono">mid + 1</span> e <span class="mono">mid − 1</span>: o próprio mid já foi testado. Veja o ${tlink('roteiro', j, `passo ${j + 1}`)}.</p>`;
  },
});
montarRoteiro('arvore', ARVORE_BUSCA, {
  id: 'p-arv', aba: 'Árvore de busca',
  ese: {pergunta: 'E se os valores viessem em ordem: 10 20 30 40 50 60 70?', entradas: {valores: '10 20 30 40 50 60 70'},
    nota: (r) => `A árvore vira uma fila de ${niveisDe(r)} níveis: cada valor novo desce por todos os anteriores, e inserir em ordem custa da ordem de n² comparações.`},
  explica(p, i) {
    const f = p.rec.frames[i], n = f.pilha.itens.length;
    const j = p.rec.frames.findIndex((g, k) => k > i && g.pilha.itens.length < n);
    const nos = f.pilha.itens.map((t) => t.match(/^inserir\(([^,]+),/)[1]).filter((v) => v !== 'null');
    return `<p>Cada chamada de <span class="mono">inserir</span> fica esperando a de baixo terminar, porque ainda precisa fazer a atribuição <span class="mono">no.esq = …</span> ou <span class="mono">no.dir = …</span>. Para achar o lugar do ${f.vars.v}, a descida passou por ${listaPt(nos)}: uma chamada para cada nó, mais a de <span class="mono">null</span>, que cria o nó novo.</p><p>Nenhuma volta antes de chegar ao fundo. No ${tlink('arvore', j, `passo ${j + 1}`)} elas começam a sair pelo topo, uma por vez.</p>`;
  },
});
