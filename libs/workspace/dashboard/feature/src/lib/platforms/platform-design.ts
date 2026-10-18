import type { StreamingPlatformId } from './streaming-platforms';

/**
 * How a platform's page is drawn, after the platform's own app: Netflix's
 * black billboard and 16:9 tiles with a Top 10, Prime Video's navy
 * carousel, HBO Max's posters on black and indigo, Apple TV's large
 * rounded cards, Disney+'s navy carousel and brand tiles, Paramount+'s
 * blue billboard, Hulu's green-lit hub, Movistar Plus+'s navy with the
 * "+", atresplayer's orange, mitele's magenta and Crave's electric blue.
 *
 * The first four looks are styled in their components; the newer seven
 * in the global platform stylesheet (apps/web/src/_platform-themes.scss),
 * keyed on the components' `data-look`, to keep each component's styles
 * within its budget.
 */
export type PlatformLook =
    | 'netflix'
    | 'prime'
    | 'hbo'
    | 'apple'
    | 'disney'
    | 'paramount'
    | 'hulu'
    | 'movistar'
    | 'atres'
    | 'mitele'
    | 'crave'
    | 'default';

export type PlatformTile = 'landscape' | 'poster';

export interface PlatformDesign {
    readonly look: PlatformLook;
    /** A full-bleed billboard, a rounded carousel or the Home's card. */
    readonly hero: 'billboard' | 'carousel' | 'card';
    /** The rows' tiles: 16:9 artwork or 2:3 posters. */
    readonly tiles: PlatformTile;
    /** Rows drawn with the other tile, Paramount+'s poster rows. */
    readonly otherTileRows?: readonly string[];
    /** Netflix's "Top 10" row, with the big outlined numbers. */
    readonly top10: boolean;
    /** Disney+'s brand tiles (Disney, Pixar, Marvel…) under the hero. */
    readonly brands?: boolean;
    /** The row heading's link to the whole list. */
    readonly seeAllKey: string;
    /** The hero's play button: "Ver ahora", or "Reproducir". */
    readonly playKey: string;
}

const SEE_ALL = 'WORKSPACE.PLATFORMS.SEE_ALL';
const WATCH = 'WORKSPACE.PLATFORMS.WATCH';
const PLAY = 'WORKSPACE.PLATFORMS.PLAY';

const DEFAULT_DESIGN: PlatformDesign = {
    look: 'default',
    hero: 'card',
    tiles: 'poster',
    top10: false,
    seeAllKey: SEE_ALL,
    playKey: WATCH,
};

/** A billboard with 16:9 rows, the shape most of the platforms share. */
function billboard(look: PlatformLook): PlatformDesign {
    return { ...DEFAULT_DESIGN, look, hero: 'billboard', tiles: 'landscape' };
}

const DESIGNS: Partial<Record<StreamingPlatformId, PlatformDesign>> = {
    netflix: {
        ...billboard('netflix'),
        top10: true,
        seeAllKey: 'WORKSPACE.PLATFORMS.EXPLORE_ALL',
    },
    'prime-video': {
        ...DEFAULT_DESIGN,
        look: 'prime',
        hero: 'carousel',
        tiles: 'landscape',
        seeAllKey: 'WORKSPACE.PLATFORMS.SEE_MORE',
    },
    'hbo-max': { ...billboard('hbo'), tiles: 'poster' },
    'apple-tv': billboard('apple'),
    'disney-plus': {
        ...DEFAULT_DESIGN,
        look: 'disney',
        hero: 'carousel',
        tiles: 'landscape',
        brands: true,
        playKey: PLAY,
    },
    'paramount-plus': {
        ...billboard('paramount'),
        otherTileRows: ['series', 'movies'],
    },
    hulu: { ...billboard('hulu'), playKey: PLAY },
    'movistar-plus': billboard('movistar'),
    atresplayer: billboard('atres'),
    mitele: {
        ...DEFAULT_DESIGN,
        look: 'mitele',
        hero: 'carousel',
        tiles: 'landscape',
        otherTileRows: ['series'],
    },
    crave: billboard('crave'),
};

export function platformDesign(id: StreamingPlatformId): PlatformDesign {
    return DESIGNS[id] ?? DEFAULT_DESIGN;
}

/** The tile a row of the design draws: the design's, or the other one. */
export function rowTile(design: PlatformDesign, rowId: string): PlatformTile {
    if (!design.otherTileRows?.includes(rowId)) {
        return design.tiles;
    }
    return design.tiles === 'landscape' ? 'poster' : 'landscape';
}
