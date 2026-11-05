// Catálogo: search, plus shelves to catch up by tapping posters (one tap = seen).
import { h, icon, posterCard, posterImg, personImg, setCardWatched, loading, emptyState, errorText, fill } from './ui.js';
import { SAGA_GROUPS, STUDIOS } from './sagas.js';
import { MOVIE_GENRES, TV_GENRES } from './genres.js';
import { attachMic } from './voice.js';

const DECADES = [
  { id: '2020', label: 'Años 2020', from: '2020-01-01', to: '2029-12-31' },
  { id: '2010', label: 'Años 2010', from: '2010-01-01', to: '2019-12-31' },
  { id: '2000', label: 'Años 2000', from: '2000-01-01', to: '2009-12-31' },
  { id: '1990', label: 'Años 90', from: '1990-01-01', to: '1999-12-31' },
  { id: '1980', label: 'Años 80', from: '1980-01-01', to: '1989-12-31' },
  { id: 'old', label: 'Antes de 1980', from: null, to: '1979-12-31' },
];
const SOURCES = [
  { id: 'top', label: 'Imprescindibles' },
  { id: 'rated', label: 'Mejor valoradas' },
  { id: 'trending', label: 'Tendencias' },
  { id: 'decade', label: 'Por década' },
  { id: 'genre', label: 'Por género' },
  { id: 'provider', label: 'Plataformas' },
  { id: 'saga', label: 'Sagas', movieOnly: true },
  { id: 'studio', label: 'Estudios', movieOnly: true },
];

// Survives navigating away and back.
const state = { type: 'movie', source: 'top', option: null, saga: null, query: '', session: 0 };
let providerCache = { movie: null, tv: null };
const sagaCache = new Map(); // collection id → { name, poster, parts, upcoming }

export function render(root, ctx) {
  const { store, tmdb } = ctx;
  let observer = null;
  let loader = null; // { next(): Promise, done: bool }
  let searchTimer = null;
  let gen = 0;

  const isSeen = meta => {
    const it = store.getItem(`${meta.type}:${meta.id}`);
    return Boolean(it && (it.status === 'watched' || it.status === 'completed'));
  };
  const badgeFor = meta => {
    const it = store.getItem(`${meta.type}:${meta.id}`);
    if (!it) return null;
    if (it.status === 'watchlist') return 'PENDIENTE';
    if (it.status === 'watching') return 'VIENDO';
    return null;
  };

  // ----- Header -----
  const input = h('input', { class: 'input', id: 'catalog-search', type: 'search', placeholder: 'Buscar película o serie', autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Buscar película o serie', value: state.query });
  const mic = h('button', { class: 'icon-btn mic', type: 'button', 'aria-label': 'Buscar por voz' }, icon('mic'));
  const quick = h('button', { class: 'btn ghost', type: 'button', onClick: async () => (await import('./view-quicklist.js')).openQuickList(ctx) }, icon('list'), 'Lista rápida');
  const typeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Tipo' });
  const sourceChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Listas' });
  const optionChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Opciones' });
  const counter = h('div', { class: 'counter', 'aria-live': 'polite' });
  const intro = h('p', { class: 'lead' });
  const listHead = h('div', { class: 'stack' });
  const grid = h('div', { class: 'grid' });
  const status = h('div');
  const sentinel = h('div', { class: 'sentinel' });

  const page = h('div', { class: 'page' },
    h('header', { style: { display: 'grid', gap: '10px' } },
      h('p', { class: 'eyebrow' }, 'Catálogo'),
      h('h1', { class: 'h1' }, 'Ponerse al día'),
      intro),
    h('div', { style: { display: 'grid', gap: '12px' } },
      h('div', { class: 'searchbar' }, icon('search'), input, mic),
      h('div', { class: 'btn-row' }, quick, typeSeg)),
    h('div', { class: 'browse', style: { display: 'grid', gap: '10px' } }, sourceChips, optionChips),
    counter,
    h('div', { class: 'stack' }, listHead, grid, status, sentinel),
  );
  root.append(page);

  function paintCounter() {
    const total = Object.values(store.getState().items).filter(i => !i.deleted && (i.status === 'watched' || i.status === 'completed')).length;
    fill(counter, icon('hexcheck'), `${state.session} MARCADAS AHORA · ${total} VISTAS EN TOTAL`);
  }

  function paintControls() {
    const searching = Boolean(state.query.trim());
    intro.textContent = searching
      ? 'Toque un resultado para abrir su ficha.'
      : 'Toque una carátula para marcarla como vista y otra vez para deshacerlo. La «i» abre la ficha.';
    fill(typeSeg, ...[['movie', 'Pelis'], ['tv', 'Series']].map(([t, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(state.type === t), onClick: () => {
        if (state.type === t) return;
        state.type = t;
        if (t === 'tv' && SOURCES.find(s => s.id === state.source).movieOnly) state.source = 'top';
        state.option = null;
        refresh();
      } }, label)));
    page.querySelector('.browse').hidden = searching;
    fill(sourceChips, ...SOURCES.filter(s => !(s.movieOnly && state.type === 'tv')).map(s =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.source === s.id), onClick: () => {
        state.source = s.id; state.option = null; refresh();
      } }, s.label)));
    optionChips.hidden = true;
  }

  function setOptions(list, pick) {
    optionChips.hidden = false;
    if (state.option == null && list.length) state.option = list[0].id;
    fill(optionChips, ...list.map(o => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(String(state.option) === String(o.id)),
      onClick: () => { state.option = o.id; pick(); } }, o.label)));
  }

  function addCards(results, { search = false } = {}) {
    const seen = new Set([...grid.children].map(c => c.dataset.key));
    for (const meta of results) {
      const key = `${meta.type}:${meta.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      grid.append(search
        ? posterCard(meta, { watched: isSeen(meta), badge: badgeFor(meta), showType: true, tapLabel: `Ficha de ${meta.title}`, onTap: () => ctx.openDetail(meta.type, meta.id) })
        : posterCard(meta, { watched: isSeen(meta), badge: badgeFor(meta), onTap: card => tap(card, meta), onInfo: m => ctx.openDetail(m.type, m.id) }));
    }
  }

  function tap(card, meta) {
    const r = ctx.toggleSeen(meta);
    if (r.changed) state.session += r.seen ? 1 : -1;
    setCardWatched(card, r.seen);
    paintCounter();
  }

  // Paged loader around a TMDB list call.
  function paged(fetchPage, opts = {}) {
    const my = gen;
    let page = 0, total = 1, busy = false;
    const self = {
      get done() { return page >= total; },
      async next() {
        if (busy || page >= total || my !== gen) return;
        busy = true;
        fill(status, loading());
        try {
          const r = await fetchPage(page + 1);
          if (my !== gen) return;
          page = r.page; total = r.totalPages;
          addCards(r.results, opts);
          fill(status);
          // On tall screens the end of the list can still be in view: the observer will not
          // fire again, so keep filling until it scrolls out of reach.
          setTimeout(() => {
            if (my === gen && page < total && sentinel.getBoundingClientRect().top < innerHeight + 800) self.next();
          }, 0);
          if (!grid.children.length) {
            fill(status, opts.search && listHead.querySelector('.person-chip')
              ? h('p', { class: 'muted' }, 'Ninguna película ni serie con ese nombre. Toque una persona para ver su filmografía.')
              : emptyState('Sin resultados', opts.search ? 'Pruebe con otro título o con el título original.' : 'Esta lista está vacía.'));
          }
        } catch (e) {
          if (my !== gen) return;
          fill(status, emptyState('No se ha podido cargar', errorText(e), e.code === 'nokey' || e.code === 'unauthorized' ? h('a', { class: 'btn solid', href: '#ajustes' }, 'Ir a Ajustes') : h('button', { class: 'btn', type: 'button', onClick: () => { total = page + 1; self.next(); } }, 'Reintentar')));
        } finally { busy = false; }
      },
    };
    return self;
  }

  async function start(newLoader) {
    loader = newLoader;
    await loader.next();
  }

  // Sagas: a shelf of saga covers with progress, and the chosen saga's films below.
  function sagaView() {
    const my = gen;
    setOptions(SAGA_GROUPS.map(g => ({ id: g.id, label: g.label })), () => { state.saga = null; refreshList(); });
    const group = SAGA_GROUPS.find(g => g.id === state.option) || SAGA_GROUPS[0];
    if (!group.sagas.some(x => x.id === state.saga)) state.saga = group.sagas[0].id;
    const cards = new Map();
    const progressOf = c => (c ? `${c.parts.filter(isSeen).length}/${c.parts.length}` : '—');
    const paintCard = id => {
      const card = cards.get(id), c = sagaCache.get(id);
      if (!card) return;
      const done = c && c.parts.length && c.parts.every(isSeen);
      card.classList.toggle('complete', Boolean(done));
      card.setAttribute('aria-pressed', String(state.saga === id));
      card.querySelector('.saga-count').textContent = done ? 'COMPLETA' : progressOf(c);
      const bar = card.querySelector('.progress i');
      bar.style.width = c && c.parts.length ? `${Math.round((c.parts.filter(isSeen).length / c.parts.length) * 100)}%` : '0%';
      if (c && c.poster && !card.dataset.poster) { card.dataset.poster = '1'; card.querySelector('.saga-poster').replaceChildren(posterImg({ poster: c.poster, title: card.dataset.label }, 'w185')); }
    };
    const shelf = h('div', { class: 'saga-shelf', role: 'group', 'aria-label': `Sagas: ${group.label}` }, group.sagas.map(sg => {
      const card = h('button', { class: 'saga-card', type: 'button', dataset: { label: sg.label }, onClick: () => {
        if (state.saga === sg.id) return;
        state.saga = sg.id;
        cards.forEach((_, id) => paintCard(id));
        showSaga(sg);
      } },
        h('div', { class: 'saga-poster' }, posterImg({ poster: null, title: sg.label }, 'w185')),
        h('b', {}, sg.label),
        h('div', { class: 'saga-meta' }, h('span', { class: 'saga-count' }, '—'), h('div', { class: 'progress' }, h('i', {}))));
      cards.set(sg.id, card);
      return card;
    }));
    fill(listHead, shelf, h('div', { class: 'saga-head' }));
    listHead._paintAll = () => cards.forEach((_, id) => paintCard(id));
    cards.forEach((_, id) => paintCard(id));
    loader = { done: true, next: async () => {} };

    const load = id => (sagaCache.has(id) ? Promise.resolve(sagaCache.get(id))
      : tmdb.collection(id).then(c => { sagaCache.set(id, c); return c; }));
    // Covers and progress for the whole group, three at a time.
    const queue = group.sagas.map(x => x.id).filter(id => !sagaCache.has(id));
    const worker = async () => { while (queue.length && my === gen) { const id = queue.shift(); try { await load(id); } catch { /* card keeps its placeholder */ } if (my === gen) paintCard(id); } };
    worker(); worker(); worker();

    async function showSaga(sg) {
      const head = listHead.querySelector('.saga-head');
      fill(grid);
      fill(head);
      fill(status, loading('Localizando saga'));
      try {
        const c = await load(sg.id);
        if (my !== gen || state.saga !== sg.id) return;
        fill(status);
        paintCard(sg.id);
        if (!c.parts.length) { fill(status, emptyState('Saga sin estrenos', 'Ninguna película de esta saga se ha estrenado todavía.')); return; }
        const all = h('button', { class: 'btn solid', type: 'button' });
        const paintAll = () => {
          const missing = c.parts.filter(p => !isSeen(p)).length;
          fill(all, icon('hexcheck'), missing ? `Marcar la saga entera (${missing})` : 'Saga completa');
          all.disabled = !missing;
        };
        all.addEventListener('click', () => {
          for (const p of c.parts) if (!isSeen(p)) { const r = ctx.toggleSeen(p); if (r.changed) state.session++; }
          grid.querySelectorAll('.card').forEach(card => setCardWatched(card, true));
          paintAll(); paintCounter(); paintCard(sg.id);
          ctx.toast(`${sg.label}: saga registrada.`);
        });
        paintAll();
        fill(head, h('div', { class: 'section-head' },
          h('div', { style: { display: 'grid', gap: '4px' } }, h('h2', { class: 'h2' }, sg.label),
            h('span', { class: 'mono faint' }, `${c.parts.length} ${c.parts.length === 1 ? 'PELÍCULA' : 'PELÍCULAS'}${c.upcoming ? ` · ${c.upcoming} EN CAMINO` : ''}`)),
          all));
        listHead._paintAll = () => { paintAll(); cards.forEach((_, id) => paintCard(id)); };
        addCards(c.parts);
      } catch (e) {
        if (my === gen && state.saga === sg.id) fill(status, emptyState('No se ha podido cargar', errorText(e)));
      }
    }
    showSaga(group.sagas.find(x => x.id === state.saga));
  }

  async function refreshList() {
    gen++;
    fill(grid); fill(listHead); fill(status);
    listHead._paintAll = null;
    loader = null;
    const t = state.type;
    const q = state.query.trim();
    if (q) {
      // People who match (directors, actors) appear first: one tap opens their filmography.
      const my = gen;
      return start(paged(p => tmdb.search(q, p).then(r => {
        if (p === 1 && my === gen && r.people.length) {
          fill(listHead, h('div', { class: 'chips person-chips', role: 'group', 'aria-label': 'Personas' }, r.people.slice(0, 6).map(person =>
            h('button', { class: 'chip person-chip', type: 'button', onClick: () => ctx.openPerson(person) },
              h('span', { class: 'pc-photo' }, personImg(person, 'w45')), person.name))));
        }
        return r;
      }), { search: true }));
    }
    paintControls();
    switch (state.source) {
      case 'top': return start(paged(p => tmdb.discover(t, { sort: 'vote_count.desc' }, p)));
      case 'rated': return start(paged(p => tmdb.top(t, p)));
      case 'trending': return start(paged(p => tmdb.trending(t, p)));
      case 'decade': {
        setOptions(DECADES, refreshList);
        const d = DECADES.find(x => x.id === state.option) || DECADES[0];
        return start(paged(p => tmdb.discover(t, { from: d.from, to: d.to, sort: 'vote_count.desc' }, p)));
      }
      case 'genre': {
        const list = (t === 'movie' ? MOVIE_GENRES : TV_GENRES).map(([id, label]) => ({ id, label }));
        setOptions(list, refreshList);
        return start(paged(p => tmdb.discover(t, { genre: state.option, sort: 'vote_count.desc' }, p)));
      }
      case 'provider': {
        const my = gen;
        try {
          if (!providerCache[t]) providerCache[t] = (await tmdb.providers(t)).slice(0, 10);
        } catch (e) { fill(status, emptyState('No se ha podido cargar', errorText(e))); return; }
        if (my !== gen) return;
        setOptions(providerCache[t].map(p => ({ id: p.id, label: p.name })), refreshList);
        return start(paged(p => tmdb.discover(t, { provider: state.option, sort: 'vote_count.desc' }, p)));
      }
      case 'saga': return sagaView();
      case 'studio': {
        setOptions(STUDIOS, refreshList);
        return start(paged(p => tmdb.discover('movie', { company: state.option, sort: 'vote_count.desc' }, p)));
      }
    }
  }

  function refresh() { paintControls(); paintCounter(); refreshList(); }

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = input.value; paintControls(); refreshList(); }, 350);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(searchTimer); state.query = input.value; paintControls(); refreshList(); input.blur(); } });
  attachMic(mic, input, said => { state.query = said; paintControls(); refreshList(); });

  observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting) && loader && !loader.done) loader.next();
  }, { rootMargin: '800px 0px' });
  observer.observe(sentinel);
  // Backup for browsers or views where the observer does not fire.
  const onScroll = () => {
    if (loader && !loader.done && sentinel.getBoundingClientRect().top < innerHeight + 800) loader.next();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  refresh();

  return {
    // Data changed elsewhere (detail sheet, sync): repaint card states in place, keep scroll.
    update() {
      grid.querySelectorAll('.card').forEach(card => {
        const [type, id] = card.dataset.key.split(':');
        const it = store.getItem(card.dataset.key);
        const seen = Boolean(it && (it.status === 'watched' || it.status === 'completed'));
        if (card.classList.contains('is-watched') !== seen) { card.classList.toggle('is-watched', seen); card.querySelector('.tap').setAttribute('aria-pressed', String(seen)); }
        const b = card.querySelector('.badge');
        const want = badgeFor({ type, id });
        if (b && !want) b.remove();
        else if (want && (!b || b.textContent !== want)) { if (b) b.textContent = want; else card.querySelector('.poster').append(h('span', { class: 'badge' }, want)); }
      });
      if (listHead._paintAll) listHead._paintAll();
      paintCounter();
    },
    destroy() { gen++; observer && observer.disconnect(); window.removeEventListener('scroll', onScroll); clearTimeout(searchTimer); },
  };
}
