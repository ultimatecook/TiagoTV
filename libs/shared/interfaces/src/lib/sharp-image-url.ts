/** How an image is drawn: a 2:3 poster or a 16:9 backdrop. */
export type SharpImageKind = 'poster' | 'backdrop';

/**
 * TMDB's widths per kind (its `configuration`); `original` is above them.
 * Only these are served, so a poster never asks for w1280.
 */
const TMDB_WIDTHS: Readonly<Record<SharpImageKind, readonly number[]>> = {
    poster: [92, 154, 185, 342, 500, 780],
    backdrop: [300, 780, 1280],
};
const TMDB_HOST = 'image.tmdb.org';
/** `/t/p/w185/abc.jpg`, `/t/p/w600_and_h900_bestv2/abc.jpg`. */
const TMDB_PATH = /^\/t\/p\/([a-z0-9_]+)\/[^/]+$/i;

/**
 * A title image at a size that stays sharp where it is drawn. Provider
 * catalogs often point at a small TMDB size (w185 posters, w780
 * backdrops), which a large card, a hero or a 2× screen shows upscaled and
 * blurry: this asks TMDB for the smallest width covering `cssWidth` CSS
 * px at the screen's pixel ratio, and never a smaller one than given.
 *
 * Only plain `image.tmdb.org` links are rewritten. Any other URL — the
 * provider's own image links, which may carry the account in their path
 * or query — comes back exactly as it was.
 */
export function sharpImageUrl(
    url: string,
    kind: SharpImageKind,
    cssWidth: number,
    pixelRatio: number = screenPixelRatio()
): string {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return url;
    }
    if (
        parsed.hostname !== TMDB_HOST ||
        parsed.username ||
        parsed.password ||
        parsed.port ||
        parsed.search ||
        parsed.hash
    ) {
        return url;
    }
    const size = TMDB_PATH.exec(parsed.pathname)?.[1];
    const current = size ? sizeWidth(size, kind) : null;
    const needed = Math.ceil(cssWidth * Math.max(1, pixelRatio));
    if (!size || current === null || current >= needed) {
        return url;
    }
    const width = TMDB_WIDTHS[kind].find((candidate) => candidate >= needed);
    return url.replace(
        `/t/p/${size}/`,
        `/t/p/${width ? `w${width}` : 'original'}/`
    );
}

/** The width a TMDB size names: "w185", "w600_and_h900_bestv2", "h632". */
function sizeWidth(size: string, kind: SharpImageKind): number | null {
    if (size === 'original') {
        return Number.POSITIVE_INFINITY;
    }
    const width = /^w(\d+)/.exec(size);
    if (width) {
        return Number(width[1]);
    }
    const height = /^h(\d+)$/.exec(size);
    if (height) {
        return Number(height[1]) * (kind === 'poster' ? 2 / 3 : 16 / 9);
    }
    return null;
}

function screenPixelRatio(): number {
    const ratio = (globalThis as { devicePixelRatio?: number })
        .devicePixelRatio;
    return typeof ratio === 'number' && ratio > 0 ? ratio : 1;
}
