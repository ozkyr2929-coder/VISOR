// Ficha de persona: photo, life, and the filmography as posters to mark with one tap.
import { h, openSheet, personImg, posterCard, setCardWatched, loading, errorText, formatDate, fill } from './ui.js';

const DEPT = { Acting: 'Interpretación', Directing: 'Dirección', Writing: 'Guion', Production: 'Producción', Sound: 'Música',
  Camera: 'Fotografía', Editing: 'Montaje', Art: 'Dirección artística', 'Visual Effects': 'Efectos visuales', Creator: 'Creación' };
const PAGE = 48;

// `person` = { id?, name, photo? }. Without an id (older data) it is looked up by name.
export function openPerson(ctx, person) {
  const { tmdb, store } = ctx;
  const inner = h('div', { class: 'sheet-inner person-sheet' });
  const unsubs = [];
  openSheet(inner, { label: person.name || 'Persona', onClose: () => unsubs.forEach(u => u()) });
  const header = data => h('div', { class: 'person-head' },
    h('div', { class: 'person-photo' }, personImg({ name: data.name, photo: data.photo }, 'w185')),
    h('div', { style: { display: 'grid', gap: '6px', minWidth: '0', paddingRight: '44px' } },
      h('p', { class: 'eyebrow' }, DEPT[data.dept] || data.dept || 'Persona'),
      h('h2', { class: 'h1' }, data.name),
      data.birthday || data.place ? h('p', { class: 'muted', style: { fontSize: 'var(--t-sm)' } },
        [data.birthday ? `${data.deathday ? '' : 'Nació el '}${formatDate(data.birthday)}${data.deathday ? ` – ${formatDate(data.deathday)}` : ''}` : null, data.place].filter(Boolean).join(' · ')) : null));
  fill(inner, header({ name: person.name, photo: person.photo }), loading('Reuniendo su filmografía'));

  (async () => {
    let id = person.id;
    if (id == null) {
      const hit = await tmdb.findPerson(person.name).catch(() => null);
      if (!hit) { fill(inner, header(person), h('p', { class: 'muted' }, 'No he encontrado a esta persona en TMDB.')); return; }
      id = hit.id;
    }
    let data;
    try { data = await tmdb.person(id); }
    catch (e) { fill(inner, header(person), h('p', { class: 'status-line err' }, errorText(e))); return; }

    const isSeen = m => { const it = store.getItem(`${m.type}:${m.id}`); return Boolean(it && (it.status === 'watched' || it.status === 'completed')); };
    const tabs = [];
    if (data.directed.length) tabs.push({ id: 'directed', label: data.directed.some(x => x.job === 'Director') ? 'Como director/a' : 'Como creador/a', list: data.directed });
    if (data.acted.length) tabs.push({ id: 'acted', label: 'Como intérprete', list: data.acted });
    if (!tabs.length) { fill(inner, header(data), h('p', { class: 'muted' }, 'TMDB no tiene películas ni series de esta persona.')); return; }
    if (data.dept === 'Acting') tabs.sort((a, b) => (a.id === 'acted' ? -1 : 1) - (b.id === 'acted' ? -1 : 1));
    let tab = tabs[0], limit = PAGE, bioOpen = false;

    const tally = h('p', { class: 'mono person-tally' });
    const grid = h('div', { class: 'grid' });
    const more = h('div');
    const tabBar = h('div', { class: 'tabs', role: 'tablist' });
    const bio = data.bio ? h('p', { class: 'lead person-bio' }, data.bio) : null;
    const bioBtn = data.bio && data.bio.length > 320 ? h('button', { class: 'link', type: 'button', onClick: () => { bioOpen = !bioOpen; bio.classList.toggle('open', bioOpen); bioBtn.textContent = bioOpen ? 'Leer menos' : 'Leer más'; } }, 'Leer más') : null;

    const paintTally = () => {
      const all = [...new Map([...data.directed, ...data.acted].map(m => [`${m.type}:${m.id}`, m])).values()];
      const seen = all.filter(isSeen).length;
      tally.textContent = `HA VISTO ${seen} DE ${all.length} TÍTULOS`;
    };
    const paint = () => {
      fill(tabBar, ...tabs.map(t => h('button', { type: 'button', role: 'tab', 'aria-selected': String(t === tab),
        onClick: () => { tab = t; limit = PAGE; paint(); } }, `${t.label} · ${t.list.length}`)));
      fill(grid, ...tab.list.slice(0, limit).map(m => {
        const card = posterCard(m, { watched: isSeen(m), showType: true,
          onTap: c => { const r = ctx.toggleSeen(m); setCardWatched(c, r.seen); paintTally(); },
          onInfo: x => ctx.openDetail(x.type, x.id) });
        if (tab.id === 'acted' && m.character) card.querySelector('.sub').textContent = `${m.year || '—'} · ${m.character}`;
        return card;
      }));
      fill(more, tab.list.length > limit ? h('button', { class: 'btn ghost', type: 'button', onClick: () => { limit += PAGE; paint(); } }, `Mostrar más (${tab.list.length - limit})`) : null);
      paintTally();
    };
    unsubs.push(store.subscribe(() => queueMicrotask(paintTally)));
    fill(inner, header(data), bio, bioBtn, tally,
      h('p', { class: 'muted', style: { fontSize: 'var(--t-sm)' } }, 'Toque una carátula para marcarla como vista. La «i» abre su ficha.'),
      tabBar, grid, more);
    paint();
  })();
}
