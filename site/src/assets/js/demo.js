// A demo da Mesa: matérias com conversa e folha próprias, o Conferir com a
// resposta roteirizada, abas, Caderno e modo mini. Nada aqui chama modelo: as
// respostas vêm de content-*.js, e a folha muda qual delas aparece.
import {$, $$, reduced, wait, escapeHtml, isMac} from './dom.js';
import {drawGgb} from './tools.js';

/**
 * Liga a demo. Devolve as ações que a paleta e os recursos da página disparam.
 * @param {typeof import('./content-pt.js').default} content
 * @param {ReturnType<typeof import('./ink.js').createInk>} ink
 * @param {{current: () => string}} picker
 * @example
 * const demo = createDemo(content, ink, picker); demo.setTab('ggb');
 */
export function createDemo(content, ink, picker) {
  const {docs: DOCS, courses: COURSES, text: T, sheet: S, cards: CARDS} = content;
  const app = $('#app'), stage = $('#stage'), thread = $('#thread');
  const state = {};
  let course = 'calc1', busy = false;
  const saved = [];

  function openDoc(slot, key) {
    const d = DOCS[key], paper = $(`#r${slot}-paper`);
    $(`#r${slot}-doc`).textContent = d.name;
    paper.closest('.reader').querySelector('.n').textContent = d.n;
    paper.classList.toggle('blank', !!d.blank);
    paper.innerHTML = d.blank || d.html;
  }
  function add(html, cls = '') {
    const el = document.createElement('div');
    el.className = cls + ' enter';
    el.innerHTML = html;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }
  const now = () => new Date().toTimeString().slice(0, 5);
  function setBusy(on) {
    busy = on;
    for (const b of $$('.course-tabs button')) b.disabled = on;
    $('#d-check').disabled = on;
  }
  const coach = (on) => $('#d-check').classList.toggle('coach', on);
  const showHeader = (st) => { $('#t-title').textContent = st.title; $('#t-sub').textContent = st.sub; };

  function freshCourse(c) {
    state[c] = {step: 0, thread: `<p class="empty">${COURSES[c].empty}</p>`, ink: '', title: T.newChat, sub: COURSES[c].sub, coach: false, fresh: true};
  }
  function saveCourse() {
    const st = state[course];
    if (!st) return;
    st.thread = thread.innerHTML.replace(/ enter/g, '');
    st.ink = ink.stillInk();
    st.coach = $('#d-check').classList.contains('coach');
  }
  // Abre a conversa e a folha da matéria; na primeira vez, a tentativa se escreve sozinha.
  function loadCourse(c) {
    if (!state[c]) freshCourse(c);
    course = c;
    const st = state[c], C = COURSES[c];
    openDoc(1, C.docs[0]);
    openDoc(2, C.docs[1]);
    $('#xpp-title').textContent = C.xopp;
    thread.innerHTML = st.thread;
    $('#ink').innerHTML = st.ink;
    ink.resetUndo();
    showHeader(st);
    coach(st.coach);
    thread.scrollTop = thread.scrollHeight;
    if (!st.fresh) return;
    st.fresh = false;
    ink.write('1)', 14, 8, {scale: .7});
    if (!C.first) { coach(true); st.coach = true; return; }
    const t = ink.write(C.first, 30, 40, {start: 400, attempt: true});
    setTimeout(() => { if (course === c) { coach(true); st.coach = true; } }, reduced ? 0 : t + 600);
  }

  // O que a folha mostra muda a resposta: tentativa apagada, ou rabisco no Livre.
  function sheetReply(c) {
    const last = [...$('#ink').querySelectorAll('g[data-n]')].pop();
    const erased = isMac ? S.erased.replace('<kbd>Ctrl</kbd>', '<kbd>⌘</kbd>') : S.erased;
    if (last && last.childElementCount < last.dataset.n * .6) {
      return {title: state[c].title, sub: state[c].sub, user: S.user, reads: S.reads, repeat: true, blocks: [erased]};
    }
    if (c === 'livre' && $('#ink').querySelector('.user')) {
      return {title: S.scribbleTitle, sub: S.scribbleSub, user: S.user, reads: S.reads, repeat: true, blocks: [S.scribble]};
    }
    return null;
  }
  function restartFx(id) { const el = $(id); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }

  async function conferir() {
    if (busy) return;
    if (app.dataset.view === 'caderno' || app.dataset.view === 'ggb') setTab(course);
    const c = course, C = COURSES[c], st = state[c];
    if (st.step >= C.replies.length) {
      if (!st.ended) { st.ended = true; add(`<p class="msg-foot">${T.demoEnd}</p>`); }
      return;
    }
    setBusy(true);
    coach(false);
    restartFx('#flash');
    restartFx('#capture-ring');
    const r = sheetReply(c) || C.replies[st.step];
    st.title = r.title; st.sub = r.sub;
    showHeader(st);
    thread.querySelector('.empty')?.remove();
    await wait(260);
    add(`<div class="thumb"><svg viewBox="0 0 300 380" preserveAspectRatio="xMinYMin meet">${ink.stillInk()}</svg></div><span class="thumb-cap">${C.xopp}, ${T.page}</span><span>${r.user}</span>`, 'msg-user');
    const work = add(`<div class="work-head"><span class="work-shine"><svg viewBox="155 150 940 940"><use href="#int"/></svg><span>${r.reads}</span></span></div>`, 'work');
    await wait(1500);
    work.innerHTML = `<div class="work-head"><svg class="icon"><use href="#i-check"/></svg>${T.worked}</div>`;
    const reply = add('', 'reply');
    for (const block of r.blocks) {
      reply.insertAdjacentHTML('beforeend', block);
      reply.lastElementChild.classList.add('enter');
      thread.scrollTop = thread.scrollHeight;
      await wait(380);
    }
    add(`<span>${now()} · ${picker.current()}</span><span class="sp"></span><button class="btn icon-btn save-btn" aria-label="${T.save}" aria-pressed="false" data-save="${c}:${st.step}"><svg class="icon"><use href="#i-bookmark"/></svg></button><button class="btn icon-btn retry-btn" aria-label="${T.retry}"><svg class="icon"><use href="#i-retry"/></svg></button>`, 'msg-foot');
    if (!r.repeat) st.step++;
    setBusy(false);
    // O aluno corrige na folha e confere de novo; trocar de aba no meio não perde a escrita.
    if (st.step === 1 && C.fix && !r.repeat) {
      const t = ink.write(C.fix, 30, 108, {start: 900, attempt: true});
      setTimeout(() => { st.coach = true; if (course === c) coach(true); }, reduced ? 0 : t + 1100);
      return;
    }
    coach(st.step < C.replies.length);
  }
  function freeAsk(text) {
    if (!text.trim() || busy) return;
    thread.querySelector('.empty')?.remove();
    add(`<span>${escapeHtml(text)}</span>`, 'msg-user');
    setTimeout(() => add(T.freeAsk, 'reply'), 500);
  }
  function resetChat() { if (busy) return; freshCourse(course); loadCourse(course); }

  function highlight(id, doc) {
    if (stage.dataset.mini === 'true') setMini(false);
    // Sem a coluna do formulário (janela estreita), o primeiro leitor troca de documento.
    if (doc && getComputedStyle($('.reader.second')).display === 'none') openDoc(1, doc);
    const el = $('#' + id);
    if (!el) return;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 2200);
  }
  function bumpCaderno() {
    const b = $('#cad-count');
    b.textContent = String(saved.length);
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }
  function renderCaderno() {
    const box = $('#caderno');
    if (!saved.length) { box.innerHTML = `<h3>${T.cadernoTitle}</h3><p class="empty">${T.cadernoEmpty}</p>`; return; }
    box.innerHTML = `<h3>${T.review}</h3>` + saved.map((k) => `<div class="card"><div class="q">${CARDS[k][0]}</div><div class="meta"><span class="pill">${T.today}</span>${CARDS[k][1]}</div></div>`).join('');
  }
  // Tentar de novo: a resposta troca de uma vez, sem a entrada bloco a bloco nem trava.
  function retry(button) {
    const reply = button.closest('.msg-foot')?.previousElementSibling;
    if (!reply?.classList.contains('reply')) return;
    reply.replaceChildren(...[...reply.children].map((b) => { const copy = b.cloneNode(true); copy.classList.remove('enter'); return copy; }));
  }
  thread.addEventListener('click', (e) => {
    const ref = e.target.closest('.pdf-ref');
    if (ref?.dataset.ref) return highlight(ref.dataset.ref, ref.dataset.doc);
    if (ref?.dataset.go) return setTab(ref.dataset.go);
    const save = e.target.closest('.save-btn');
    if (save && save.getAttribute('aria-pressed') !== 'true') { save.setAttribute('aria-pressed', 'true'); saved.push(save.dataset.save); bumpCaderno(); }
    const again = e.target.closest('.retry-btn');
    if (again && !busy) retry(again);
  });

  function setTab(tab) {
    if (busy) return;
    for (const b of $$('.course-tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    app.dataset.view = tab;
    if (tab === 'caderno' || tab === 'ggb') {
      if (stage.dataset.mini === 'true') setMini(false);
      if (tab === 'caderno') renderCaderno();
      if (tab === 'ggb') drawGgb(content.decimal);
      return;
    }
    if (tab !== course) { saveCourse(); loadCourse(tab); }
  }
  // O modo mini é do tutor: a partir do Caderno ou do GeoGebra, volta para a conversa da matéria.
  function setMini(on) {
    if (on && (app.dataset.view === 'caderno' || app.dataset.view === 'ggb')) {
      for (const b of $$('.course-tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === course));
      app.dataset.view = course;
    }
    stage.dataset.mini = String(on);
    $('#mini-btn').setAttribute('aria-pressed', String(on));
    $('#mini-btn').setAttribute('aria-label', on ? T.miniOff : T.miniOn);
  }

  $('.course-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) setTab(b.dataset.tab); });
  $('#mini-btn').addEventListener('click', () => setMini(stage.dataset.mini !== 'true'));
  $('#new-btn').addEventListener('click', resetChat);
  $('#d-check').addEventListener('click', conferir);
  $('#send').addEventListener('click', () => { freeAsk($('#ask').value); $('#ask').value = ''; });
  $('#ask').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    freeAsk(e.target.value);
    e.target.value = '';
  });
  renderCaderno();
  // A tentativa só começa a se escrever quando a demo aparece; fora da tela, as animações param.
  let started = false;
  new IntersectionObserver(([entry]) => {
    stage.dataset.offscreen = String(!entry.isIntersecting);
    if (entry.isIntersecting && !started) { started = true; loadCourse('calc1'); }
  }, {threshold: .25}).observe(stage);

  return {
    conferir, setTab, setMini, resetChat, highlight,
    course: () => course, busy: () => busy, view: () => app.dataset.view,
    firstMark: () => (COURSES[course].docs[0] === 'lista' ? 'q1' : 'c1'),
  };
}
