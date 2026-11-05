// Inicio: greeting, this year's count, series in progress, watchlist and latest entries.
import { h, icon, posterImg, starsLabel, MONTHS_SHORT } from './ui.js';
import { computeStats, diaryEntries, greeting, nextSeason, todayISO } from './model.js';

const NS = 'http://www.w3.org/2000/svg';
function reactor() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('aria-hidden', 'true');
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2, r1 = 92, r2 = i % 5 ? 88 : 84;
    return `<line x1="${100 + r1 * Math.cos(a)}" y1="${100 + r1 * Math.sin(a)}" x2="${100 + r2 * Math.cos(a)}" y2="${100 + r2 * Math.sin(a)}"/>`;
  }).join('');
  svg.innerHTML = `
    <defs><radialGradient id="rg"><stop offset="0" stop-color="#63e3ff" stop-opacity=".28"/><stop offset="1" stop-color="#63e3ff" stop-opacity="0"/></radialGradient></defs>
    <circle cx="100" cy="100" r="70" fill="url(#rg)"/>
    <g class="spin-a" stroke="#63e3ff" stroke-opacity=".55" stroke-width="1">${ticks}</g>
    <circle cx="100" cy="100" r="97" fill="none" stroke="#63e3ff" stroke-opacity=".18"/>
    <g class="spin-b"><circle cx="100" cy="100" r="76" fill="none" stroke="#2bb2e6" stroke-width="3" stroke-dasharray="58 22" stroke-linecap="round"/></g>
    <circle cx="100" cy="100" r="66" fill="none" stroke="#63e3ff" stroke-opacity=".35" stroke-dasharray="1 4"/>`;
  return svg;
}

function row(ctx, it, { right, meta }) {
  return h('div', { class: 'row' },
    h('div', { class: 'thumb' }, posterImg(it, 'w92')),
    h('div', { class: 'body' },
      h('button', { class: 'name', type: 'button', onClick: () => ctx.openDetail(it.type, it.id) }, it.title),
      h('div', { class: 'meta' }, meta)),
    right || null);
}

export function render(root, ctx) {
  const page = h('div', { class: 'page' });
  root.append(page);

  function draw() {
    const { store } = ctx;
    const items = store.getState().items;
    const live = Object.values(items).filter(i => !i.deleted);
    const year = new Date().getFullYear();
    const all = computeStats(items);
    const now = computeStats(items, { year });
    const watching = live.filter(i => i.type === 'tv' && i.status === 'watching');
    const watchlist = live.filter(i => i.status === 'watchlist').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const latest = diaryEntries(items).slice(0, 6);
    const hasKey = Boolean(store.getState().settings.tmdbKey);
    const thisYear = now.movies + now.seasons;

    const status = live.length
      ? `Registro activo: ${live.length} títulos. ${watching.length ? `${watching.length} ${watching.length === 1 ? 'serie' : 'series'} en curso` : 'Ninguna serie en curso'} y ${watchlist.length} ${watchlist.length === 1 ? 'pendiente' : 'pendientes'}.`
      : 'Su registro está vacío. Empecemos por lo que ya ha visto.';

    page.replaceChildren(...[
      h('section', { class: 'home-hero' },
        h('div', { class: 'reactor' }, reactor(),
          h('div', { class: 'reactor-core' }, h('b', {}, String(thisYear)), h('span', {}, `Vistas ${year}`))),
        h('div', { style: { display: 'grid', gap: '18px' } },
          h('div', { style: { display: 'grid', gap: '8px' } },
            h('p', { class: 'eyebrow' }, 'Sistemas en línea'),
            h('h1', { class: 'h1' }, `${greeting()}, ${ctx.name()}.`),
            h('p', { class: 'lead' }, status)),
          h('div', { class: 'readouts' },
            h('div', { class: 'readout' }, h('b', {}, String(all.movies)), h('span', {}, 'Películas')),
            h('div', { class: 'readout' }, h('b', {}, String(all.seasons)), h('span', {}, 'Temporadas')),
            h('div', { class: 'readout' }, h('b', {}, String(Math.round(all.minutes / 60))), h('span', {}, 'Horas'))))),

      !hasKey ? h('section', { class: 'frame callout' },
        h('p', { class: 'eyebrow' }, 'Configuración pendiente'),
        h('p', { class: 'h3' }, 'Conecte el catálogo de TMDB'),
        h('p', { class: 'muted' }, 'Con su clave gratuita de TMDB tendrá todas las pelis y series en español, con carátulas y plataformas.'),
        h('div', { class: 'btn-row' }, h('a', { class: 'btn solid', href: '#ajustes' }, 'Ir a Ajustes'))) : null,

      live.length < 20 ? h('section', { class: 'frame callout' },
        h('p', { class: 'eyebrow' }, 'Protocolo de puesta al día'),
        h('p', { class: 'h3' }, 'Marque de golpe todo lo que ya ha visto'),
        h('p', { class: 'muted' }, 'Recorra las imprescindibles, las décadas o las sagas y toque cada carátula que haya visto. También puede escribir o dictar una lista de títulos.'),
        h('div', { class: 'btn-row' }, h('a', { class: 'btn solid', href: '#catalogo' }, icon('grid'), 'Ponerme al día'))) : null,

      watching.length ? h('section', {},
        h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Series en curso')),
        h('div', { class: 'rows' }, watching.map(it => {
          const n = nextSeason(it);
          const total = (it.seasons || []).filter(s => s.n > 0).length;
          const done = Object.keys(it.seen || {}).length;
          return row(ctx, it, {
            meta: [n ? `Le toca: temporada ${n}` : 'Al día', total ? ` · ${done}/${total}` : ''].join(''),
            right: n ? h('button', { class: 'btn small', type: 'button', 'aria-label': `Marcar temporada ${n} de ${it.title} como vista`,
              onClick: () => { ctx.store.setSeasonSeen(it, n, todayISO()); ctx.toast(`Temporada ${n} de ${it.title} registrada.`); } }, icon('check'), `T${n}`) : null,
          });
        }))) : null,

      watchlist.length ? h('section', {},
        h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Pendientes'), h('a', { class: 'link', href: '#archivo' }, 'Ver todo')),
        h('div', { class: 'shelf' }, watchlist.slice(0, 20).map(it =>
          h('button', { class: 'card', type: 'button', onClick: () => ctx.openDetail(it.type, it.id), 'aria-label': `Ficha de ${it.title}` },
            h('div', { class: 'poster' }, posterImg(it, 'w342')),
            h('div', { class: 'title' }, it.title),
            h('div', { class: 'sub' }, `${it.year || '—'} · ${it.type === 'tv' ? 'SERIE' : 'PELI'}`))))) : null,

      latest.length ? h('section', {},
        h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Últimos registros'), h('a', { class: 'link', href: '#archivo' }, 'Diario completo')),
        h('div', { class: 'rows' }, latest.map(e => {
          const it = items[e.key];
          const [, m, d] = e.date.split('-').map(Number);
          return h('div', { class: 'row' },
            h('div', { class: 'day' }, h('b', {}, String(d)), h('span', {}, MONTHS_SHORT[m - 1])),
            h('div', { class: 'thumb' }, posterImg(it, 'w92')),
            h('div', { class: 'body' },
              h('button', { class: 'name', type: 'button', onClick: () => ctx.openDetail(it.type, it.id) }, it.title),
              h('div', { class: 'meta' }, e.kind === 'season' ? `Temporada ${e.season}` : `Película · ${it.year || '—'}`)),
            starsLabel(e.rating));
        }))) : null,
    ].filter(Boolean));
  }

  draw();
  return { update: draw };
}
