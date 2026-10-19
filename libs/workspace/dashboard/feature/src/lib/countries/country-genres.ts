/**
 * The kinds of rows "Por países" shows, in the page's order: a country's
 * main channels, then sports, live events, news, movies and series, kids,
 * documentaries, music, everything else, and last the other versions of
 * channels shown above (4K, SD, +1).
 */
export type RowTier =
    | 'main'
    | 'sports'
    | 'events'
    | 'news'
    | 'movies'
    | 'kids'
    | 'documentary'
    | 'music'
    | 'more'
    | 'copies';

export const TIER_ORDER: readonly RowTier[] = [
    'main',
    'sports',
    'events',
    'news',
    'movies',
    'kids',
    'documentary',
    'music',
    'more',
    'copies',
];

/** Lower case without accents. */
export function plainText(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const SPORTS =
    /\b(deportes?|sports?|futbol|football|soccer|liga|laliga\+?|hypermotion|dazn|bein|eurosport|formula|f1|motogp|nba|wnba|nfl|nhl|mlb|mls|tennis|roland|garros|cricket|boxing|ufc|wwe|baloncesto|acb|copa|champions|uefa|premier|bundesliga|serie a|rfef|2rfef|tudn|vix|golf|rugby|hub|scottish|gaa)\b/;

/** A category's kind, by its label ("DAZN La Liga", "News", "4K"…). */
const CATEGORY_TIERS: readonly (readonly [RowTier, RegExp])[] = [
    ['copies', /^(4k|uhd|sd|hd)$|timeshift|\+1\b/],
    ['events', /\b(ppv|events?|eventos?|board)\b/],
    ['news', /\b(news|noticias)\b/],
    ['kids', /\b(kids|ninos|infantil(es)?)\b/],
    ['movies', /\b(cinema|cine|movies?|peliculas|box office)\b/],
    ['documentary', /\b(documentar(y|ies)|documentales|discovery\+?)\b/],
    ['music', /\b(music|musica)\b/],
    ['sports', SPORTS],
    ['main', /^(entertainment|entretenimiento|general|bbc general)$/],
];

/**
 * The labels that name a kind itself ("Deportes", "Sports", "Movies
 * Channels"): such a category is the kind's own row, and the channels of
 * the country's main group that belong to that kind join it.
 */
const GENERIC_LABELS: Partial<Record<RowTier, readonly string[]>> = {
    main: ['entertainment', 'entretenimiento', 'general'],
    sports: ['deportes', 'sports', 'sport'],
    news: ['news', 'noticias'],
    movies: ['cinema', 'cine', 'movies', 'movies channels', 'peliculas'],
    kids: ['kids', 'kids network', 'ninos', 'infantiles'],
    documentary: ['documentary', 'documentaries', 'documentales'],
    music: ['music', 'musica'],
};

export function categoryTier(label: string | null): RowTier {
    if (label === null) {
        return 'main';
    }
    const text = plainText(label);
    return (
        CATEGORY_TIERS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'more'
    );
}

/** Whether a category is its kind's own row (its label names the kind). */
export function isGenericCategory(
    label: string | null,
    tier: RowTier
): boolean {
    return (
        label === null ||
        (GENERIC_LABELS[tier]?.includes(plainText(label)) ?? false)
    );
}

/**
 * The kind of a channel of a country's main group, by its name, for the
 * channels a main group mixes in: "ESPN", "C5N", "Cartoon Network",
 * "HBO"… Null when the name says nothing (the country's own channels:
 * "Telefe", "La 1", "ITV 1").
 */
const CHANNEL_GENRES: readonly (readonly [RowTier, RegExp])[] = [
    [
        'kids',
        /\b(kids|junior|jr|disney|nick(elodeon|toons|jr)?|nick ?2|cartoon(ito)?|boomerang|pakapaka|clan|boing|baby ?tv|babyfirst|tooncast|cbeebies|cbbc|panda|pbs kids|dreamworks|duck ?tv)\b/,
    ],
    [
        'news',
        /\b(news|noticias|c5n|tn|a24|cronica|canal 26|la nacion|cnn|telesur|dw|france 24|24 ?h(oras)?|euronews|al ?jazeera|msnbc|cnbc|bloomberg|newsmax|news ?nation)\b/,
    ],
    [
        'sports',
        /\b(espn\d?|tyc|fox sports?|tnt sports?|deportv|direct ?tv sports|teledeporte|gol ?tv|gol|eurosport|dazn|bein|deportes|real madrid tv|sky sports?|tsn|nba tv|nfl network|mlb network|golf|tennis|win sports|claro sports|tudn|fox soccer|cbs sports|nbc sports|sportsnet|liga|laliga|lcampeon|campeones|vamos|ellas)\b/,
    ],
    [
        'movies',
        /\b(cine|cinema|movies?|film|hbo|cinemax|cinecanal|tcm|amc|axn|fxx?|fox|warner|universal|paramount|star channel|tnt series|tnt|golden|space|isat|studio universal|showtime|starz|sundance|syfy|cosmo|calle 13|hollywood|a3series|atreseries|fdf|xtrm|telenovelas|series|drama|comedia|suspense|thriller|accion|comedy central)\b/,
    ],
    [
        'documentary',
        /\b(discovery|nat ?geo|national geographic|history|historia|h2|animal planet|investigation|encuentro|documentales|dmax|dkiss|odisea|viajar|love nature|smithsonian)\b/,
    ],
    [
        'music',
        /\b(music|musica|mtv|vh1|quiero|mezzo|classica|cmt|vevo|los 40)\b/,
    ],
];

export function channelGenre(title: string): RowTier | null {
    const text = plainText(title);
    return (
        CHANNEL_GENRES.find(([, pattern]) => pattern.test(text))?.[0] ?? null
    );
}
