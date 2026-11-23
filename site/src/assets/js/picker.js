// O seletor de modelos: o popover do app (desk/src/model-picker-ui.mjs e
// model-picker-rows.mjs), com os grátis do OpenCode Zen. Uma lista só, em grupos
// (Recentes, Favoritos, o provedor); o trilho pula entre eles. Nomes e políticas
// vêm de desk/free-models.json; a demo não chama modelo nenhum.
import {$, $$, fold, escapeHtml} from './dom.js';

const MODELS = [
  {id: 'deepseek-v4.1-flash-free', name: 'DeepSeek V4.1 Flash Free', policy: 'zero'},
  {id: 'glm-5.3-flash-free', name: 'GLM 5.3 Flash Free', policy: 'zero'},
  {id: 'big-pickle', name: 'Big Pickle', policy: 'improve'},
  {id: 'mimo-v2.6-flash-free', name: 'MiMo V2.6 Flash Free', policy: 'improve'},
  {id: 'nemotron-3.5-lightning-free', name: 'Nemotron 3.5 Lightning Free', policy: 'trial'},
  {id: 'nemotron-3.5-super-vl-free', name: 'Nemotron 3.5 Super VL Free', policy: 'trial'},
];
const modelById = (id) => MODELS.find((x) => x.id === id);

/**
 * Liga o botão `#model-btn` e o popover `#model-pop`.
 * @param {typeof import('./content-pt.js').default.picker} t os textos do idioma
 * @returns {{current: () => string}} o id do modelo escolhido, para o rodapé da resposta
 * @example
 * const picker = createPicker(content.picker); picker.current() // → 'deepseek-v4.1-flash-free'
 */
export function createPicker(t) {
  let modelId = MODELS[0].id, defaultModel = MODELS[0].id, effort = 'default';
  let favorites = new Set(), recents = [MODELS[0].id];
  const list = $('#model-list');

  // Nos grupos mistos a linha diz o provedor; no grupo do provedor, só a política.
  function modelRow(md, mixed) {
    const fav = favorites.has(md.id), def = md.id === defaultModel;
    const note = t.policy[md.policy];
    const meta = mixed
      ? `<span class="provider-mono sm" aria-hidden="true">Z</span><span>OpenCode Zen</span><span class="model-row-note">· ${note}</span>`
      : `<span class="model-row-note">${note}</span>`;
    return `<div class="model-row" role="option" data-id="${md.id}" aria-selected="${md.id === modelId}" title="${md.name}">
  <span class="model-row-text"><span class="model-row-top"><span class="model-row-name">${md.name}</span>${def ? `<span class="model-row-default-badge">${t.defaultBadge}</span>` : ''}</span><span class="model-row-meta">${meta}</span></span>
  <span class="model-row-check"><svg class="icon"><use href="#i-check"/></svg></span>
  <span class="model-row-star" role="button" data-star="${md.id}" data-favorite="${fav ? 1 : ''}" title="${fav ? t.unfavorite : t.favorite}"><svg class="icon"><use href="#i-star"/></svg></span>
  <span class="model-row-default-action" role="button" data-default-id="${md.id}" data-default="${def ? 1 : ''}" title="${def ? t.unsetDefault : t.setDefault}"><svg class="icon"><use href="#i-bookmark"/></svg></span></div>`;
  }
  function modelGroups() {
    const q = fold($('#model-search').value), hit = (x) => fold(x.name).includes(q);
    return [
      {title: t.recent, icon: '#i-clock', mixed: true, items: recents.map(modelById).filter(hit)},
      {title: t.favorites, icon: '#i-star', mixed: true, items: MODELS.filter((x) => favorites.has(x.id) && hit(x))},
      {title: 'OpenCode Zen', mono: 'Z', mixed: false, items: MODELS.filter(hit)},
    ].filter((g) => g.items.length);
  }
  function renderModels() {
    const groups = modelGroups();
    list.innerHTML = groups.length
      ? groups.map((g, i) => `<div class="model-group" data-group="${i}"><div class="model-group-title">${g.title}</div>${g.items.map((x) => modelRow(x, g.mixed)).join('')}</div>`).join('')
      : `<p class="model-empty">${t.none(escapeHtml($('#model-search').value))}</p>`;
    const rail = $('.model-rail');
    rail.hidden = groups.length < 2;
    rail.innerHTML = groups.map((g, i) => `<span class="model-rail-item${i === 0 ? ' active' : ''}" data-group="${i}" title="${g.title}">${g.mono ? `<span class="provider-mono">${g.mono}</span>` : `<svg class="icon"><use href="${g.icon}"/></svg>`}</span>`).join('');
  }
  // O trilho acompanha o grupo que está no topo da lista.
  function syncRail() {
    let at = 0;
    for (const g of list.querySelectorAll('.model-group')) if (g.offsetTop - list.offsetTop <= list.scrollTop + 8) at = +g.dataset.group;
    for (const r of $$('.model-rail-item')) r.classList.toggle('active', +r.dataset.group === at);
  }
  function showModel() {
    const name = $('#model-name'), btn = $('#model-btn');
    // No compositor o "Free" sobra: a coluna do tutor da demo é estreita.
    name.textContent = modelById(modelId).name.replace(/ Free$/, '');
    $('#model-level').textContent = effort === 'default' ? '' : ` · ${t.effort[effort]}`;
    // Como o data-fit do app (header.css): sem espaço, o nível sai antes do nome cortar.
    btn.dataset.fit = '';
    if (name.scrollWidth > name.clientWidth) btn.dataset.fit = 'model';
  }
  function closeModels() {
    $('#model-pop').hidden = true;
    $('#model-btn').setAttribute('aria-expanded', 'false');
  }
  function pickModel(id) {
    modelId = id;
    recents = [id, ...recents.filter((x) => x !== id)].slice(0, 3);
    showModel();
    closeModels();
  }

  $('#model-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('#model-pop');
    if (!pop.hidden) return closeModels();
    pop.hidden = false;
    $('#model-btn').setAttribute('aria-expanded', 'true');
    $('#model-search').value = '';
    renderModels();
    list.scrollTop = 0;
    $('#model-search').focus({preventScroll: true});
  });
  list.addEventListener('click', (e) => {
    const star = e.target.closest('[data-star]'), def = e.target.closest('[data-default-id]');
    if (star) { const id = star.dataset.star; favorites.has(id) ? favorites.delete(id) : favorites.add(id); return renderModels(); }
    if (def) { defaultModel = def.dataset.defaultId; return renderModels(); }
    const row = e.target.closest('.model-row');
    if (row) pickModel(row.dataset.id);
  });
  list.addEventListener('scroll', syncRail, {passive: true});
  $('.model-rail').addEventListener('click', (e) => {
    const item = e.target.closest('.model-rail-item');
    if (!item) return;
    list.scrollTop = list.querySelector(`.model-group[data-group="${item.dataset.group}"]`).offsetTop - list.offsetTop;
    syncRail();
  });
  $('#model-search').addEventListener('input', renderModels);
  $('#model-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const row = $('#model-list .model-row'); if (row) pickModel(row.dataset.id); }
    if (e.key === 'Escape') { closeModels(); $('#model-btn').focus(); }
  });
  $('.effort-strip').addEventListener('click', (e) => {
    const b = e.target.closest('[data-effort]');
    if (!b) return;
    effort = b.dataset.effort;
    for (const x of $$('.effort-strip [data-effort]')) x.setAttribute('aria-checked', String(x === b));
    showModel();
  });
  // A estrela e o marcador redesenham a lista: o alvo do clique já saiu do DOM e não conta como "fora".
  document.addEventListener('click', (e) => {
    if (e.target.isConnected && !e.target.closest('#model-pop,#model-btn')) closeModels();
  });
  showModel();

  return {current: () => modelId};
}
