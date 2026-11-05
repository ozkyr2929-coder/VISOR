// Trophy art: a medal with a film-reel rim in its metal (bronze, silver, gold, platinum) and a glyph.
// Locked medals are dark with a progress arc; secret ones show a question mark until won.
const NS = 'http://www.w3.org/2000/svg';

// 24×24 line glyphs, drawn for VISOR.
const GLYPHS = {
  ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7.5v9" stroke-dasharray="1.6 1.8"/>',
  popcorn: '<path d="M6 10l1.6 11h8.8L18 10z"/><path d="M10 10.5l.6 10M14 10.5l-.6 10"/><path d="M6 10a2.6 2.6 0 0 1 1.2-4.6A3 3 0 0 1 12 4a3 3 0 0 1 4.8 1.4A2.6 2.6 0 0 1 18 10"/>',
  hourglass: '<path d="M7 3h10M7 21h10"/><path d="M8 3v2c0 3 4 4.2 4 7s-4 4-4 7v2M16 3v2c0 3-4 4.2-4 7s4 4 4 7v2"/><path d="M10 18.5h4"/>',
  tv: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 3l4 4 4-4M8 22h8"/>',
  masks: '<path d="M3 5c3 1.2 6 1.2 9 0v6a4.5 4.5 0 0 1-9 0z"/><path d="M12 9.5c3 1.2 6 1.2 9 0v6a4.5 4.5 0 0 1-9 0z"/><path d="M5.5 9h1M8.5 9h1M14.5 13.5h1M17.5 13.5h1M6 12.5c.8.8 2.2.8 3 0M15 18c.8-.8 2.2-.8 3 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  ring: '<circle cx="12" cy="14.5" r="6"/><circle cx="12" cy="14.5" r="3.6"/><path d="M9.5 6.5 12 3.5l2.5 3L12 8.6z"/>',
  reel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="7.2" r="2"/><circle cx="16.8" cy="12" r="2"/><circle cx="12" cy="16.8" r="2"/><circle cx="7.2" cy="12" r="2"/>',
  megaphone: '<path d="M4 10v4h3l8 4V6l-8 4z"/><path d="M7 14l1.5 5h2.5L10 15.5M18.5 9.2a4 4 0 0 1 0 5.6"/>',
  quill: '<path d="M20 4C13 5 8 10 7 17l-2 3.5"/><path d="M7.5 15c4 0 8-3 9.5-7.5M10.5 11h4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M8 13.5h2M12 13.5h2M16 13.5h.5M8 16.5h2M12 16.5h2"/>',
  star: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.6l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
  bookmark: '<path d="M6.5 3h11v18L12 16.8 6.5 21z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.4 3.1 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  skull: '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.6 5 4 6v3.5h8V17c2.4-1 4-3 4-6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11.5" r="1.7"/><circle cx="15" cy="11.5" r="1.7"/><path d="M10.5 20.5v-2M13.5 20.5v-2M12 14l-.8 1.6h1.6z"/>',
  laugh: '<circle cx="12" cy="12" r="9"/><path d="M7.5 13.5a4.5 4.5 0 0 0 9 0z"/><path d="M8 9.5c.6-.8 1.6-.8 2.2 0M13.8 9.5c.6-.8 1.6-.8 2.2 0"/>',
  rocket: '<path d="M12 2.5c3.2 2.2 5 6.5 4 11.5l-4 3-4-3c-1-5 .8-9.3 4-11.5z"/><circle cx="12" cy="9" r="1.6"/><path d="M8 14l-3 3 1 3.5 3-2.5M16 14l3 3-1 3.5-3-2.5M11 20l1 2 1-2"/>',
  brush: '<path d="M19 3l2 2-9 9-2-2z"/><path d="M10 12c-3 0-5 2-5 4.6 0 1-.8 2-2 2.4 2.6 2.2 7 1.6 8.6-.6.9-1.3 1.2-3 .4-4.4"/>',
  bolt: '<path d="M13 2L4.5 13.5h6.5L10 22l9-12h-6.5z"/>',
  fedora: '<path d="M2.5 16c4 2.2 15 2.2 19 0"/><path d="M5.5 15.5c0-4.5 1.3-8.5 3.5-8.5 1.2 0 2 .9 3 .9s1.8-.9 3-.9c2.2 0 3.5 4 3.5 8.5"/><path d="M6.2 12.8c3.6 1.2 8 1.2 11.6 0"/>',
  eye: '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  magnifier: '<circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6M7.5 9a2.8 2.8 0 0 1 2.5-1.8"/>',
  wand: '<path d="M4 20L15.5 8.5"/><path d="M18 2.5l.9 2.4 2.6.9-2.6.9L18 9.1l-.9-2.4-2.6-.9 2.6-.9z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21"/>',
  cactus: '<path d="M10 21V6a2 2 0 0 1 4 0v15M10 14H8a2 2 0 0 1-2-2V9M14 12h2a2 2 0 0 0 2-2V7.5M5.5 21h13"/>',
  helmet: '<path d="M4 15.5a8 8 0 0 1 16 0V17H4z"/><path d="M2 17h20M12 7.5V6M8 10c1-1.2 2.4-1.8 4-1.8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  note: '<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1.5h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11M9 9h4M9 12.5h4"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
  saber: '<path d="M7.5 16.5L20 4" stroke-width="2.4"/><path d="M3.5 20.5l3-3M5 15.5l3.5 3.5"/>',
  rose: '<path d="M12 4c2.5 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.5-4 4-4z"/><path d="M10 6.5c1 1.5 3 1.5 4 0M12 12v9M12 16.5c-1.5-2-3.6-2.2-5-1.2M12 18.5c1.5-2 3.6-2.2 5-1.2"/>',
  pill: '<path d="M9.2 18.8l9.6-9.6a3.6 3.6 0 0 0-5-5.1L4.1 13.7a3.6 3.6 0 0 0 5.1 5.1z"/><path d="M8.9 8.9l6.2 6.2"/>',
  bat: '<path d="M12 9.5l1.4-2.2.6 2.3c2.4-1.2 5.4-1 8 1.4-2 0-3 1.8-3 3.8-1.2-.9-3-.9-4 .2-.2-1.2-1.4-2-3-2s-2.8.8-3 2c-1-1.1-2.8-1.1-4-.2 0-2-1-3.8-3-3.8 2.6-2.4 5.6-2.6 8-1.4l.6-2.3z"/>',
  sun: '<path d="M5 16a7 7 0 0 1 14 0"/><path d="M2 19.5h20M12 4.5v3M5.2 8.2l2 2M18.8 8.2l-2 2M2.5 15.5H4M20 15.5h1.5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-1.4-1.2-2 0-3.2.9-.9 2.2-.3 3.3-.3A3.7 3.7 0 0 0 21 11.8C21 6.9 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10" cy="7.5" r="1.2"/><circle cx="15" cy="7.8" r="1.2"/>',
  egg: '<path d="M12 3c-4 0-7 7-7 11a7 7 0 0 0 14 0c0-4-3-11-7-11z"/><path d="M8 13.5l2 2 2-2 2 2 2-2"/>',
  katana: '<path d="M4 20l2.2-2.2M4.6 16.8l2.6 2.6"/><path d="M7.5 16.5C11 13 16 8.5 20.5 3.5c-.5 4-3.5 8-9 11.5"/>',
  pencil: '<path d="M4 20l1.2-4.8L16 4.4l3.6 3.6L8.8 18.8z"/><path d="M14 6.4l3.6 3.6"/>',
  tomato: '<circle cx="12" cy="13.5" r="7.5"/><path d="M8.5 5.5l3.5 2.5 3.5-2.5M12 8V3.5"/>',
  clapper: '<rect x="3" y="10" width="18" height="11" rx="1.2"/><path d="M3 10l1.6-5.6 16 2.4L20 10"/><path d="M8.6 5.2 7 10M13.6 6l-1.6 4M18.4 6.6 17.2 10"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.8 4.6 12 6.6l2.2-2M9.8 19.4l2.2-2 2.2 2"/>',
  wave: '<path d="M2 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M8.5 13.5c1-4.2 3.3-7.2 7.5-8.2-1 3.2-1 6.2.2 8.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/>',
  crown: '<path d="M3 8l4.5 4.5L12 5l4.5 7.5L21 8l-2 11H5z"/><path d="M5 21.5h14"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10.5h14V9M10 13h4"/>',
};

const TIER_COLORS = {
  bronze: ['#ffd0a4', '#d98a4e', '#7c3d17', '#3b1a06'],
  silver: ['#ffffff', '#d3dee6', '#7d909e', '#1d2a34'],
  gold: ['#fff4c4', '#ffd25e', '#b97a0c', '#3a2400'],
  platinum: ['#ffffff', '#a8f2ff', '#8f7dff', '#14183a'],
};

// One hidden <svg> with the gradients, shared by every medal on the page.
function ensureDefs() {
  if (document.getElementById('vt-defs')) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', 'vt-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = '<defs>' + Object.entries(TIER_COLORS).map(([t, [a, b, c]]) =>
    `<linearGradient id="vt-${t}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
    + `<linearGradient id="vt-${t}-rim" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${a}"/></linearGradient>`).join('')
    + '<radialGradient id="vt-shine" cx=".35" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="vt-locked" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14304a"/><stop offset="1" stop-color="#050e1a"/></linearGradient>'
    + '</defs>';
  document.body.append(svg);
}

const holes = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return `<circle cx="${(50 + 41 * Math.cos(a)).toFixed(2)}" cy="${(50 + 41 * Math.sin(a)).toFixed(2)}" r="2.6"/>`;
}).join('');

export function glyph(name) { return GLYPHS[name] || GLYPHS.star; }

// `t` = a trophy from evaluateTrophies. Returns an <svg>.
export function medal(t, { size = 64, label = true } = {}) {
  ensureDefs();
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  const won = t.unlocked;
  const hidden = t.secret && !won;
  svg.setAttribute('class', `medal ${won ? `won tier-${t.tier}` : 'locked'}${hidden ? ' secret' : ''}`);
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', hidden ? 'Trofeo secreto' : `${t.name}${won ? ', conseguido' : ', por conseguir'}`); }
  else svg.setAttribute('aria-hidden', 'true');
  const ratio = t.goal ? Math.min(1, t.progress / t.goal) : 0;
  const C = 2 * Math.PI * 47;
  const inner = hidden
    ? '<text x="50" y="61" text-anchor="middle" class="m-q">?</text>'
    : `<g class="m-glyph" transform="translate(29 29) scale(1.75)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">${glyph(t.icon)}</g>`;
  svg.innerHTML = won
    ? `<circle cx="50" cy="50" r="47" fill="url(#vt-${t.tier}-rim)"/>`
      + `<g class="m-holes">${holes}</g>`
      + `<circle cx="50" cy="50" r="35" fill="url(#vt-${t.tier})" class="m-face"/>`
      + `<circle cx="50" cy="50" r="35" fill="none" class="m-edge"/>`
      + inner
      + '<circle cx="50" cy="50" r="35" fill="url(#vt-shine)" class="m-shine"/>'
    : '<circle cx="50" cy="50" r="47" class="m-track"/>'
      + `<circle cx="50" cy="50" r="47" class="m-arc" stroke-dasharray="${(C * ratio).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>`
      + `<g class="m-holes">${holes}</g>`
      + '<circle cx="50" cy="50" r="35" fill="url(#vt-locked)" class="m-face"/>'
      + inner;
  return svg;
}
