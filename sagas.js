// Sagas and studios by fixed TMDB id (checked one by one on themoviedb.org, November 2026).
// Searching by name picked the wrong collection when there was no exact match.

export const SAGA_GROUPS = [
  { id: 'epicas', label: 'Épicas', sagas: [
    [10, 'Star Wars'], [119, 'El Señor de los Anillos'], [121938, 'El Hobbit'], [1241, 'Harry Potter'],
    [435259, 'Animales fantásticos'], [295, 'Piratas del Caribe'], [84, 'Indiana Jones'], [420, 'Las crónicas de Narnia'],
    [726871, 'Dune'], [87096, 'Avatar'], [131635, 'Los juegos del hambre'], [33514, 'Crepúsculo']] },
  { id: 'heroes', label: 'Superhéroes', sagas: [
    [86311, 'Los Vengadores'], [263, 'El caballero oscuro'], [120794, 'Batman (1989-1997)'], [556, 'Spider-Man de Raimi'],
    [531241, 'Spider-Man (UCM)'], [573436, 'Spider-Verse'], [748, 'X-Men'], [284433, 'Guardianes de la Galaxia'], [448150, 'Deadpool']] },
  { id: 'accion', label: 'Acción', sagas: [
    [404609, 'John Wick'], [87359, 'Misión: Imposible'], [645, 'James Bond'], [9485, 'Fast & Furious'], [31562, 'Bourne'],
    [1570, 'La jungla de cristal'], [945, 'Arma letal'], [8945, 'Mad Max'], [2883, 'Kill Bill'], [14890, 'Dos policías rebeldes'],
    [391860, 'Kingsman'], [1575, 'Rocky'], [304, "Ocean's"]] },
  { id: 'scifi', label: 'Ciencia ficción', sagas: [
    [2344, 'Matrix'], [528, 'Terminator'], [8091, 'Alien'], [264, 'Regreso al futuro'], [328, 'Jurassic Park'],
    [115575, 'Star Trek (2009-2016)'], [173710, 'El planeta de los simios'], [86055, 'Men in Black']] },
  { id: 'animacion', label: 'Animación', sagas: [
    [10194, 'Toy Story'], [2150, 'Shrek'], [86066, 'Gru, mi villano favorito'], [8354, 'Ice Age'], [77816, 'Kung Fu Panda'],
    [89137, 'Cómo entrenar a tu dragón'], [137697, 'Buscando a Nemo'], [87118, 'Cars'], [386382, 'Frozen'], [137696, 'Monstruos, S.A.'],
    [14740, 'Madagascar'], [468222, 'Los Increíbles'], [94032, 'El rey león'], [529, 'Wallace y Gromit'], [488924, 'Paddington']] },
  { id: 'terror', label: 'Terror', sagas: [
    [2602, 'Scream'], [91361, 'La noche de Halloween'], [313086, 'Expediente Warren'], [656, 'Saw'], [228446, 'Insidious'],
    [1960, 'Posesión infernal'], [2366, 'Tiburón']] },
  { id: 'comedia', label: 'Comedia', sagas: [
    [86119, 'Resacón en Las Vegas'], [9888, 'Solo en casa'], [2980, 'Cazafantasmas'], [8936, 'Bridget Jones'], [1006, 'Austin Powers']] },
  { id: 'autor', label: 'De autor', sagas: [[230, 'El Padrino'], [123800, 'Antes del amanecer'], [131, 'Tres colores']] },
  { id: 'espana', label: 'Cine español', sagas: [
    [2248, 'Torrente'], [74508, '[REC]'], [388180, 'Ocho apellidos'], [624920, 'Mortadelo y Filemón'], [492969, 'Tadeo Jones']] },
].map(g => ({ ...g, sagas: g.sagas.map(([id, label]) => ({ id, label })) }));

export const STUDIOS = [
  [3, 'Pixar'], [420, 'Marvel Studios'], [10342, 'Studio Ghibli'], [6125, 'Disney Animation'], [521, 'DreamWorks Animation'],
  [1, 'Lucasfilm'], [41077, 'A24'], [3172, 'Blumhouse'], [11537, 'Laika'], [297, 'Aardman'], [56, 'Amblin'],
  [923, 'Legendary'], [12, 'New Line Cinema'], [174, 'Warner Bros.'],
].map(([id, label]) => ({ id, label }));
