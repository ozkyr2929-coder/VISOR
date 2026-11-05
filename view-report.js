// Informe: totals, month (or year) chart, rating spread and favourite genres.
import { h, emptyState, MONTHS_SHORT, fill } from './ui.js';
import { computeStats, diaryEntries, formatMinutes } from './model.js';
import { genreName } from './genres.js';

const NS = 'http://www.w3.org/2000/svg';
let selected = new Date().getFullYear();

function barChart(labels, values, { height = 180 } = {}) {
  const w = 640, padL = 28, padB = 26, padT = 18;
  const max = Math.max(1, ...values);
  const step = (w - padL) / values.length;
  const bw = Math.min(34, step * 0.62);
  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const y = v => padT + (height - padT - padB) * (1 - v / max);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${height}`);
  svg.setAttribute('class', 'bars');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', labels.map((l, i) => `${l}: ${values[i]}`).join(', '));
  svg.innerHTML = [
    ...ticks.map(t => `<line x1="${padL}" x2="${w}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`),
    ...values.map((v, i) => {
      const x = padL + step * i + (step - bw) / 2;
      const top = y(v);
      return `<rect class="track" x="${x}" y="${padT}" width="${bw}" height="${height - padT - padB}" rx="2"/>`
        + (v ? `<rect class="bar" x="${x}" y="${top}" width="${bw}" height="${height - padB - top}" rx="2"/><text class="v" x="${x + bw / 2}" y="${top - 5}" text-anchor="middle">${v}</text>` : '')
        + `<text x="${x + bw / 2}" y="${height - 8}" text-anchor="middle">${labels[i]}</text>`;
    }),
  ].join('');
  return h('div', { style: { overflowX: 'auto' } }, svg);
}

function hbars(rows) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return h('div', { class: 'hbars' }, rows.map(r => h('div', { class: 'hbar' },
    h('span', {}, r.label), h('div', { class: 'track' }, h('i', { style: { width: `${(r.n / max) * 100}%` } })), h('span', { class: 'n' }, String(r.n)))));
}

const tile = (value, label) => h('div', { class: 'frame quiet readout', style: { padding: '14px 16px', borderLeft: '2px solid var(--arc)' } }, h('b', {}, value), h('span', {}, label));

export function render(root, ctx) {
  const page = h('div', { class: 'page' });
  root.append(page);

  function draw() {
    const items = ctx.store.getState().items;
    const entries = diaryEntries(items);
    const years = [...new Set(entries.map(e => Number(e.date.slice(0, 4))))].sort((a, b) => b - a);
    const thisYear = new Date().getFullYear();
    if (!years.includes(thisYear)) years.unshift(thisYear);
    if (selected !== 'all' && !years.includes(selected)) selected = thisYear;
    const s = computeStats(items, selected === 'all' ? {} : { year: selected });
    const any = s.movies + s.seasons + s.tvCompleted > 0;

    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Periodo' },
      [...years.map(y => [y, String(y)]), ['all', 'Todo']].map(([v, l]) =>
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(selected === v), onClick: () => { selected = v; draw(); } }, l)));

    let chart;
    if (selected === 'all') {
      const ys = [...years].sort((a, b) => a - b).slice(-10);
      chart = barChart(ys.map(String), ys.map(y => entries.filter(e => e.date.startsWith(String(y))).length));
    } else chart = barChart(MONTHS_SHORT, s.byMonth);

    const steps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    const rated = steps.reduce((n, r) => n + (s.ratingDist[String(r)] || 0), 0);

    fill(page, 
      h('header', { style: { display: 'grid', gap: '10px' } },
        h('p', { class: 'eyebrow' }, 'Informe'),
        h('h1', { class: 'h1' }, selected === 'all' ? 'Todo su historial' : `Informe de ${selected}`),
        chips),
      any ? h('div', { class: 'stat-grid' },
        tile(String(s.movies), 'Películas'), tile(String(s.seasons), 'Temporadas'), tile(String(s.tvCompleted), 'Series terminadas'),
        tile(formatMinutes(s.minutes).replace(/ \d+ min$/, ''), 'Tiempo'), tile(s.avgRating != null ? `${String(s.avgRating).replace('.', ',')}★` : '—', 'Nota media'))
        : emptyState('Sin datos en este periodo', selected === 'all' ? 'Marque lo que ha visto para empezar su informe.' : 'Los visionados con fecha de este año aparecerán aquí.', h('a', { class: 'btn solid', href: '#catalogo' }, 'Ir al Catálogo')),
      h('section', { class: 'frame', style: { display: 'grid', gap: '12px' } },
        h('h2', { class: 'h2' }, selected === 'all' ? 'Visionados por año' : 'Visionados por mes'),
        chart,
        h('p', { class: 'faint', style: { fontSize: 'var(--t-xs)' } }, 'Cuenta pelis y temporadas con fecha. Lo marcado en bloque solo suma en los totales de «Todo».')),
      h('div', { class: 'split' },
        h('section', { class: 'frame', style: { display: 'grid', gap: '12px' } },
          h('h2', { class: 'h2' }, 'Sus notas'),
          rated ? hbars(steps.slice().reverse().map(r => ({ label: `${'★'.repeat(Math.floor(r))}${r % 1 ? '½' : ''}`, n: s.ratingDist[String(r)] || 0 })))
            : h('p', { class: 'muted' }, 'Aún no ha puntuado nada en este periodo.')),
        h('section', { class: 'frame', style: { display: 'grid', gap: '12px' } },
          h('h2', { class: 'h2' }, 'Géneros favoritos'),
          s.topGenres.length ? hbars(s.topGenres.map(g => ({ label: genreName(g.id), n: g.count }))) : h('p', { class: 'muted' }, 'Sin datos todavía.'))),
    );
  }

  draw();
  return { update: draw };
}
