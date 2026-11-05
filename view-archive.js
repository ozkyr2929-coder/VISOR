// Archivo: diary by month, everything seen (with quick rating), watchlist and series.
import { h, posterImg, starsInput, starsLabel, emptyState, MONTHS, MONTHS_SHORT, STATUS_LABEL, fill } from './ui.js';
import { diaryEntries } from './model.js';

const TABS = [['diario', 'Diario'], ['vistas', 'Vistas'], ['pendientes', 'Pendientes'], ['series', 'Series']];
const PAGE = 150;
const remember = (() => { try { return JSON.parse(localStorage.getItem('visor.archive') || '{}'); } catch { return {}; } })();
const state = { tab: 'diario', type: 'all', sort: 'recent', unrated: false, limit: PAGE, ...remember, limit: PAGE };
const persist = () => { try { localStorage.setItem('visor.archive', JSON.stringify({ tab: state.tab, type: state.type, sort: state.sort })); } catch { /* ignore */ } };

const lastDate = it => it.type === 'movie'
  ? (it.watches || []).map(w => w.date).filter(Boolean).sort().pop() || null
  : Object.values(it.seen || {}).filter(Boolean).sort().pop() || null;
const isSeen = it => it.status === 'watched' || it.status === 'completed';

export function render(root, ctx) {
  const { store } = ctx;
  const body = h('div', { style: { display: 'grid', gap: '16px' } });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const page = h('div', { class: 'page' },
    h('header', { style: { display: 'grid', gap: '10px' } }, h('p', { class: 'eyebrow' }, 'Archivo'), h('h1', { class: 'h1' }, 'Su registro')),
    tabs, body);
  root.append(page);

  const live = () => Object.values(store.getState().items).filter(i => !i.deleted);
  const openBtn = it => h('button', { class: 'name', type: 'button', onClick: () => ctx.openDetail(it.type, it.id) }, it.title);
  const thumb = it => h('div', { class: 'thumb' }, posterImg(it, 'w92'));
  const cta = h('a', { class: 'btn solid', href: '#catalogo' }, 'Ir al Catálogo');

  function toolbar({ sorts = true, unrated = false } = {}) {
    const type = h('select', { class: 'select', id: 'arch-type', 'aria-label': 'Tipo' },
      [['all', 'Pelis y series'], ['movie', 'Solo pelis'], ['tv', 'Solo series']].map(([v, l]) => h('option', { value: v, selected: state.type === v }, l)));
    type.addEventListener('change', () => { state.type = type.value; state.limit = PAGE; persist(); draw(); });
    const sort = sorts ? h('select', { class: 'select', id: 'arch-sort', 'aria-label': 'Orden' },
      [['recent', 'Recientes'], ['rating', 'Mejor nota'], ['title', 'Título'], ['year', 'Año']].map(([v, l]) => h('option', { value: v, selected: state.sort === v }, l))) : null;
    if (sort) sort.addEventListener('change', () => { state.sort = sort.value; persist(); draw(); });
    const un = unrated ? h('label', { class: 'toggle', for: 'arch-unrated' }, h('input', { type: 'checkbox', id: 'arch-unrated', checked: state.unrated }), 'Solo sin nota') : null;
    if (un) un.querySelector('input').addEventListener('change', e => { state.unrated = e.target.checked; draw(); });
    return h('div', { class: 'toolbar' }, h('div', { class: 'btn-row' }, type, sort), un);
  }

  const byType = it => state.type === 'all' || it.type === state.type;
  function sortItems(list) {
    const s = state.sort;
    return list.sort((a, b) => s === 'title' ? a.title.localeCompare(b.title, 'es')
      : s === 'year' ? (b.year || 0) - (a.year || 0)
      : s === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title, 'es')
      : (lastDate(b) || '').localeCompare(lastDate(a) || '') || (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  const more = total => total > state.limit
    ? h('button', { class: 'btn ghost', type: 'button', onClick: () => { state.limit += PAGE; draw(); } }, `Mostrar más (${total - state.limit})`) : null;

  function diary() {
    const items = store.getState().items;
    const entries = diaryEntries(items).filter(e => byType(items[e.key]));
    const bulk = live().filter(it => byType(it) && isSeen(it) && !lastDate(it)).length;
    const out = [toolbar({ sorts: false })];
    if (!entries.length) out.push(emptyState('El diario está vacío', 'Aquí aparecerá cada visionado con fecha. Lo que marque en bloque queda como «antes de VISOR».', cta));
    let month = '';
    const rows = h('div', { class: 'rows' });
    for (const e of entries.slice(0, state.limit)) {
      const it = items[e.key];
      const [y, m, d] = e.date.split('-').map(Number);
      const label = `${MONTHS[m - 1]} ${y}`;
      if (label !== month) { month = label; rows.append(h('h2', { class: 'month' }, label)); }
      rows.append(h('div', { class: 'row' },
        h('div', { class: 'day' }, h('b', {}, String(d)), h('span', {}, MONTHS_SHORT[m - 1])),
        thumb(it),
        h('div', { class: 'body' }, openBtn(it), h('div', { class: 'meta' }, e.kind === 'season' ? `Temporada ${e.season}` : `Película · ${it.year || '—'}`)),
        starsLabel(e.rating)));
    }
    if (entries.length) out.push(rows, more(entries.length));
    if (bulk) out.push(h('p', { class: 'faint', style: { fontSize: 'var(--t-sm)' } }, `${bulk} ${bulk === 1 ? 'título marcado' : 'títulos marcados'} sin fecha (antes de VISOR) no aparecen en el diario. Están en «Vistas».`));
    return out;
  }

  function seenList() {
    let list = live().filter(it => byType(it) && isSeen(it));
    if (state.unrated) list = list.filter(it => it.rating == null);
    sortItems(list);
    const out = [toolbar({ unrated: true }), h('p', { class: 'mono faint' }, `${list.length} ${list.length === 1 ? 'TÍTULO' : 'TÍTULOS'}`)];
    if (!list.length) { out.push(emptyState(state.unrated ? 'Todo puntuado' : 'Aún no hay nada visto', state.unrated ? 'No queda nada sin nota.' : 'Marque lo que ya ha visto desde el Catálogo.', state.unrated ? null : cta)); return out; }
    out.push(h('div', { class: 'rows' }, list.slice(0, state.limit).map(it => {
      const d = lastDate(it);
      return h('div', { class: 'row' }, thumb(it),
        h('div', { class: 'body' }, openBtn(it),
          h('div', { class: 'meta' }, [it.year || '—', it.type === 'tv' ? 'Serie' : 'Peli', d ? d.split('-').reverse().join('/') : 'antes de VISOR'].join(' · '))),
        starsInput(it.rating, r => store.setRating(it.key, r), { small: true, label: `Nota de ${it.title}` }));
    })), more(list.length));
    return out;
  }

  function watchlist() {
    const list = sortItems(live().filter(it => byType(it) && it.status === 'watchlist'));
    const out = [toolbar()];
    if (!list.length) { out.push(emptyState('Nada pendiente', 'Añada pelis o series a pendientes desde su ficha.', cta)); return out; }
    out.push(h('div', { class: 'grid' }, list.map(it =>
      h('button', { class: 'card', type: 'button', onClick: () => ctx.openDetail(it.type, it.id), 'aria-label': `Ficha de ${it.title}` },
        h('div', { class: 'poster tilt' }, posterImg(it, 'w342')),
        h('div', { class: 'title' }, it.title),
        h('div', { class: 'sub' }, `${it.year || '—'} · ${it.type === 'tv' ? 'SERIE' : 'PELI'}`)))));
    return out;
  }

  function series() {
    const order = { watching: 0, watchlist: 1, completed: 2, dropped: 3 };
    const list = live().filter(it => it.type === 'tv' && it.status)
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.title.localeCompare(b.title, 'es'));
    if (!list.length) return [emptyState('Sin series', 'Siga una serie desde su ficha o márquela en el Catálogo.', cta)];
    return [h('div', { class: 'rows' }, list.map(it => {
      const total = (it.seasons || []).filter(s => s.n > 0).length;
      const done = Object.keys(it.seen || {}).length;
      return h('div', { class: 'row' }, thumb(it),
        h('div', { class: 'body', style: { gap: '6px' } }, openBtn(it),
          h('div', { class: 'meta' }, total ? `${done}/${total} temporadas` : 'Temporadas por cargar'),
          total ? h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round((done / total) * 100)}%` } })) : null),
        h('span', { class: `pill ${it.status}` }, STATUS_LABEL[it.status]));
    }))];
  }

  function draw() {
    fill(tabs, ...TABS.map(([id, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(state.tab === id),
      onClick: () => { state.tab = id; state.limit = PAGE; persist(); draw(); } }, label)));
    const view = { diario: diary, vistas: seenList, pendientes: watchlist, series }[state.tab] || diary;
    fill(body, ...view().filter(Boolean));
  }

  draw();
  return { update: draw };
}
