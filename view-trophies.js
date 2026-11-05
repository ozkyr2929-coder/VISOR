// Sala de trofeos: rank, rooms, every trophy as a medal; each opens a sheet you can act on.
import { h, icon, openSheet, posterCard, setCardWatched, loading, formatDate, emptyState, fill } from './ui.js';
import { ROOMS, TIERS, RANKS } from './trophies.js';
import { medal } from './trophy-art.js';
import { topPeople, todayISO } from './model.js';

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
const state = { room: 'all', show: 'all' };
const isoOf = ts => (ts ? todayISO(new Date(ts)) : null);
const rankTier = level => (level >= 7 ? 'platinum' : level >= 5 ? 'gold' : level >= 3 ? 'silver' : 'bronze');

export function rankEmblem(ev, size = 92) {
  return medal({ unlocked: true, tier: rankTier(ev.rank.level), icon: 'crown', name: ev.rank.name, goal: 1, progress: 1 }, { size });
}

function tile(t, onOpen) {
  const hidden = t.secret && !t.unlocked;
  return h('button', { class: `trophy-tile${t.unlocked ? ' won' : ''}`, type: 'button', onClick: () => onOpen(t),
    'aria-label': hidden ? 'Trofeo secreto' : `${t.name}. ${t.unlocked ? 'Conseguido' : `${t.progress} de ${t.goal}`}` },
    h('div', { class: 'trophy-medal' }, medal(t, { size: 72, label: false })),
    h('b', {}, hidden ? '???' : t.name),
    h('span', { class: `trophy-sub tier-${t.tier}` }, hidden ? 'SECRETO' : t.unlocked ? TIERS[t.tier].label.toUpperCase() : `${t.progress}/${t.goal}`));
}

// The sheet of one trophy. Saga and film trophies show their films, ready to mark with a tap.
export function openTrophy(ctx, id) {
  const { store, tmdb } = ctx;
  const find = () => ctx.trophies().list.find(x => x.id === id);
  let t = find();
  if (!t) return;
  const room = ROOMS.find(r => r.id === t.room);
  const head = h('div', { class: 'trophy-hero' });
  const extra = h('div', { class: 'stack' });
  const paintHead = () => {
    t = find();
    const hidden = t.secret && !t.unlocked;
    const ratio = Math.min(1, t.progress / t.goal);
    fill(head, 
      h('div', { class: 'trophy-stage' }, h('div', { class: 'trophy-spin' }, medal(t, { size: 168 }))),
      h('p', { class: `trophy-tier tier-${t.tier}` }, `${TIERS[t.tier].label} · ${TIERS[t.tier].points} puntos · ${room.label}`),
      h('h2', { class: 'h1' }, hidden ? 'Trofeo secreto' : t.name),
      h('p', { class: 'lead' }, hidden ? 'Nadie sabe cómo se consigue. Siga viendo cine y aparecerá.' : t.desc),
      t.unlocked
        ? h('p', { class: 'status-line ok' }, t.at ? `Conseguido el ${formatDate(isoOf(t.at))}.` : 'Conseguido.')
        : hidden ? null : h('div', { class: 'trophy-progress' },
          h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round(ratio * 100)}%` } })),
          h('span', { class: 'mono faint' }, `${t.progress} / ${t.goal}`)));
  };
  paintHead();
  const unsub = store.subscribe(() => queueMicrotask(paintHead));
  openSheet(h('div', { class: 'sheet-inner trophy-sheet' }, head, extra), { label: t.name, onClose: unsub });

  const cards = metas => {
    const grid = h('div', { class: 'grid' }, metas.map(m => {
      const it = store.getItem(`movie:${m.id}`);
      const seen = Boolean(it && it.status === 'watched');
      return posterCard(m, { watched: seen, onTap: card => { const r = ctx.toggleSeen(m); setCardWatched(card, r.seen); }, onInfo: x => ctx.openDetail('movie', x.id) });
    }));
    return [h('p', { class: 'eyebrow' }, 'Toque las que ya ha visto'), grid];
  };

  if (t.kind === 'saga' || t.kind === 'film') {
    fill(extra, loading('Buscando las películas'));
    (async () => {
      const found = new Map();
      for (const cid of t.collections || []) {
        try { for (const p of (await tmdb.collection(cid)).parts) found.set(p.id, p); } catch { /* fall back below */ }
      }
      for (const fid of t.films) {
        if (found.has(fid)) continue;
        try { const b = await tmdb.brief('movie', fid); found.set(fid, { type: 'movie', id: fid, title: b.title, year: b.year, poster: b.poster, backdrop: b.backdrop, genres: b.genres, runtime: b.runtime }); } catch { /* skip */ }
      }
      const metas = t.films.map(fid => found.get(fid)).filter(Boolean);
      fill(extra, ...(metas.length ? cards(metas) : [h('p', { class: 'muted' }, 'Sin conexión: las carátulas aparecerán cuando vuelva la red.')]));
    })();
  } else if (t.kind === 'person' && ctx.openPerson) {
    fill(extra, h('div', {}, h('button', { class: 'btn', type: 'button', onClick: () => ctx.openPerson(t.person) }, icon('profile'), `Filmografía de ${t.person.name}`)));
  } else if (t.kind === 'people') {
    const items = store.getState().items;
    const keys = Object.values(items).filter(it => !it.deleted && it.type === 'movie' && it.status === 'watched').map(it => it.key);
    const { actors, directors } = topPeople(ctx.library.all(), keys);
    const chip = p => h('button', { class: 'director', type: 'button', onClick: () => ctx.openPerson && ctx.openPerson(p) }, p.name, h('b', {}, ` ×${p.count}`));
    const pending = ctx.library.pending();
    fill(extra, 
      directors.length ? h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Sus directores más vistos'), h('div', { class: 'directors' }, directors.slice(0, 6).map(chip))) : null,
      actors.length ? h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Las caras que más se repiten'), h('div', { class: 'directors' }, actors.slice(0, 6).map(chip))) : null,
      pending ? h('p', { class: 'faint', style: { fontSize: 'var(--t-sm)' } }, `Aún analizando ${pending} ${pending === 1 ? 'película' : 'películas'} de su registro. Se completa sola mientras usa la app.`) : null);
  }
}

// Unlock celebration: one toast per trophy (or a summary when several arrive together).
export function celebrate(ctx, list) {
  const box = document.getElementById('toasts');
  if (!box || !list.length) return;
  const show = list.length > 3 ? [list[0]] : list;
  show.forEach((t, i) => setTimeout(() => {
    const node = h('button', { class: `toast trophy-toast tier-${t.tier}`, type: 'button', onClick: () => { node.remove(); ctx.openTrophy(t.id); } },
      h('span', { class: 'tt-medal' }, medal(t, { size: 48, label: false })),
      h('span', { class: 'tt-text' },
        h('span', { class: 'tt-eyebrow' }, list.length > 3 ? `${list.length} trofeos nuevos` : `Trofeo desbloqueado · ${TIERS[t.tier].label}`),
        h('b', {}, list.length > 3 ? `${t.name} y ${list.length - 1} más` : t.name)));
    box.append(node);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => { node.classList.add('out'); setTimeout(() => node.remove(), 400); }, 5200);
  }, i * 900));
}

export function render(root, ctx) {
  const page = h('div', { class: 'page' });
  root.append(page);
  const open = t => openTrophy(ctx, t.id);

  function draw() {
    const ev = ctx.trophies();
    const tiers = Object.fromEntries(TIER_ORDER.map(k => [k, ev.list.filter(t => t.unlocked && t.tier === k).length]));
    const next = ev.rank.next;
    const pending = ctx.library.pending();
    const inRoom = t => state.room === 'all' || t.room === state.room;
    const shown = t => state.show === 'all' || (state.show === 'won' ? t.unlocked : !t.unlocked);
    const roomChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Salas' },
      [{ id: 'all', label: 'Todas' }, ...ROOMS].map(r => {
        const list = r.id === 'all' ? ev.list : ev.list.filter(t => t.room === r.id);
        return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.room === r.id), onClick: () => { state.room = r.id; draw(); } },
          `${r.label} ${list.filter(t => t.unlocked).length}/${list.length}`);
      }));
    const showSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Mostrar' },
      [['all', 'Todos'], ['won', 'Conseguidos'], ['todo', 'Pendientes']].map(([id, label]) =>
        h('button', { type: 'button', 'aria-pressed': String(state.show === id), onClick: () => { state.show = id; draw(); } }, label)));
    const rooms = ROOMS.filter(r => state.room === 'all' || r.id === state.room).map(r => {
      const list = ev.list.filter(t => t.room === r.id && inRoom(t) && shown(t));
      if (!list.length) return null;
      const all = ev.list.filter(t => t.room === r.id);
      return h('section', { class: 'trophy-room' },
        h('div', { class: 'section-head' },
          h('div', { style: { display: 'grid', gap: '4px' } }, h('h2', { class: 'h2' }, r.label), h('p', { class: 'muted', style: { fontSize: 'var(--t-sm)' } }, r.blurb)),
          h('span', { class: 'mono faint' }, `${all.filter(t => t.unlocked).length}/${all.length}`)),
        h('div', { class: 'trophy-grid' }, list.map(t => tile(t, open))));
    }).filter(Boolean);

    fill(page, ...[
      h('header', { style: { display: 'grid', gap: '10px' } },
        h('a', { class: 'link back-link', href: '#perfil' }, icon('back'), 'Perfil'),
        h('p', { class: 'eyebrow' }, 'Sala de trofeos'),
        h('h1', { class: 'h1' }, 'Sus trofeos')),
      h('section', { class: 'rank-panel frame' },
        h('div', { class: 'rank-emblem' }, rankEmblem(ev, 96)),
        h('div', { class: 'rank-body' },
          h('p', { class: 'eyebrow' }, `Rango ${ev.rank.level} de ${RANKS.length}`),
          h('p', { class: 'rank-name' }, ev.rank.name),
          h('p', { class: 'mono', style: { color: 'var(--amber)' } }, `${ev.points} PUNTOS · ${ev.unlocked}/${ev.total} TROFEOS`),
          h('div', { class: 'progress rank-bar' }, h('i', { style: { width: `${Math.round(ev.rank.progress * 100)}%` } })),
          h('p', { class: 'muted', style: { fontSize: 'var(--t-sm)' } }, next ? `Faltan ${next.at - ev.points} puntos para ${next.name}.` : 'Ha llegado a lo más alto. Leyenda del cine.'),
          h('div', { class: 'tier-counts' }, TIER_ORDER.map(k => h('span', { class: `tier-count tier-${k}` }, h('i', {}), `${tiers[k]} ${TIERS[k].label.toLowerCase()}`))))),
      pending ? h('p', { class: 'faint', style: { fontSize: 'var(--t-sm)' } }, `Analizando su filmoteca para los trofeos de autores y horas: quedan ${pending} ${pending === 1 ? 'película' : 'películas'}. Se completa sola mientras usa la app.`) : null,
      h('div', { class: 'stack' }, roomChips, h('div', {}, showSeg)),
      ...(rooms.length ? rooms : [emptyState(state.show === 'won' ? 'Aún no hay trofeos aquí' : 'Todo conseguido', state.show === 'won' ? 'Marque lo que ha visto y los trofeos irán llegando.' : 'No queda nada por conseguir en esta sala.')]),
    ].filter(Boolean));
  }

  draw();
  const pendingOpen = ctx.takePendingTrophy && ctx.takePendingTrophy();
  if (pendingOpen) setTimeout(() => openTrophy(ctx, pendingOpen), 0);
  return { update: draw };
}
