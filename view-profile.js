// Perfil: the user's cinephile dossier — favourites, their characters, directors, taste and badges.
import { h, icon, posterImg, personImg, openSheet, emptyState, loading, MONTHS, fill } from './ui.js';
import { favoritesOf, topPeople, computeStats, decadeCounts, memberSince, normalizeTitle } from './model.js';
import { nextTrophy, TIERS } from './trophies.js';
import { medal } from './trophy-art.js';
import { genreName } from './genres.js';
import { projector, shuffle } from './fx.js';
import { img } from './tmdb.js';

const NS = 'http://www.w3.org/2000/svg';
const isSeen = it => it.status === 'watched' || it.status === 'completed' || Object.keys(it.seen || {}).length > 0;

// Spider chart of the most watched genres.
function radar(genres) {
  const n = genres.length, cx = 160, cy = 150, R = 100;
  const max = Math.max(...genres.map(g => g.count));
  const pt = (i, r) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const rings = [0.33, 0.66, 1].map(f => `<polygon class="ring" points="${genres.map((_, i) => pt(i, R * f).join(',')).join(' ')}"/>`).join('');
  const axes = genres.map((_, i) => { const [x, y] = pt(i, R); return `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('');
  const shapePts = genres.map((g, i) => pt(i, R * (0.15 + 0.85 * g.count / max)));
  const labels = genres.map((g, i) => {
    const [x, y] = pt(i, R + 22);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x}" y="${y + 4}" text-anchor="${anchor}">${genreName(g.id)}</text>`;
  }).join('');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 320 300');
  svg.setAttribute('class', 'radar');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Géneros más vistos: ${genres.map(g => `${genreName(g.id)} ${g.count}`).join(', ')}`);
  svg.innerHTML = `${rings}${axes}<polygon class="shape" points="${shapePts.map(p => p.join(',')).join(' ')}"/>`
    + shapePts.map(([x, y]) => `<circle class="dot" cx="${x}" cy="${y}" r="3"/>`).join('') + labels;
  return svg;
}

function decadesChart(counts) {
  const entries = Object.entries(counts).map(([d, n]) => [Number(d), n]).sort((a, b) => a[0] - b[0]);
  const max = Math.max(...entries.map(e => e[1]));
  const label = d => (d < 2000 ? `${String(d).slice(2)}s` : `${d}s`);
  return h('div', { class: 'decades', role: 'img', 'aria-label': entries.map(([d, n]) => `${label(d)}: ${n}`).join(', ') },
    entries.map(([d, n]) => h('div', { class: 'col' },
      h('i', { style: { height: `${Math.max(6, (n / max) * 100)}%` } }), h('b', {}, String(n)), h('span', {}, label(d)))));
}

export function openFavoritePicker(ctx) {
  const { store } = ctx;
  const input = h('input', { class: 'input', id: 'fav-search', type: 'search', placeholder: 'Buscar en lo que ha visto', autocomplete: 'off' });
  const counter = h('p', { class: 'mono faint' });
  const grid = h('div', { class: 'grid' });
  const more = h('div');
  let limit = 120;
  const paint = () => {
    const q = normalizeTitle(input.value);
    const all = Object.values(store.getState().items).filter(it => !it.deleted && (isSeen(it) || it.favorite))
      .filter(it => !q || normalizeTitle(it.title).includes(q) || normalizeTitle(it.original).includes(q))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
    const favCount = Object.values(store.getState().items).filter(it => !it.deleted && it.favorite).length;
    counter.textContent = `${favCount} ${favCount === 1 ? 'FAVORITA' : 'FAVORITAS'}`;
    fill(grid, ...all.slice(0, limit).map(it => {
      const b = h('button', { class: `card pick-card${it.favorite ? ' on' : ''}`, type: 'button', 'aria-pressed': String(Boolean(it.favorite)), 'aria-label': `${it.title}: favorita` },
        h('div', { class: 'poster' }, posterImg(it, 'w342'), h('span', { class: 'heart' }, icon('heart'))),
        h('div', { class: 'title' }, it.title));
      b.addEventListener('click', () => {
        const on = !store.getItem(it.key).favorite;
        store.setFavorite(it, on);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        const n = Object.values(store.getState().items).filter(x => !x.deleted && x.favorite).length;
        counter.textContent = `${n} ${n === 1 ? 'FAVORITA' : 'FAVORITAS'}`;
      });
      return b;
    }));
    fill(more, all.length > limit ? h('button', { class: 'btn ghost', type: 'button', onClick: () => { limit += 120; paint(); } }, `Mostrar más (${all.length - limit})`) : null);
    if (!all.length) fill(grid, emptyState(q ? 'Nada con ese título' : 'Aún no hay nada visto', q ? '' : 'Marque primero lo que ha visto desde el Catálogo.'));
  };
  input.addEventListener('input', paint);
  openSheet(h('div', { class: 'sheet-inner' },
    h('div', { style: { display: 'grid', gap: '8px', paddingRight: '44px' } },
      h('p', { class: 'eyebrow' }, 'Sus favoritas'),
      h('h2', { class: 'h1' }, 'Elija las que le marcaron'),
      h('p', { class: 'lead' }, 'Toque el corazón de cada película o serie. Las cuatro primeras que elija encabezarán su perfil.')),
    input, counter, grid, more), { label: 'Elegir favoritas' });
  paint();
}

export function render(root, ctx) {
  const { store, library } = ctx;
  const page = h('div', { class: 'page' });
  root.append(page);
  let stage = null;
  let stageKey = '';
  let people = { keys: null, node: h('div') };

  function peopleSection(favs) {
    const keys = favs.map(f => f.key).join(',');
    if (people.keys === keys) return people.node;
    const node = h('div', { style: { display: 'grid', gap: '22px' } }, loading('Analizando el reparto de sus favoritas'));
    people = { keys, node };
    library.many(favs).then(cache => {
      if (people.keys !== keys) return;
      const { actors, directors } = topPeople(cache, favs.map(f => f.key));
      if (!actors.length) { fill(node, h('p', { class: 'muted' }, 'No he podido cargar el reparto. Compruebe la conexión y su clave de TMDB.')); return; }
      fill(node, 
        h('div', { class: 'cast-row' }, actors.map(a => {
          const first = a.roles[0];
          const [type, id] = first.key.split(':');
          return h('button', { class: 'cast-card', type: 'button', onClick: () => (a.id != null ? ctx.openPerson(a) : ctx.openDetail(type, Number(id))) },
            h('div', { class: 'ph tilt' }, personImg(a, 'w185'), a.count > 1 ? h('span', { class: 'times' }, `×${a.count}`) : null),
            h('b', {}, a.name),
            ...a.roles.slice(0, 2).map(r => h('span', {}, r.character ? `${r.character} · ${r.title}` : r.title)),
            a.roles.length > 2 ? h('span', { class: 'faint' }, `y ${a.roles.length - 2} más`) : null);
        })),
        directors.length ? h('div', { style: { display: 'grid', gap: '10px' } },
          h('p', { class: 'eyebrow' }, 'Dirección y creación de cabecera'),
          h('div', { class: 'directors' }, directors.map(d => h('button', { class: 'director', type: 'button', onClick: () => ctx.openPerson(d) }, d.name, d.count > 1 ? h('b', {}, ` ×${d.count}`) : null)))) : null);
    });
    return node;
  }

  function draw() {
    const items = store.getState().items;
    const favs = favoritesOf(items);
    const stats = computeStats(items);
    const since = memberSince(items);
    const seen = Object.values(items).filter(it => !it.deleted && isSeen(it));
    const backdrops = (favs.length ? favs : seen.slice(-20)).map(f => f.backdrop).filter(Boolean);
    const key = backdrops.join('|');
    if (!stage || key !== stageKey) { if (stage) stage.stop(); stage = projector(shuffle(backdrops).slice(0, 10)); stageKey = key; }
    const name = store.getState().settings.name || 'Cinéfilo sin nombre';
    const sinceText = since ? (d => `EN VISOR DESDE ${MONTHS[d.getMonth()].toUpperCase()} DE ${d.getFullYear()}`)(new Date(since)) : 'EXPEDIENTE NUEVO';
    const stat = (v, l) => h('div', {}, h('b', {}, String(v)), h('span', {}, l));
    const pickBtn = () => h('button', { class: 'btn', type: 'button', onClick: () => openFavoritePicker(ctx) }, icon('heart'), favs.length ? 'Editar favoritas' : 'Elegir favoritas');
    const genres = computeStats(items).topGenres;
    const decades = decadeCounts(items);
    const ev = ctx.trophies();
    const recent = ev.list.filter(t => t.unlocked).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 6);
    const next = nextTrophy(ev.list);

    fill(page, ...[
      h('section', { class: 'dossier' }, stage.node,
        h('div', { class: 'dossier-body' },
          h('p', { class: 'eyebrow' }, 'Expediente cinéfilo'),
          h('h1', { class: 'h1' }, name),
          h('p', { class: 'mono faint' }, sinceText),
          h('div', { class: 'dossier-stats' },
            stat(stats.movies, 'Películas'), stat(stats.tvCompleted, 'Series'), stat(Math.round(stats.minutes / 60), 'Horas'), stat(favs.length, 'Favoritas')))),

      h('section', { style: { display: 'grid', gap: '14px' } },
        h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Sus favoritas'), favs.length ? pickBtn() : null),
        favs.length
          ? h('div', { class: 'podium' }, favs.slice(0, 4).map((it, i) =>
              h('button', { class: 'podium-card tilt', type: 'button', onClick: () => ctx.openDetail(it.type, it.id), 'aria-label': `Número ${i + 1}: ${it.title}` },
                h('div', { class: 'podium-bg' }, it.backdrop ? h('img', { src: img(it.backdrop, 'w780'), alt: '', crossorigin: 'anonymous', loading: 'lazy' }) : null),
                h('div', { class: 'podium-poster' }, posterImg(it, 'w342')),
                h('div', { class: 'podium-info' },
                  h('span', { class: 'rank' }, String(i + 1).padStart(2, '0')),
                  h('b', {}, it.title),
                  h('span', { class: 'mono faint' }, `${it.year || '—'} · ${it.type === 'tv' ? 'SERIE' : 'PELI'}`)))))
          : emptyState('Aún no ha elegido favoritas', 'Elija las películas y series que le han marcado. Encabezarán su expediente y conoceremos a sus personajes.', pickBtn()),
        favs.length > 4 ? h('div', { class: 'filmstrip' }, h('div', { class: 'shelf' }, favs.slice(4).map(it =>
          h('button', { class: 'card', type: 'button', onClick: () => ctx.openDetail(it.type, it.id), 'aria-label': `Ficha de ${it.title}` },
            h('div', { class: 'poster tilt' }, posterImg(it, 'w342')),
            h('div', { class: 'title' }, it.title))))) : null),

      favs.length ? h('section', { style: { display: 'grid', gap: '14px' } },
        h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Personajes de sus favoritas')),
        peopleSection(favs)) : null,

      seen.length ? h('div', { class: 'split' },
        h('section', { class: 'frame', style: { display: 'grid', gap: '12px' } },
          h('h2', { class: 'h2' }, 'ADN cinéfilo'),
          genres.length >= 3 ? radar(genres) : h('p', { class: 'muted' }, 'Necesito al menos tres géneros para dibujar su ADN. Siga marcando lo que ha visto.')),
        h('section', { class: 'frame', style: { display: 'grid', gap: '12px' } },
          h('h2', { class: 'h2' }, 'Su línea del tiempo'),
          h('p', { class: 'muted', style: { fontSize: 'var(--t-sm)' } }, 'Lo que ha visto, por década de estreno.'),
          Object.keys(decades).length ? decadesChart(decades) : h('p', { class: 'muted' }, 'Sin datos todavía.'))) : null,

      h('section', { class: 'showcase frame' },
        h('div', { class: 'showcase-head' },
          h('button', { class: 'rank-emblem small', type: 'button', onClick: () => ctx.go('trofeos'), 'aria-label': 'Abrir la sala de trofeos' },
            medal({ unlocked: true, tier: ev.rank.level >= 7 ? 'platinum' : ev.rank.level >= 5 ? 'gold' : ev.rank.level >= 3 ? 'silver' : 'bronze', icon: 'crown', name: ev.rank.name, goal: 1, progress: 1 }, { size: 64, label: false })),
          h('div', { style: { display: 'grid', gap: '4px', minWidth: '0' } },
            h('p', { class: 'eyebrow' }, 'Sala de trofeos'),
            h('p', { class: 'rank-name' }, ev.rank.name),
            h('p', { class: 'mono', style: { color: 'var(--amber)', fontSize: 'var(--t-sm)' } }, `${ev.points} PUNTOS · ${ev.unlocked}/${ev.total} TROFEOS`),
            h('div', { class: 'progress rank-bar' }, h('i', { style: { width: `${Math.round(ev.rank.progress * 100)}%` } })))),
        recent.length ? h('div', { class: 'showcase-shelf' }, recent.map(t =>
          h('button', { class: 'showcase-medal', type: 'button', onClick: () => ctx.openTrophy(t.id), 'aria-label': `${t.name}, ${TIERS[t.tier].label}` }, medal(t, { size: 58, label: false }), h('span', {}, t.name))))
          : h('p', { class: 'muted' }, 'Aún no hay trofeos en su vitrina. El primero llega con la primera película.'),
        next ? h('button', { class: 'next-trophy', type: 'button', onClick: () => ctx.openTrophy(next.id) },
          medal(next, { size: 40, label: false }),
          h('span', { class: 'nt-body' }, h('span', { class: 'nt-eyebrow' }, 'Próximo trofeo'), h('b', {}, next.name), h('span', { class: 'nt-desc' }, next.desc)),
          h('span', { class: 'mono nt-count' }, `${next.progress}/${next.goal}`)) : null,
        h('div', {}, h('a', { class: 'btn solid', href: '#trofeos' }, icon('trophy'), 'Ver todos los trofeos'))),
    ].filter(Boolean));
  }

  draw();
  return { update: draw, destroy() { if (stage) stage.stop(); } };
}
