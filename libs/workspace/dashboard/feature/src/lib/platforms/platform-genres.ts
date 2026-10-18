/**
 * The genres of a platform's rows ("Terror", "Acción"…). Providers name
 * them in the catalog's language and their own words: a series carries
 * "Drama, Crimen" or "Action & Adventure", a movie sometimes a genre, and
 * the panel files titles in genre categories too ("|EN| ✪ HORROR"), which
 * a title lists in its `category_ids`.
 */
export type PlatformGenre =
    | 'action'
    | 'adventure'
    | 'comedy'
    | 'drama'
    | 'horror'
    | 'thriller'
    | 'crime'
    | 'scifi'
    | 'fantasy'
    | 'animation'
    | 'family'
    | 'documentary'
    | 'romance'
    | 'mystery'
    | 'war'
    | 'history'
    | 'reality'
    | 'western'
    | 'music';

const GENRES: readonly (readonly [PlatformGenre, RegExp])[] = [
    ['action', /acci[oó]n|\baction\b/i],
    ['adventure', /aventura|adventure/i],
    ['comedy', /comedia|comedy/i],
    ['drama', /drama/i],
    ['horror', /terror|horror/i],
    ['thriller', /thriller|suspense|suspenso/i],
    ['crime', /crimen|crime|policiac|polic[ií]a/i],
    ['scifi', /ciencia[- ]ficci[oó]n|sci-?fi|science[- ]fiction/i],
    ['fantasy', /fantas[ií]a|fantasy/i],
    ['animation', /animaci[oó]n|animation|anime|animad/i],
    ['family', /familia|family|infantil|kids|niños/i],
    ['documentary', /document/i],
    ['romance', /romance|rom[aá]ntic/i],
    ['mystery', /misterio|mystery/i],
    ['war', /b[eé]lic|guerra|\bwar\b/i],
    ['history', /histor/i],
    ['reality', /reality/i],
    ['western', /western/i],
    ['music', /m[uú]sica|musical|\bmusic\b/i],
];

/** The genres a genre text or category name names. */
export function genresIn(text: string | null | undefined): PlatformGenre[] {
    if (!text) {
        return [];
    }
    return GENRES.filter(([, pattern]) => pattern.test(text)).map(
        ([genre]) => genre
    );
}

/** The translation key of a genre's row title. */
export function genreLabelKey(genre: PlatformGenre): string {
    return `WORKSPACE.PLATFORMS.GENRES.${genre.toUpperCase()}`;
}
