import { sharpImageUrl } from '@iptvnator/shared/interfaces';

/** The hero's keyart poster stands about this wide (CSS px). */
const HERO_POSTER_WIDTH = 320;

/**
 * A backdrop at the size the hero draws it: as wide as the window. The
 * backdrop finder loads this same URL, so the hero shows it from cache.
 */
export function heroBackdropUrl(url: string): string {
    const width =
        typeof window !== 'undefined' && window.innerWidth > 0
            ? window.innerWidth
            : 1600;
    return sharpImageUrl(url, 'backdrop', width);
}

export function heroPosterUrl(url: string): string {
    return sharpImageUrl(url, 'poster', HERO_POSTER_WIDTH);
}
