import type { PlatformLook } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { alpha } from './colour';

/**
 * What the TV's screens need in script of a platform's look, beside the
 * desktop's designs (platform-design.ts): the facts the markup turns on.
 * Everything else a look changes (grounds, faces, corners, buttons,
 * badges, rings) is in styles/platforms.css, keyed on `.look--<look>` on
 * the screen, so the TV paints a platform's page without computing a
 * style. Every look the desktop draws has an entry: a known platform is
 * never drawn generic.
 */
export interface TvLook {
    /** The title page's colour under the artwork (the desktop's content ground). */
    readonly page: string;
    /** A carousel's frame colour, which the hero's stage takes. */
    readonly frame: string | null;
    /** "Más información" written out, or a round ⓘ beside the play button. */
    readonly textInfo: boolean;
    /** What a tile's corner carries: Netflix's red N, Prime Video's blue check. */
    readonly badge: 'n' | 'check' | null;
    /** The rating as Netflix's "78% de coincidencia", in green. */
    readonly match: boolean;
    /** Netflix's band at the billboard's right, carrying the languages. */
    readonly band: boolean;
    /** Prime Video's "Incluido con Prime" under the hero's title. */
    readonly included: boolean;
}

const BASE: TvLook = {
    page: '#19181a',
    frame: null,
    textInfo: false,
    badge: null,
    match: false,
    band: false,
    included: false,
};

function look(page: string, more: Partial<TvLook> = {}): TvLook {
    return { ...BASE, page, ...more };
}

const LOOKS: Readonly<Record<PlatformLook, TvLook>> = {
    netflix: look('#181818', { textInfo: true, badge: 'n', match: true, band: true }),
    prime: look('#0f171e', { frame: '#1a242f', badge: 'check', included: true }),
    hbo: look('#05050f'),
    apple: look('#000000'),
    disney: look('#1a1d29', { frame: '#0e1122', textInfo: true }),
    paramount: look('#070b18'),
    hulu: look('#0b0c0f', { textInfo: true }),
    movistar: look('#06142a'),
    atres: look('#0f0f0f', { textInfo: true }),
    mitele: look('#0f0a18', { frame: '#140d22', textInfo: true }),
    crave: look('#04070f'),
    default: BASE,
};

export function lookOf(id: PlatformLook): TvLook {
    return LOOKS[id] ?? BASE;
}

/**
 * A screen's classes for a look: its name and, for every platform but
 * Netflix (whose face is Bebas, as the TV's own), the desktop's DM Sans
 * titles.
 */
export function lookClasses(id: PlatformLook): string {
    if (id === 'default') {
        return 'look--default';
    }
    return id === 'netflix' ? 'look--netflix' : `look--${id} font--ui`;
}

/**
 * The title page's veils in the look's page colour, as detail.css draws
 * them for the generic page: shaded at the left under the text, fading
 * into the page at the foot.
 */
export function detailVeil(page: string): string {
    const at = (value: number) => alpha(page, value);
    return (
        `linear-gradient(90deg, ${at(0.95)} 0%, ${at(0.7)} 32%, ${at(0.15)} 62%, ${at(0)} 80%), ` +
        `linear-gradient(180deg, ${at(0.45)} 0%, ${at(0)} 22%, ${at(0)} 50%, ${at(1)} 92%)`
    );
}
