// Sala de trofeos: some 200 cinema-themed trophies in 13 rooms, worked out from the log.
// Pure logic (no DOM, no network). Film, saga and director ids are TMDB ids checked on themoviedb.org.
import { normalizeTitle } from './model.js';

export const TIERS = {
  bronze: { label: 'Bronce', points: 10 },
  silver: { label: 'Plata', points: 25 },
  gold: { label: 'Oro', points: 50 },
  platinum: { label: 'Platino', points: 100 },
};

export const RANKS = [
  [0, 'Espectador'], [100, 'Acomodador'], [300, 'Taquillero'], [600, 'Proyeccionista'],
  [1000, 'Crítico'], [1600, 'Cinéfilo'], [2400, 'Director de culto'], [3500, 'Leyenda del cine'],
];

export const ROOMS = [
  { id: 'taquilla', label: 'Taquilla', icon: 'ticket', blurb: 'Películas vistas.' },
  { id: 'maraton', label: 'Maratón', icon: 'hourglass', blurb: 'Horas delante de la pantalla.' },
  { id: 'series', label: 'Series', icon: 'tv', blurb: 'Temporadas y series terminadas.' },
  { id: 'generos', label: 'Géneros', icon: 'masks', blurb: 'Un trofeo para cada tipo de cine.' },
  { id: 'tiempo', label: 'Viaje en el tiempo', icon: 'clock', blurb: 'Cine de todas las épocas.' },
  { id: 'sagas', label: 'Sagas', icon: 'ring', blurb: 'Sagas completas, de la primera a la última.' },
  { id: 'filmoteca', label: 'Filmoteca esencial', icon: 'reel', blurb: 'Las películas que hay que ver una vez en la vida.' },
  { id: 'autores', label: 'Autores', icon: 'megaphone', blurb: 'Directores y caras que se repiten en su registro.' },
  { id: 'critica', label: 'Crítica', icon: 'quill', blurb: 'Notas y reseñas.' },
  { id: 'habitos', label: 'Hábitos', icon: 'calendar', blurb: 'Rachas, maratones y relecturas.' },
  { id: 'fechas', label: 'Fechas señaladas', icon: 'star', blurb: 'Cine en los días que tocan.' },
  { id: 'coleccion', label: 'Colección', icon: 'bookmark', blurb: 'Pendientes, favoritas y archivo.' },
  { id: 'secretos', label: 'Secretos', icon: 'lock', blurb: 'Nadie sabe cómo se consiguen… hasta que pasan.' },
];

// ---------- Reference lists ----------

// [id, tier, glyph, name, what to watch, film ids, TMDB collections that hold them]
const SAGAS = [
  ['lotr', 'gold', 'ring', 'Portador del Anillo', 'la trilogía de El Señor de los Anillos', [120, 121, 122], [119]],
  ['tierra-media', 'platinum', 'ring', 'Tierra Media completa', 'El Señor de los Anillos y El Hobbit', [120, 121, 122, 49051, 57158, 122917], [119, 121938]],
  ['sw-original', 'gold', 'saber', 'Que la Fuerza le acompañe', 'la trilogía original de Star Wars', [11, 1891, 1892], [10]],
  ['sw-skywalker', 'platinum', 'saber', 'Saga Skywalker', 'los nueve episodios de Star Wars', [11, 1891, 1892, 1893, 1894, 1895, 140607, 181808, 181812], [10]],
  ['padrino', 'gold', 'rose', 'Familia Corleone', 'la trilogía de El Padrino', [238, 240, 242], [230]],
  ['futuro', 'silver', 'bolt', '88 millas por hora', 'la trilogía de Regreso al futuro', [105, 165, 196], [264]],
  ['matrix', 'silver', 'pill', 'La píldora roja', 'la trilogía original de Matrix', [603, 604, 605], [2344]],
  ['gotham', 'silver', 'bat', 'Caballero de Gotham', 'la trilogía de El caballero oscuro', [272, 155, 49026], [263]],
  ['potter', 'gold', 'wand', 'Travesura realizada', 'las ocho películas de Harry Potter', [671, 672, 673, 674, 675, 767, 12444, 12445], [1241]],
  ['toy', 'silver', 'rocket', 'Hasta el infinito', 'las cuatro Toy Story', [862, 863, 10193, 301528], [10194]],
  ['indy', 'silver', 'fedora', 'Fortuna y gloria', 'la trilogía clásica de Indiana Jones', [85, 87, 89], [84]],
  ['amanecer', 'silver', 'sun', 'Tres amaneceres', 'Antes del amanecer, Antes del atardecer y Antes del anochecer', [76, 80, 132344], [123800]],
  ['colores', 'gold', 'palette', 'Azul, blanco y rojo', 'la trilogía Tres colores de Kieślowski', [108, 109, 110], [131]],
  ['dolar', 'gold', 'cactus', 'El hombre sin nombre', 'la trilogía del dólar de Sergio Leone', [391, 938, 429], []],
  ['piratas', 'bronze', 'skull', 'Bajo bandera pirata', 'la trilogía original de Piratas del Caribe', [22, 58, 285], [295]],
  ['terminator', 'bronze', 'eye', 'Volveré', 'Terminator y Terminator 2', [218, 280], [528]],
  ['alien', 'silver', 'egg', 'Octavo pasajero', 'Alien y Aliens', [348, 679], [8091]],
  ['kill-bill', 'bronze', 'katana', 'La novia', 'los dos volúmenes de Kill Bill', [24, 393], [2883]],
  ['jurassic', 'bronze', 'egg', 'Bienvenidos al parque', 'la trilogía de Jurassic Park', [329, 330, 331], [328]],
  ['wick', 'silver', 'pencil', 'Baba Yaga', 'los cuatro capítulos de John Wick', [245891, 324552, 458156, 603692], [404609]],
];

// [TMDB id, Spanish title, year, trophy name]
const CANON = [
  [15, 'Ciudadano Kane', 1941, 'Rosebud'], [62, '2001: Una odisea del espacio', 1968, 'Monolito'],
  [539, 'Psicosis', 1960, 'Motel Bates'], [289, 'Casablanca', 1942, 'Siempre nos quedará París'],
  [426, 'Vértigo', 1958, 'Espiral'], [346, 'Los siete samuráis', 1954, 'Siete espadas'],
  [680, 'Pulp Fiction', 1994, 'Royale con queso'], [872, 'Cantando bajo la lluvia', 1952, 'Paraguas abierto'],
  [103, 'Taxi Driver', 1976, '¿Hablas conmigo?'], [947, 'Lawrence de Arabia', 1962, 'Mar de arena'],
  [129, 'El viaje de Chihiro', 2001, 'Casa de baños'], [278, 'Cadena perpetua', 1994, 'Esperanza'],
  [19, 'Metrópolis', 1927, 'Ciudad máquina'], [630, 'El mago de Oz', 1939, 'Baldosas amarillas'],
  [694, 'El resplandor', 1980, 'Habitación 237'], [78, 'Blade Runner', 1982, 'Lágrimas en la lluvia'],
  [578, 'Tiburón', 1975, 'Un barco más grande'], [601, 'E.T., el extraterrestre', 1982, 'Mi casa'],
  [496243, 'Parásitos', 2019, 'El sótano'], [3082, 'Tiempos modernos', 1936, 'Engranajes'],
  [1417, 'El laberinto del fauno', 2006, 'El fauno'], [11216, 'Cinema Paradiso', 1988, 'Sala de proyección'],
  [389, '12 hombres sin piedad', 1957, 'Duda razonable'], [1585, 'Qué bello es vivir', 1946, 'Ángel de segunda clase'],
  [424, 'La lista de Schindler', 1993, 'Abrigo rojo'], [185, 'La naranja mecánica', 1971, 'Ultraviolencia'],
  [935, '¿Teléfono rojo? Volamos hacia Moscú', 1964, 'Sala de guerra'], [567, 'La ventana indiscreta', 1954, 'Vecino curioso'],
  [843, 'Deseando amar', 2000, 'Amor a cámara lenta'], [4495, 'El espíritu de la colmena', 1973, 'Colmena'],
];

// [TMDB person id, name, trophy name]
const DIRECTORS = [
  [2636, 'Alfred Hitchcock', 'Maestro del suspense'], [240, 'Stanley Kubrick', 'Perfeccionista'],
  [488, 'Steven Spielberg', 'Niño eterno'], [138, 'Quentin Tarantino', 'Capítulo uno'],
  [525, 'Christopher Nolan', 'Tiempo invertido'], [1032, 'Martin Scorsese', 'Calles peligrosas'],
  [309, 'Pedro Almodóvar', 'Chica Almodóvar'], [608, 'Hayao Miyazaki', 'Espíritu Ghibli'],
  [5026, 'Akira Kurosawa', 'Emperador'], [7467, 'David Fincher', 'Primera regla'],
  [137427, 'Denis Villeneuve', 'Llegada'], [5655, 'Wes Anderson', 'Simetría perfecta'],
  [1776, 'Francis Ford Coppola', 'Apocalipsis'], [510, 'Tim Burton', 'Extraño mundo'],
  [793, 'Luis Buñuel', 'Perro andaluz'], [6648, 'Ingmar Bergman', 'Partida con la muerte'],
  [4415, 'Federico Fellini', 'Dolce vita'], [5602, 'David Lynch', 'Habitación roja'],
  [4385, 'Sergio Leone', 'Duelo al sol'], [3146, 'Billy Wilder', 'Nadie es perfecto'],
  [13848, 'Charles Chaplin', 'Vagabundo'], [10828, 'Guillermo del Toro', 'Monstruos tiernos'],
  [21684, 'Bong Joon Ho', 'Clase aparte'], [19840, 'Alejandro Amenábar', 'Otros mundos'],
  [2710, 'James Cameron', 'Rey del mundo'], [578, 'Ridley Scott', 'Fuerza y honor'],
];

// [genre id, glyph, ten-film name, fifty-film name or null, threshold for the single tier]
const GENRES = [
  [27, 'skull', 'Sobrevivió a la noche', 'Rey del grito', 'del terror'],
  [35, 'laugh', 'Risa contagiosa', 'Maestro del gag', 'de comedia'],
  [878, 'rocket', 'Viajero estelar', 'Más allá del hiperespacio', 'de ciencia ficción'],
  [16, 'brush', 'Fotograma a fotograma', 'Alma animada', 'de animación'],
  [18, 'masks', 'Pañuelo en mano', 'Gran drama', 'dramas'],
  [28, 'bolt', 'Adrenalina pura', 'Héroe de acción', 'de acción'],
];
const GENRES_ONE = [
  [10749, 'heart', 'Flechazo en pantalla', 'románticas', 10], [80, 'fedora', 'Bajos fondos', 'de crimen', 10],
  [53, 'eye', 'Al borde del asiento', 'de suspense', 10], [9648, 'magnifier', 'Detective privado', 'de misterio', 10],
  [14, 'wand', 'Más allá del espejo', 'de fantasía', 10], [12, 'compass', 'Mapa del tesoro', 'de aventuras', 10],
  [37, 'cactus', 'Forastero', 'del oeste', 5], [10752, 'helmet', 'Veterano de guerra', 'bélicas', 5],
  [99, 'globe', 'Mundo real', 'documentales', 5], [10402, 'note', 'Banda sonora', 'musicales', 5],
  [36, 'scroll', 'Cronista', 'históricas', 5], [10751, 'house', 'Sesión familiar', 'familiares', 10],
];
// TV genres that mean the same as a film genre.
const TV_GENRE = { 10759: 28, 10765: 878, 10768: 10752 };

// ---------- Facts: one pass over the log ----------

const pad = n => String(n).padStart(2, '0');
const dayNumber = iso => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
const monthNumber = iso => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
function longestRun(sortedNumbers) {
  let best = 0, run = 0, prev = null;
  for (const n of sortedNumbers) { run = prev != null && n === prev + 1 ? run + 1 : 1; prev = n; best = Math.max(best, run); }
  return best;
}

export function trophyFacts(items, { library = {}, now = new Date() } = {}) {
  const live = Object.values(items || {}).filter(it => it && !it.deleted);
  const movies = live.filter(it => it.type === 'movie' && it.status === 'watched');
  const shows = live.filter(it => it.type === 'tv');
  const seenShows = shows.filter(it => it.status === 'completed' || Object.keys(it.seen || {}).length);
  const seenIds = new Set(movies.map(m => m.id));
  const lib = it => library[it.key] || {};
  const runtime = it => it.runtime || lib(it).runtime || 0;

  // Time on screen
  let minutes = 0;
  for (const m of movies) minutes += runtime(m) * Math.max(1, (m.watches || []).length);
  for (const s of shows) {
    for (const n of Object.keys(s.seen || {})) {
      const season = (s.seasons || []).find(x => String(x.n) === String(n));
      if (season) minutes += (season.eps || 0) * (season.runtime || s.runtime || 45);
    }
  }
  const seasons = shows.reduce((n, s) => n + Object.keys(s.seen || {}).length, 0);

  // Genres (titles, not viewings)
  const genres = new Map();
  for (const it of [...movies, ...seenShows]) {
    for (const g of new Set((it.genres || []).map(x => TV_GENRE[x] || x))) genres.set(g, (genres.get(g) || 0) + 1);
  }
  const filmGenres = new Set();
  for (const m of movies) for (const g of m.genres || []) filmGenres.add(g);

  // Decades
  const decades = {};
  for (const m of movies) if (m.year) decades[Math.floor(m.year / 10) * 10] = (decades[Math.floor(m.year / 10) * 10] || 0) + 1;

  // Dated viewings
  const entries = [];
  for (const m of movies) for (const w of m.watches || []) if (w.date) entries.push({ date: w.date, it: m, kind: 'movie' });
  for (const s of shows) for (const d of Object.values(s.seen || {})) if (d) entries.push({ date: d, it: s, kind: 'season' });
  const perDay = new Map(), moviesPerDay = new Map(), seasonsPerDay = new Map(), perMonth = new Map();
  for (const e of entries) {
    perDay.set(e.date, (perDay.get(e.date) || 0) + 1);
    const bucket = e.kind === 'movie' ? moviesPerDay : seasonsPerDay;
    bucket.set(e.date, (bucket.get(e.date) || 0) + 1);
    perMonth.set(e.date.slice(0, 7), (perMonth.get(e.date.slice(0, 7)) || 0) + 1);
  }
  const days = [...perDay.keys()].map(dayNumber).sort((a, b) => a - b);
  const months = [...perMonth.keys()].map(k => monthNumber(`${k}-01`)).sort((a, b) => a - b);
  const on = (test, genre, ids) => entries.some(e => test(e.date) && (!genre || (e.it.genres || []).includes(genre)) && (!ids || (e.kind === 'movie' && ids.includes(e.it.id))));
  const md = d => d.slice(5);

  // People (from the background library of credits)
  const directorCount = new Map(), actorCount = new Map();
  let analysed = 0;
  for (const m of movies) {
    const l = lib(m);
    if (l.directors || l.cast) analysed++;
    for (const d of new Map((l.directors || []).map(x => [x.id, x])).values()) directorCount.set(d.id, (directorCount.get(d.id) || 0) + 1);
    for (const a of new Map((l.cast || []).slice(0, 8).map(x => [x.id, x])).values()) if (a.id != null) actorCount.set(a.id, (actorCount.get(a.id) || 0) + 1);
  }

  // Secrets
  const added = live.map(it => it.addedAt).filter(Boolean).sort((a, b) => a - b);
  let burst = 0;
  for (let i = 0, j = 0; i < added.length; i++) { while (added[i] - added[j] > 5 * 60000) j++; burst = Math.max(burst, i - j + 1); }
  const night = live.some(it => [it.addedAt, it.updatedAt].some(t => t && new Date(t).getHours() >= 3 && new Date(t).getHours() < 5));
  const titles = new Map();
  for (const m of movies) { const k = normalizeTitle(m.title); titles.set(k, (titles.get(k) || new Set()).add(m.id)); }

  const rated = live.filter(it => it.rating != null && (it.type === 'tv' ? seenShows.includes(it) : it.status === 'watched'));
  const notes = live.filter(it => it.note).length + movies.reduce((n, m) => n + (m.watches || []).filter(w => w.note).length, 0);
  const seenTitles = movies.length + seenShows.length;

  return {
    movies: movies.length, seenIds, seasons, minutes, hours: Math.floor(minutes / 60),
    epic: movies.filter(m => runtime(m) >= 180).length, short: movies.filter(m => runtime(m) > 0 && runtime(m) <= 80).length,
    tvCompleted: shows.filter(s => s.status === 'completed').length,
    tvWatching: shows.filter(s => s.status === 'watching').length,
    longShows: shows.filter(s => s.status === 'completed' && (s.seasons || []).filter(x => x.n > 0).length >= 5).length,
    dropped: shows.filter(s => s.status === 'dropped').length,
    genres, filmGenres: filmGenres.size, decades, decadeCount: Object.keys(decades).length,
    before1930: movies.filter(m => m.year && m.year < 1930).length, before1970: movies.filter(m => m.year && m.year < 1970).length,
    thisYear: movies.filter(m => m.year === now.getFullYear()).length,
    rated: rated.length, five: rated.filter(it => it.rating === 5).length, low: rated.filter(it => it.rating <= 1).length,
    half: rated.filter(it => it.rating % 1 !== 0).length, notes,
    allRated: seenTitles >= 50 && rated.length >= seenTitles ? 1 : 0,
    days: days.length, streak: longestRun(days), monthStreak: longestRun(months),
    maxMoviesDay: Math.max(0, ...moviesPerDay.values()), maxSeasonsDay: Math.max(0, ...seasonsPerDay.values()),
    maxMonth: Math.max(0, ...perMonth.values()),
    rewatched: movies.filter(m => (m.watches || []).length >= 2).length, maxWatches: Math.max(0, ...movies.map(m => (m.watches || []).length)),
    watchlist: live.filter(it => it.status === 'watchlist').length, favorites: live.filter(it => it.favorite).length, titles: live.length,
    directorCount, actorCount, analysed,
    maxDirector: Math.max(0, ...directorCount.values()), maxActor: Math.max(0, ...actorCount.values()),
    xmas: on(d => md(d) === '12-24' || md(d) === '12-25'), newYear: on(d => md(d) === '12-31' || md(d) === '01-01'),
    halloween: on(d => md(d) === '10-31', 27), valentine: on(d => md(d) === '02-14', 10749),
    may4: on(d => md(d) === '05-04', null, [11, 1891, 1892, 1893, 1894, 1895, 140607, 181808, 181812]),
    oct21: on(d => md(d) === '10-21', null, [105, 165, 196]),
    friday13: on(d => d.slice(8) === '13' && new Date(`${d}T12:00:00`).getDay() === 5, 27),
    summerJaws: on(d => md(d) >= '07-01' && md(d) <= '08-31', null, [578]),
    leap: on(d => md(d) === '02-29'),
    burst, night, remake: [...titles.values()].some(ids => ids.size >= 2),
  };
}

// ---------- Catalogue ----------

const T = (room, id, tier, icon, name, desc, goal, value, extra = {}) => ({ room, id, tier, icon, name, desc, goal, value, ...extra });
const flag = f => (f ? 1 : 0);

function catalogue() {
  const list = [];
  const add = (...a) => list.push(T(...a));

  [[1, 'bronze', 'Primera función'], [10, 'bronze', 'Abono de temporada'], [25, 'bronze', 'Butaca de honor'], [50, 'silver', 'Fila siete'],
    [100, 'silver', 'Club de los cien'], [250, 'gold', 'Devorador de celuloide'], [500, 'gold', 'Archivo viviente'], [1000, 'platinum', 'Leyenda de la filmoteca']]
    .forEach(([n, tier, name]) => add('taquilla', `taq-${n}`, tier, n >= 250 ? 'popcorn' : 'ticket', name, n === 1 ? 'Registre su primera película.' : `${n} películas vistas.`, n, f => f.movies));

  [[24, 'bronze', 'Un día en la oscuridad'], [100, 'silver', 'Cien horas de proyección'], [500, 'gold', 'Ojos cuadrados'],
    [1000, 'gold', 'Mil horas de pantalla'], [2500, 'platinum', 'Una vida en 35 mm']]
    .forEach(([n, tier, name]) => add('maraton', `mar-${n}`, tier, 'hourglass', name, `${n} horas entre películas y series.`, n, f => f.hours));
  add('maraton', 'mar-epica', 'silver', 'hourglass', 'Épica de tres horas', 'Vea una película de tres horas o más.', 1, f => f.epic);
  add('maraton', 'mar-epica-5', 'gold', 'hourglass', 'Resistencia de hierro', 'Cinco películas de tres horas o más.', 5, f => f.epic);
  add('maraton', 'mar-corto', 'bronze', 'clapper', 'Corto pero intenso', 'Una película de 80 minutos o menos.', 1, f => f.short);

  [[1, 'bronze', 'Episodio piloto'], [10, 'bronze', 'Temporada alta'], [50, 'silver', 'Atracón'], [100, 'gold', 'Sofá de oro'], [250, 'platinum', 'Rey del streaming']]
    .forEach(([n, tier, name]) => add('series', `ser-temp-${n}`, tier, 'tv', name, n === 1 ? 'Vea su primera temporada.' : `${n} temporadas vistas.`, n, f => f.seasons));
  [[1, 'bronze', 'Fundido a negro'], [5, 'silver', 'Cinco finales'], [10, 'gold', 'Showrunner'], [25, 'platinum', 'Leyenda de la tele']]
    .forEach(([n, tier, name]) => add('series', `ser-fin-${n}`, tier, 'tv', name, n === 1 ? 'Termine una serie.' : `${n} series terminadas.`, n, f => f.tvCompleted));
  add('series', 'ser-larga', 'silver', 'tv', 'Larga duración', 'Termine una serie de cinco temporadas o más.', 1, f => f.longShows);
  add('series', 'ser-malabarista', 'silver', 'tv', 'Malabarista', 'Tres series en curso a la vez.', 3, f => f.tvWatching);
  add('series', 'ser-sofa', 'gold', 'tv', 'Maratón de sofá', 'Tres temporadas el mismo día.', 3, f => f.maxSeasonsDay);

  for (const [g, icon, ten, fifty, what] of GENRES) {
    add('generos', `gen-${g}-10`, 'bronze', icon, ten, `10 títulos ${what}.`, 10, f => f.genres.get(g) || 0);
    add('generos', `gen-${g}-50`, 'gold', icon, fifty, `50 títulos ${what}.`, 50, f => f.genres.get(g) || 0);
  }
  for (const [g, icon, name, what, n] of GENRES_ONE) add('generos', `gen-${g}`, n === 5 ? 'silver' : 'bronze', icon, name, `${n} títulos ${what}.`, n, f => f.genres.get(g) || 0);
  add('generos', 'gen-polifacetico', 'silver', 'masks', 'Polifacético', 'Películas de 10 géneros distintos.', 10, f => f.filmGenres);
  add('generos', 'gen-todoterreno', 'gold', 'masks', 'Todoterreno', 'Películas de 15 géneros distintos.', 15, f => f.filmGenres);

  add('tiempo', 'tie-mudo', 'gold', 'clapper', 'Cine mudo', 'Una película anterior a 1930.', 1, f => f.before1930);
  [[1930, 'silver', 'Edad de oro', 1], [1940, 'silver', 'Cine negro', 1], [1950, 'bronze', 'Technicolor', 3], [1960, 'bronze', 'Nueva ola', 3],
    [1970, 'bronze', 'Nuevo Hollywood', 3], [1980, 'bronze', 'Generación VHS', 5], [1990, 'bronze', 'Videoclub', 5],
    [2000, 'bronze', 'Era del DVD', 5], [2010, 'bronze', 'Era del streaming', 5], [2020, 'bronze', 'Rabiosa actualidad', 5]]
    .forEach(([d, tier, name, n]) => add('tiempo', `tie-${d}`, tier, 'clock', name, n === 1 ? `Una película de los años ${String(d).slice(2)}.` : `${n} películas de los años ${d < 2000 ? String(d).slice(2) : d}.`, n, f => f.decades[d] || 0));
  add('tiempo', 'tie-viajero', 'silver', 'clock', 'Viajero en el tiempo', 'Películas de 6 décadas distintas.', 6, f => f.decadeCount);
  add('tiempo', 'tie-maquina', 'gold', 'clock', 'Máquina del tiempo', 'Películas de 9 décadas distintas.', 9, f => f.decadeCount);
  add('tiempo', 'tie-clasica', 'gold', 'clapper', 'Alma clásica', '25 películas anteriores a 1970.', 25, f => f.before1970);
  add('tiempo', 'tie-estreno', 'silver', 'ticket', 'Recién estrenada', '10 películas estrenadas este año.', 10, f => f.thisYear);

  for (const [id, tier, icon, name, what, films, collections] of SAGAS) {
    add('sagas', `saga-${id}`, tier, icon, name, `Vea ${what}.`, films.length, f => films.filter(x => f.seenIds.has(x)).length, { films, collections, kind: 'saga' });
  }
  add('sagas', 'saga-5', 'gold', 'ring', 'Coleccionista de sagas', 'Complete 5 de estas sagas.', 5, (f, done) => SAGAS.filter(s => done.has(`saga-${s[0]}`)).length);
  add('sagas', 'saga-10', 'platinum', 'crown', 'Maestro de sagas', 'Complete 10 de estas sagas.', 10, (f, done) => SAGAS.filter(s => done.has(`saga-${s[0]}`)).length);

  for (const [id, title, year, name] of CANON) {
    add('filmoteca', `canon-${id}`, 'bronze', 'reel', name, `Vea ${title} (${year}).`, 1, f => flag(f.seenIds.has(id)), { films: [id], kind: 'film' });
  }
  add('filmoteca', 'canon-10', 'gold', 'reel', 'Filmoteca básica', '10 películas de la filmoteca esencial.', 10, f => CANON.filter(c => f.seenIds.has(c[0])).length);
  add('filmoteca', 'canon-todas', 'platinum', 'crown', 'Filmoteca completa', `Las ${CANON.length} películas de la filmoteca esencial.`, CANON.length, f => CANON.filter(c => f.seenIds.has(c[0])).length);

  const people = { kind: 'people' };
  add('autores', 'autor-5', 'silver', 'megaphone', 'Autor de cabecera', 'Cinco películas del mismo director.', 5, f => f.maxDirector, people);
  add('autores', 'autor-10', 'gold', 'megaphone', 'Retrospectiva', 'Diez películas del mismo director.', 10, f => f.maxDirector, people);
  add('autores', 'autor-distintos-25', 'silver', 'megaphone', 'Mirada de autor', 'Películas de 25 directores distintos.', 25, f => f.directorCount.size, people);
  add('autores', 'autor-distintos-100', 'gold', 'megaphone', 'Festival de autores', 'Películas de 100 directores distintos.', 100, f => f.directorCount.size, people);
  add('autores', 'actor-5', 'silver', 'masks', 'Fan número uno', 'Cinco películas con el mismo actor o actriz.', 5, f => f.maxActor, people);
  add('autores', 'actor-10', 'gold', 'masks', 'Cara conocida', 'Diez películas con el mismo actor o actriz.', 10, f => f.maxActor, people);
  for (const [pid, who, name] of DIRECTORS) {
    add('autores', `dir-${pid}`, 'bronze', 'megaphone', name, `Tres películas de ${who}.`, 3, f => f.directorCount.get(pid) || 0, { kind: 'person', person: { id: pid, name: who } });
  }

  [[1, 'bronze', 'Primera crítica'], [25, 'bronze', 'Crítico en ciernes'], [100, 'silver', 'Pluma afilada'], [500, 'gold', 'Crítico de referencia']]
    .forEach(([n, tier, name]) => add('critica', `cri-${n}`, tier, 'quill', name, n === 1 ? 'Puntúe su primer título.' : `${n} títulos puntuados.`, n, f => f.rated));
  add('critica', 'cri-obra-maestra', 'bronze', 'star', 'Obra maestra', 'Dé cinco estrellas a un título.', 1, f => f.five);
  add('critica', 'cri-lluvia', 'silver', 'star', 'Lluvia de estrellas', '25 títulos con cinco estrellas.', 25, f => f.five);
  add('critica', 'cri-tomatazo', 'bronze', 'tomato', 'Tomatazo', 'Dé una estrella o menos.', 1, f => f.low);
  add('critica', 'cri-matices', 'silver', 'star', 'Cuestión de matices', '20 notas con media estrella.', 20, f => f.half);
  [[1, 'bronze', 'Cuaderno de rodaje'], [10, 'silver', 'Diario de un cinéfilo'], [50, 'gold', 'Ensayista']]
    .forEach(([n, tier, name]) => add('critica', `cri-notas-${n}`, tier, 'pencil', name, n === 1 ? 'Escriba su primera nota.' : `${n} notas escritas.`, n, f => f.notes));
  add('critica', 'cri-todo', 'gold', 'quill', 'Nada sin nota', 'Con 50 títulos vistos o más, todos puntuados.', 1, f => f.allRated);

  [[7, 'bronze', 'Semana de cine'], [30, 'silver', 'Mes de cine'], [100, 'gold', 'Cien noches']]
    .forEach(([n, tier, name]) => add('habitos', `hab-dias-${n}`, tier, 'calendar', name, `Visionados con fecha en ${n} días distintos.`, n, f => f.days));
  [[3, 'bronze', 'Tres noches seguidas'], [7, 'silver', 'Semana sin descanso'], [30, 'platinum', 'Obsesión']]
    .forEach(([n, tier, name]) => add('habitos', `hab-racha-${n}`, tier, 'bolt', name, `Algo visto ${n} días seguidos.`, n, f => f.streak));
  add('habitos', 'hab-triple', 'bronze', 'popcorn', 'Sesión triple', 'Tres películas el mismo día.', 3, f => f.maxMoviesDay);
  add('habitos', 'hab-cinco', 'gold', 'popcorn', 'Maratón de cinco', 'Cinco películas el mismo día.', 5, f => f.maxMoviesDay);
  add('habitos', 'hab-mes', 'silver', 'calendar', 'Mes intensivo', '20 visionados en un mismo mes.', 20, f => f.maxMonth);
  add('habitos', 'hab-ano', 'gold', 'calendar', 'Todo el año', 'Algo visto cada mes durante 12 meses seguidos.', 12, f => f.monthStreak);
  add('habitos', 'hab-dejavu', 'bronze', 'reel', 'Déjà vu', 'Vuelva a ver una película.', 1, f => f.rewatched);
  add('habitos', 'hab-cabecera', 'silver', 'reel', 'Película de cabecera', 'Vea la misma película tres veces.', 3, f => f.maxWatches);
  add('habitos', 'hab-repetidor', 'gold', 'reel', 'Repetidor', '10 películas vistas más de una vez.', 10, f => f.rewatched);

  add('fechas', 'fecha-navidad', 'silver', 'snow', 'Cuento de Navidad', 'Vea algo el 24 o el 25 de diciembre.', 1, f => flag(f.xmas));
  add('fechas', 'fecha-halloween', 'silver', 'skull', 'Noche de brujas', 'Una de terror el 31 de octubre.', 1, f => flag(f.halloween));
  add('fechas', 'fecha-valentin', 'silver', 'heart', 'San Valentín', 'Una romántica el 14 de febrero.', 1, f => flag(f.valentine));
  add('fechas', 'fecha-nochevieja', 'silver', 'star', 'Uvas y palomitas', 'Vea algo el 31 de diciembre o el 1 de enero.', 1, f => flag(f.newYear));
  add('fechas', 'fecha-4-mayo', 'gold', 'saber', 'Día de la Fuerza', 'Una de Star Wars un 4 de mayo.', 1, f => flag(f.may4), { secret: true });
  add('fechas', 'fecha-21-octubre', 'gold', 'bolt', 'Día del futuro', 'Regreso al futuro un 21 de octubre.', 1, f => flag(f.oct21), { secret: true });
  add('fechas', 'fecha-viernes-13', 'gold', 'skull', 'Viernes 13', 'Una de terror un viernes 13.', 1, f => flag(f.friday13), { secret: true });
  add('fechas', 'fecha-tiburon', 'silver', 'wave', 'Verano peligroso', 'Tiburón en julio o agosto.', 1, f => flag(f.summerJaws), { secret: true });
  add('fechas', 'fecha-bisiesto', 'gold', 'calendar', 'Día bisiesto', 'Vea algo un 29 de febrero.', 1, f => flag(f.leap), { secret: true });

  add('coleccion', 'col-pendientes-10', 'bronze', 'bookmark', 'Lista de espera', '10 títulos en pendientes.', 10, f => f.watchlist);
  add('coleccion', 'col-pendientes-50', 'silver', 'bookmark', 'Montaña de pendientes', '50 títulos en pendientes.', 50, f => f.watchlist);
  add('coleccion', 'col-fav-1', 'bronze', 'heart', 'Flechazo', 'Elija su primera favorita.', 1, f => f.favorites);
  add('coleccion', 'col-fav-4', 'silver', 'heart', 'Podio completo', 'Cuatro favoritas.', 4, f => f.favorites);
  add('coleccion', 'col-fav-10', 'gold', 'heart', 'Corazón de cine', 'Diez favoritas.', 10, f => f.favorites);
  add('coleccion', 'col-archivo-100', 'silver', 'archive', 'Archivo en marcha', '100 títulos en su registro.', 100, f => f.titles);
  add('coleccion', 'col-archivo-500', 'gold', 'archive', 'Gran archivo', '500 títulos en su registro.', 500, f => f.titles);

  add('secretos', 'sec-rafaga', 'gold', 'bolt', 'Ráfaga', 'Marque 20 títulos en cinco minutos.', 1, f => flag(f.burst >= 20), { secret: true });
  add('secretos', 'sec-buho', 'silver', 'moon', 'Búho nocturno', 'Registre algo entre las 3 y las 5 de la madrugada.', 1, f => flag(f.night), { secret: true });
  add('secretos', 'sec-remake', 'silver', 'reel', 'Remake', 'Vea dos películas distintas con el mismo título.', 1, f => flag(f.remake), { secret: true });
  add('secretos', 'sec-abandono', 'bronze', 'tv', 'Hasta aquí hemos llegado', 'Abandone una serie.', 1, f => f.dropped, { secret: true });
  add('secretos', 'sec-todas-salas', 'platinum', 'crown', 'Coleccionista total', 'Consiga un trofeo en cada sala.', 1, (f, done, list) => flag(ROOMS.filter(r => r.id !== 'secretos').every(r => list.some(t => t.room === r.id && done.has(t.id)))), { secret: true });

  return list;
}

const CATALOGUE = catalogue();

// ---------- Evaluation ----------

export function rankFor(points) {
  let i = 0;
  while (i + 1 < RANKS.length && points >= RANKS[i + 1][0]) i++;
  const [at, name] = RANKS[i];
  const next = RANKS[i + 1] ? { at: RANKS[i + 1][0], name: RANKS[i + 1][1] } : null;
  return { name, at, level: i + 1, next, progress: next ? (points - at) / (next.at - at) : 1 };
}

// Meta trophies (those that count other trophies) are worked out after the rest.
export function evaluateTrophies(items, opts = {}) {
  const f = trophyFacts(items, opts);
  const done = new Set();
  const out = [];
  const evalOne = t => {
    const raw = Number(t.value(f, done, out)) || 0;
    const unlocked = raw >= t.goal;
    if (unlocked) done.add(t.id);
    const { value, ...rest } = t;
    return { ...rest, progress: Math.min(raw, t.goal), unlocked };
  };
  const isMeta = t => t.value.length > 1;
  for (const t of CATALOGUE) if (!isMeta(t)) out.push(evalOne(t));
  for (const t of CATALOGUE) if (isMeta(t)) out.push(evalOne(t));
  const order = new Map(CATALOGUE.map((t, i) => [t.id, i]));
  out.sort((a, b) => order.get(a.id) - order.get(b.id));
  const points = out.filter(t => t.unlocked).reduce((s, t) => s + TIERS[t.tier].points, 0);
  return { list: out, unlocked: done.size, total: out.length, points, rank: rankFor(points), analysed: f.analysed, movies: f.movies };
}

// A trophy once won stays won (unmarking a film later does not take it away). `seen` = {id: when it was won}.
export function withHistory(ev, seen = {}) {
  const list = ev.list.map(t => (seen[t.id] ? { ...t, unlocked: true, progress: t.goal, at: seen[t.id] } : t));
  const won = list.filter(t => t.unlocked);
  const points = won.reduce((s, t) => s + TIERS[t.tier].points, 0);
  return { ...ev, list, unlocked: won.length, points, rank: rankFor(points) };
}

// Trophies unlocked now that the device had not celebrated yet.
export function newlyUnlocked(list, seen = {}) {
  return list.filter(t => t.unlocked && !seen[t.id]).map(t => t.id);
}

// The visible locked trophy closest to being won.
export function nextTrophy(list) {
  let best = null, bestRatio = -1;
  for (const t of list) {
    if (t.unlocked || t.secret || !t.progress) continue;
    const ratio = t.progress / t.goal;
    if (ratio > bestRatio || (ratio === bestRatio && TIERS[t.tier].points < TIERS[best.tier].points)) { best = t; bestRatio = ratio; }
  }
  return best;
}

export const SAGA_FILMS = Object.fromEntries(SAGAS.map(s => [s[0], s[5]]));
export const CANON_FILMS = CANON.map(([id, title, year]) => ({ id, title, year }));
