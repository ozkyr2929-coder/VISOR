// TMDB genre ids with their Spanish names (stable ids; avoids a network call for labels).
export const MOVIE_GENRES = [
  [28, 'Acción'], [12, 'Aventura'], [16, 'Animación'], [35, 'Comedia'], [80, 'Crimen'], [99, 'Documental'],
  [18, 'Drama'], [10751, 'Familia'], [14, 'Fantasía'], [36, 'Historia'], [27, 'Terror'], [10402, 'Música'],
  [9648, 'Misterio'], [10749, 'Romance'], [878, 'Ciencia ficción'], [53, 'Suspense'], [10752, 'Bélica'], [37, 'Western'],
];
export const TV_GENRES = [
  [10759, 'Acción y aventura'], [16, 'Animación'], [35, 'Comedia'], [80, 'Crimen'], [99, 'Documental'], [18, 'Drama'],
  [10751, 'Familia'], [10762, 'Infantil'], [9648, 'Misterio'], [10764, 'Reality'], [10765, 'Ciencia ficción y fantasía'],
  [10768, 'Bélica y política'], [37, 'Western'],
];
const NAMES = new Map([...MOVIE_GENRES, ...TV_GENRES, [10770, 'Película de TV'], [10763, 'Noticias'], [10766, 'Telenovela'], [10767, 'Entrevistas']]);
export const genreName = id => NAMES.get(id) || 'Otros';
