// Catálogo: search, plus shelves to catch up by tapping posters (one tap = seen).
import { h, icon, posterCard, setCardWatched, loading, emptyState, errorText } from './ui.js';
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
// Label shown → name TMDB knows the collection by.
const SAGAS = [
  ['Harry Potter', 'Harry Potter'], ['Star Wars', 'Star Wars'], ['El Señor de los Anillos', 'The Lord of the Rings'],
  ['El Hobbit', 'The Hobbit'], ['Los Vengadores', 'The Avengers'], ['Jurassic Park', 'Jurassic Park'],
  ['Regreso al futuro', 'Back to the Future'], ['Piratas del Caribe', 'Pirates of the Caribbean'], ['Toy Story', 'Toy Story'],
  ['Indiana Jones', 'Indiana Jones'], ['El Padrino', 'The Godfather'], ['Matrix', 'The Matrix'],
  ['El caballero oscuro', 'The Dark Knight'], ['Fast & Furious', 'The Fast and the Furious'], ['Misión: Imposible', 'Mission: Impossible'],
  ['James Bond', 'James Bond'], ['Los juegos del hambre', 'The Hunger Games'], ['Crepúsculo', 'The Twilight'],
  ['Shrek', 'Shrek'], ['Gru, mi villano favorito', 'Despicable Me'], ['Ice Age', 'Ice Age'], ['Alien', 'Alien'],
  ['Terminator', 'The Terminator'], ['Rocky', 'Rocky'], ['John Wick', 'John Wick'], ['Mad Max', 'Mad Max'],
  ['Dune', 'Dune'], ['Torrente', 'Torrente'],
];
const STUDIOS = ['Pixar', 'Marvel Studios', 'Studio Ghibli', 'Walt Disney Animation Studios', 'DreamWorks Animation', 'Lucasfilm Ltd.', 'A24'];

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
const state = { type: 'movie', source: 'top', option: null, query: '', session: 0 };
let providerCache = { movie: null, tv: null };

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
  const listHead = h('div');
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
    h('div', { style: { display: 'grid', gap: '14px' } }, listHead, grid, status, sentinel),
  );
  root.append(page);

  function paintCounter() {
    const total = Object.values(store.getState().items).filter(i => !i.deleted && (i.status === 'watched' || i.status === 'completed')).length;
    counter.replaceChildren(icon('hexcheck'), `${state.session} MARCADAS AHORA · ${total} VISTAS EN TOTAL`);
  }

  function paintControls() {
    const searching = Boolean(state.query.trim());
    intro.textContent = searching
      ? 'Toque un resultado para abrir su ficha.'
      : 'Toque una carátula para marcarla como vista y otra vez para deshacerlo. La «i» abre la ficha.';
    typeSeg.replaceChildren(...[['movie', 'Pelis'], ['tv', 'Series']].map(([t, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(state.type === t), onClick: () => {
        if (state.type === t) return;
        state.type = t;
        if (t === 'tv' && SOURCES.find(s => s.id === state.source).movieOnly) state.source = 'top';
        state.option = null;
        refresh();
      } }, label)));
    page.querySelector('.browse').hidden = searching;
    sourceChips.replaceChildren(...SOURCES.filter(s => !(s.movieOnly && state.type === 'tv')).map(s =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.source === s.id), onClick: () => {
        state.source = s.id; state.option = null; refresh();
      } }, s.label)));
    optionChips.hidden = true;
  }

  function setOptions(list, pick) {
    optionChips.hidden = false;
    if (state.option == null && list.length) state.option = list[0].id;
    optionChips.replaceChildren(...list.map(o => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(String(state.option) === String(o.id)),
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
        status.replaceChildren(loading());
        try {
          const r = await fetchPage(page + 1);
          if (my !== gen) return;
          page = r.page; total = r.totalPages;
          addCards(r.results, opts);
          status.replaceChildren();
          // On tall screens the end of the list can still be in view: the observer will not
          // fire again, so keep filling until it scrolls out of reach.
          setTimeout(() => {
            if (my === gen && page < total && sentinel.getBoundingClientRect().top < innerHeight + 800) self.next();
          }, 0);
          if (!grid.children.length) status.replaceChildren(emptyState('Sin resultados', opts.search ? 'Pruebe con otro título o con el título original.' : 'Esta lista está vacía.'));
        } catch (e) {
          if (my !== gen) return;
          status.replaceChildren(emptyState('No se ha podido cargar', errorText(e), e.code === 'nokey' || e.code === 'unauthorized' ? h('a', { class: 'btn solid', href: '#ajustes' }, 'Ir a Ajustes') : h('button', { class: 'btn', type: 'button', onClick: () => { total = page + 1; self.next(); } }, 'Reintentar')));
        } finally { busy = false; }
      },
    };
    return self;
  }

  async function start(newLoader) {
    loader = newLoader;
    await loader.next();
  }

  async function sagaView() {
    const my = gen;
    setOptions(SAGAS.map(([label, q]) => ({ id: q, label })), refreshList);
    status.replaceChildren(loading('Localizando saga'));
    try {
      const c = await tmdb.collectionByName(String(state.option));
      if (my !== gen) return;
      status.replaceChildren();
      if (!c || !c.parts.length) { status.replaceChildren(emptyState('Saga no encontrada', 'TMDB no tiene esta saga ahora mismo.')); return; }
      const parts = c.parts;
      const all = h('button', { class: 'btn solid', type: 'button' });
      const paintAll = () => {
        const missing = parts.filter(p => !isSeen(p)).length;
        all.replaceChildren(icon('hexcheck'), missing ? `Marcar la saga entera (${missing})` : 'Saga completa');
        all.disabled = !missing;
      };
      all.addEventListener('click', () => {
        for (const p of parts) if (!isSeen(p)) { const r = ctx.toggleSeen(p); if (r.changed) state.session++; }
        grid.querySelectorAll('.card').forEach(card => setCardWatched(card, true));
        paintAll(); paintCounter();
        ctx.toast(`${c.name}: saga registrada.`);
      });
      paintAll();
      listHead.replaceChildren(h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, c.name), all));
      listHead._paintAll = paintAll;
      addCards(parts);
      loader = { done: true, next: async () => {} };
    } catch (e) {
      if (my === gen) status.replaceChildren(emptyState('No se ha podido cargar', errorText(e)));
    }
  }

  async function refreshList() {
    gen++;
    grid.replaceChildren(); listHead.replaceChildren(); status.replaceChildren();
    loader = null;
    const t = state.type;
    const q = state.query.trim();
    if (q) return start(paged(p => tmdb.search(q, p), { search: true }));
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
        } catch (e) { status.replaceChildren(emptyState('No se ha podido cargar', errorText(e))); return; }
        if (my !== gen) return;
        setOptions(providerCache[t].map(p => ({ id: p.id, label: p.name })), refreshList);
        return start(paged(p => tmdb.discover(t, { provider: state.option, sort: 'vote_count.desc' }, p)));
      }
      case 'saga': return sagaView();
      case 'studio': {
        setOptions(STUDIOS.map(s => ({ id: s, label: s.replace(' Ltd.', '') })), refreshList);
        const my = gen;
        status.replaceChildren(loading());
        try {
          const co = await tmdb.companyByName(String(state.option));
          if (my !== gen) return;
          if (!co) { status.replaceChildren(emptyState('Estudio no encontrado', '')); return; }
          return start(paged(p => tmdb.discover('movie', { company: co.id, sort: 'vote_count.desc' }, p)));
        } catch (e) { if (my === gen) status.replaceChildren(emptyState('No se ha podido cargar', errorText(e))); }
        return;
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
