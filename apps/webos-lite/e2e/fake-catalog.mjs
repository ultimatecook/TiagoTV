/**
 * A fictional provider line-up, filed the way real Xtream panels file
 * theirs ("|ES| ✪ …", "|LAT|  ✪ ARGENTINA", event channels named after
 * their match), for the smoke run. No real provider data or credentials.
 */
export const ACCOUNT = { username: 'tiago', password: 'lite-test-pass' };

let nextId = 1000;
const stream = (categoryId, name, icon = 'auto') => ({
    num: nextId,
    stream_id: nextId++,
    name,
    stream_type: 'live',
    stream_icon: icon,
    category_id: String(categoryId),
    added: String(Math.floor(Date.now() / 1000) - 86400),
    epg_channel_id: null,
});

export const LIVE_CATEGORIES = [
    { category_id: '1', category_name: '|LAT|  ✪ ARGENTINA', parent_id: 0 },
    { category_id: '3', category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ', parent_id: 0 },
    { category_id: '4', category_name: '|ES| ✪ DEPORTES', parent_id: 0 },
    { category_id: '5', category_name: '|ES| ✪ DAZN EVENT', parent_id: 0 },
    { category_id: '6', category_name: '|UK| ✪ UK ᵁᴴᴰ/ᴴᴰ', parent_id: 0 },
    { category_id: '7', category_name: '|UK| ✪ NEWS', parent_id: 0 },
    { category_id: '8', category_name: '|US| ✪ USA', parent_id: 0 },
    { category_id: '9', category_name: '|US| ✪ NEWS', parent_id: 0 },
    { category_id: '10', category_name: '|FR| ✪ SPORTS', parent_id: 0 },
    { category_id: '12', category_name: '|ES| ✪ DAZN LA LIGA', parent_id: 0 },
    { category_id: '13', category_name: '|UK| ✪ PREMIER LEAGUE', parent_id: 0 },
    { category_id: '11', category_name: '|AR| ✪ ARABIC', parent_id: 0 },
];

function gmt(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return {
        day: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
        time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
    };
}

export function liveStreams() {
    nextId = 1000;
    const later = gmt(new Date(Date.now() + 3 * 3600 * 1000));
    const evening = gmt(new Date(Date.now() + 5 * 3600 * 1000));
    const live = (name) => {
        const entry = stream(5, name, null);
        entry.added = String(Math.floor(Date.now() / 1000) - 1800);
        return entry;
    };
    return [
        stream(1, '|ARG| TELEFE ᴴᴰ'),
        stream(1, '|ARG| TELEFE'),
        stream(1, '|ARG| EL TRECE ᴴᴰ'),
        stream(1, '|ARG| AMERICA TV'),
        stream(1, '|ARG| TV PUBLICA'),
        stream(1, '|ARG| EL NUEVE'),
        stream(1, '|ARG| NET TV', null),
        stream(1, '|ARG| C5N'),
        stream(1, '|ARG| TN'),
        stream(1, '|ARG| LN+'),
        stream(1, '|ARG| A24'),
        stream(1, '|ARG| CRONICA TV', 'http://127.0.0.1:1/missing.png'),
        stream(1, '|ARG| ESPN ᴴᴰ'),
        stream(1, '|ARG| ESPN 2'),
        stream(1, '|ARG| FOX SPORTS'),
        stream(1, '|ARG| TYC SPORTS'),
        stream(1, '|ARG| TNT SPORTS'),
        stream(1, '|ARG| CARTOON NETWORK'),
        stream(1, '|ARG| DISNEY CHANNEL'),
        stream(1, '|ARG| ENCUENTRO'),
        stream(3, '|ES| La 1 ᵁᴴᴰ'),
        stream(3, '|ES| La 1 ᴴᴰ'),
        stream(3, '|ES| La 2 ᴴᴰ'),
        stream(3, '|ES| Antena 3 ᵁᴴᴰ'),
        stream(3, '|ES| Cuatro ᴴᴰ'),
        stream(3, '|ES| Telecinco ᴴᴰ'),
        stream(3, '|ES| La Sexta ᴴᴰ'),
        stream(3, '|ES| 24 Horas'),
        stream(3, '|ES| Teledeporte'),
        stream(3, '|ES| Clan'),
        stream(4, '|ES| M. Deportes 1 ᴴᴰ'),
        stream(4, '|ES| M LA LIGA TV ᴴᴰ'),
        stream(4, '|ES| DAZN 1 ᴴᴰ'),
        stream(4, '|ES| DAZN LALIGA ᴴᴰ'),
        stream(4, '|ES| Eurosport 1'),
        live('Live | Real Madrid - FC Barcelona | LaLiga | ES'),
        live("Live | Newell's Old Boys - Rosario Central | Liga Profesional | ES"),
        live('Live | Manchester City - Liverpool | Premier League | ES'),
        live('Live | Paris FC - Stade Rennais FC | Ligue 1 | ES'),
        stream(5, `Next | ${later.day} | ${later.time} (GMT) | West Ham United - Arsenal | Premier League | ES`, null),
        stream(5, `Next | ${evening.day} | ${evening.time} (GMT) | Málaga - Real Sociedad | LaLiga | ES`, null),
        stream(5, `Next | ${evening.day} | ${evening.time} (GMT) | Juventus - Lazio | Serie A | ES`, null),
        stream(5, 'ES | No Event', null),
        stream(12, '|ES| M+ LaLiga TV ᴴᴰ'),
        stream(12, '|ES| DAZN LaLiga 1 ᴴᴰ'),
        stream(12, '|ES| DAZN LaLiga 2 ᴴᴰ'),
        stream(12, '|ES| LaLiga TV Hypermotion'),
        stream(13, '|UK| Sky Sports Premier League'),
        stream(13, '|UK| TNT Sports 1'),
        stream(6, '|UK| BBC One ᴴᴰ'),
        stream(6, '|UK| BBC Two ᴴᴰ'),
        stream(6, '|UK| ITV 1 ᴴᴰ'),
        stream(6, '|UK| Channel 4'),
        stream(6, '|UK| Channel 5'),
        stream(7, '|UK| BBC News'),
        stream(7, '|UK| Sky News'),
        stream(7, '|UK| GB News'),
        stream(8, '|US| ABC'),
        stream(8, '|US| CBS'),
        stream(8, '|US| NBC'),
        stream(8, '|US| FOX'),
        stream(8, '|US| PBS'),
        stream(9, '|US| CNN'),
        stream(9, '|US| FOX NEWS'),
        stream(9, '|US| MSNBC'),
        stream(10, 'FR| CANAL+ SPORT'),
        stream(11, 'AR| AL JAZEERA'),
    ];
}

/* Movies and series: the platforms' catalogs in ES and EN, as panels file
   them (a language per category, Prime Video's movies as "MULTI"). Each
   row: [Spanish name, English name, year, rating, genre]. */
const MOVIES = [
    ['TYLER RAKE', 'EXTRACTION', 2020, 7.4, 'Acción'],
    ['ALERTA ROJA', 'RED NOTICE', 2021, 6.8, 'Acción, Comedia'],
    ['EL HOYO', 'THE PLATFORM', 2019, 7.0, 'Terror, Ciencia ficción'],
    ['NO MIRES ARRIBA', "DON'T LOOK UP", 2021, 7.2, 'Comedia'],
    ['GLASS ONION', 'GLASS ONION', 2022, 7.1, 'Misterio, Comedia'],
    ['EL AGENTE INVISIBLE', 'THE GRAY MAN', 2022, 6.9, 'Acción'],
    ['ENOLA HOLMES', 'ENOLA HOLMES', 2020, 7.6, 'Misterio, Aventura'],
    ['ROMA', 'ROMA', 2018, 7.7, 'Drama'],
    ['LA SOCIEDAD DE LA NIEVE', 'SOCIETY OF THE SNOW', 2023, 8.0, 'Drama, Historia'],
    ['DAMSEL', 'DAMSEL', 2024, 7.1, 'Fantasía, Acción'],
    ['ATLAS', 'ATLAS', 2024, 6.7, 'Ciencia ficción, Acción'],
    ['OKJA', 'OKJA', 2017, 7.6, 'Aventura, Drama'],
    [null, 'HUSTLE', 2022, 7.6, 'Comedia, Drama'],
    ['MANK', null, 2020, 6.9, 'Drama'],
    ['HISTORIA DE UN MATRIMONIO', 'MARRIAGE STORY', 2019, 7.7, 'Drama'],
];
const HBO_MOVIES = [
    ['DUNE', 'DUNE', 2021, 8.0, 'Ciencia ficción, Aventura'],
    ['THE BATMAN', 'THE BATMAN', 2022, 7.8, 'Acción, Crimen'],
    ['BARBIE', 'BARBIE', 2023, 7.0, 'Comedia'],
    ['ELVIS', 'ELVIS', 2022, 7.3, 'Drama, Música'],
    ['WONKA', 'WONKA', 2023, 7.1, 'Fantasía, Familia'],
];
const PRIME_MOVIES = [
    [null, 'SALTBURN', 2023, 7.1, 'Thriller, Drama'],
    [null, 'THE TOMORROW WAR', 2021, 6.6, 'Acción, Ciencia ficción'],
    [null, 'AIR', 2023, 7.4, 'Drama'],
    [null, 'RED ONE', 2024, 6.4, 'Acción, Comedia'],
];
const DISNEY_MOVIES = [
    ['INTENSA-MENTE 2', null, 2024, 7.6, 'Animación, Familia'],
    ['ELEMENTOS', null, 2023, 7.0, 'Animación, Familia'],
    ['AVATAR: EL CAMINO DEL AGUA', null, 2022, 7.6, 'Ciencia ficción, Aventura'],
];
const APPLE_MOVIES = [
    [null, 'KILLERS OF THE FLOWER MOON', 2023, 7.6, 'Crimen, Drama'],
    [null, 'NAPOLEON', 2023, 6.4, 'Historia, Drama'],
];
const MOVISTAR_MOVIES = [
    ['LA VIEJA GUARDIA', null, 2020, 7.2, 'Acción'],
    ['EL IRLANDÉS', null, 2019, 7.8, 'Crimen, Drama'],
];
const SERIES = [
    ['LA CASA DE PAPEL', 'MONEY HEIST', 2017, 8.2, 'Acción, Crimen'],
    ['STRANGER THINGS', 'STRANGER THINGS', 2016, 8.6, 'Ciencia ficción, Terror'],
    ['MIÉRCOLES', 'WEDNESDAY', 2022, 8.5, 'Comedia, Misterio'],
    ['EL JUEGO DEL CALAMAR', 'SQUID GAME', 2021, 7.8, 'Acción, Drama'],
    ['DARK', 'DARK', 2017, 8.4, 'Drama, Crimen'],
    ['ÉLITE', null, 2018, 8.0, 'Drama'],
    ['THE CROWN', 'THE CROWN', 2016, 8.2, 'Drama, Historia'],
    ['NARCOS', 'NARCOS', 2015, 8.1, 'Crimen, Drama'],
    ['FAUDA', 'FAUDA', 2015, 8.0, 'Acción, Aventura'],
    ['MUERTOS S.L.', 'DEATH INC.', 2024, 7.2, 'Comedia'],
];
const HBO_SERIES = [
    ['LA CASA DEL DRAGÓN', 'HOUSE OF THE DRAGON', 2022, 8.4, 'Fantasía, Drama'],
    ['THE LAST OF US', 'THE LAST OF US', 2023, 8.7, 'Drama, Ciencia ficción'],
    ['EL PINGÜINO', 'THE PENGUIN', 2024, 8.6, 'Crimen, Drama'],
];
const PRIME_SERIES = [
    [null, 'THE BOYS', 2019, 8.7, 'Acción, Comedia'],
    [null, 'FALLOUT', 2024, 8.4, 'Ciencia ficción, Aventura'],
    [null, 'REACHER', 2022, 8.1, 'Acción, Crimen'],
];
const APPLE_SERIES = [
    [null, 'SEVERANCE', 2022, 8.7, 'Ciencia ficción, Misterio'],
    [null, 'TED LASSO', 2020, 8.8, 'Comedia, Drama'],
    [null, 'SLOW HORSES', 2022, 8.2, 'Thriller, Crimen'],
];

export const VOD_CATEGORIES = [
    { category_id: '1610', category_name: '|ES| ✪ ORIGINAL NETFLIX', parent_id: 0 },
    { category_id: '1125', category_name: '|EN| ✪ Netflix MULTI SUB', parent_id: 0 },
    { category_id: '2000', category_name: '|ES| ✪ HBO MAX', parent_id: 0 },
    { category_id: '2001', category_name: '|EN| ✪ HBO MAX', parent_id: 0 },
    { category_id: '2100', category_name: '✪ ORIGINAL AMAZON  MULTI', parent_id: 0 },
    { category_id: '2200', category_name: '|ES| ✪ DISNEY+', parent_id: 0 },
    { category_id: '2300', category_name: '|EN| ✪ APPLE TV+', parent_id: 0 },
    { category_id: '2400', category_name: '|ES| ✪ MOVISTAR+ ESTRENOS', parent_id: 0 },
    { category_id: '1183', category_name: '|ES| DRAMA', parent_id: 0 },
    { category_id: '3000', category_name: '|FR| ✪ NETFLIX', parent_id: 0 },
];
export const SERIES_CATEGORIES = [
    { category_id: '2331', category_name: '|ES| ✪ NETFLIX SERIES', parent_id: 0 },
    { category_id: '482', category_name: '|EN| ✪ NETFLIX', parent_id: 0 },
    { category_id: '2340', category_name: '|ES| ✪ HBO MAX SERIES', parent_id: 0 },
    { category_id: '2341', category_name: '|EN| ✪ HBO MAX SERIES', parent_id: 0 },
    { category_id: '2350', category_name: '|EN| ✪ AMAZON PRIME SERIES', parent_id: 0 },
    { category_id: '2370', category_name: '|EN| ✪ APPLE TV+ SERIES', parent_id: 0 },
];

const T0 = Math.floor(Date.now() / 1000);
const DAY = 86400;

const ENGLISH = {
    Acción: 'Action', Comedia: 'Comedy', Terror: 'Horror', 'Ciencia ficción': 'Science Fiction', Misterio: 'Mystery',
    Aventura: 'Adventure', Drama: 'Drama', Historia: 'History', Fantasía: 'Fantasy', Crimen: 'Crime', Música: 'Music',
    Familia: 'Family', Animación: 'Animation', Thriller: 'Thriller',
};

function entries(rows, kind, base, categories, art) {
    const out = {};
    rows.forEach(([es, en, year, rating, genre], index) => {
        [['ES', es], ['EN', en]].forEach(([language, name], side) => {
            if (!name || !categories[language]) {
                return;
            }
            const id = base + index * 2 + side;
            const label = language === 'ES' ? `${name} (${year}) ES` : `${name} (${year})_ENG`;
            const key = es || en;
            const genreText = language === 'ES' ? genre : genre.split(', ').map((g) => ENGLISH[g] ?? g).join(', ');
            const common = {
                num: id,
                name: label,
                rating: String(rating),
                category_id: categories[language],
                category_ids: [Number(categories[language])],
                tmdb: String(500000 + base + index),
                genre: genreText,
            };
            // Newest first in the panel's order of uploads: a few days apart.
            const added = String(T0 - index * DAY - side * 3600);
            const item =
                kind === 'movie'
                    ? { ...common, stream_id: id, stream_type: 'movie', stream_icon: art.poster(key), added, container_extension: 'mkv' }
                    : {
                          ...common,
                          series_id: id,
                          cover: art.poster(key),
                          plot: language === 'ES' ? `La historia de ${name.toLowerCase()}.` : `The story of ${name.toLowerCase()}.`,
                          releaseDate: `${year}-01-01`,
                          last_modified: added,
                          backdrop_path: [art.backdrop(key)],
                      };
            (out[categories[language]] ??= []).push(item);
        });
    });
    return out;
}

/** `art.poster(name)` and `art.backdrop(name)`: the panel's image URLs. */
export function vodCatalog(art) {
    return {
        vod: {
            ...entries(MOVIES, 'movie', 50000, { ES: '1610', EN: '1125' }, art),
            ...entries(HBO_MOVIES, 'movie', 60000, { ES: '2000', EN: '2001' }, art),
            ...entries(PRIME_MOVIES, 'movie', 61000, { EN: '2100' }, art),
            ...entries(DISNEY_MOVIES, 'movie', 62000, { ES: '2200' }, art),
            ...entries(APPLE_MOVIES, 'movie', 63000, { EN: '2300' }, art),
            ...entries(MOVISTAR_MOVIES, 'movie', 64000, { ES: '2400' }, art),
        },
        series: {
            ...entries(SERIES, 'series', 9000, { ES: '2331', EN: '482' }, art),
            ...entries(HBO_SERIES, 'series', 9500, { ES: '2340', EN: '2341' }, art),
            ...entries(PRIME_SERIES, 'series', 9600, { EN: '2350' }, art),
            ...entries(APPLE_SERIES, 'series', 9700, { EN: '2370' }, art),
        },
    };
}
