/**
 * Images at the size the TV draws them: providers link TMDB images at
 * `original` or w600 (a megabyte each), a 2019 TV decodes every one in
 * full. TMDB serves any of its sizes from the same path.
 */
export type TmdbSize = 'w185' | 'w342' | 'w500' | 'w780' | 'w1280';

const TMDB = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)[^/]+(\/[^/?#]+)/i;

export function tmdbSized(url: string | null | undefined, size: TmdbSize): string | null {
    if (!url) {
        return null;
    }
    const match = TMDB.exec(url);
    return match ? `${match[1]}${size}${match[2]}` : url;
}

/** Only web images: some panels send local paths or "null". */
export function webImage(url: unknown): string | null {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim())
        ? url.trim()
        : null;
}

/**
 * The desktop's bundled assets ("./assets/platforms/netflix.svg",
 * "./assets/sports/logos/laliga.png") as the TV build copies them
 * (img/…, tools/build.mjs); remote URLs stay as they are.
 */
export function assetUrl(path: string | null | undefined): string | null {
    if (!path) {
        return null;
    }
    const local = /^\.?\/?assets\/(.+)$/.exec(path);
    return local ? `img/${local[1]}` : path;
}
