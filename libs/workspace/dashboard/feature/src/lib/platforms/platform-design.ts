import type { StreamingPlatformId } from './streaming-platforms';

/**
 * How a platform's page is drawn, after the platform's own app (2025–26):
 * Netflix's black billboard, large 16:9 tiles that open their facts under
 * the pointer and a Top 10; Prime Video's navy carousel with a poster
 * "super carousel"; HBO Max's 16:9 tiles (since June 2025) with a poster
 * row; Apple TV's cinematic posters (tvOS 26) after a row of large 16:9
 * cards; Disney+'s navy carousel, brand tiles and poster rows (its
 * November 2025 redesign); Paramount+'s blue billboard with poster rows;
 * Hulu's green-lit hub with a row of large tiles; Movistar Plus+'s navy
 * with the "+", atresplayer's orange, mitele's magenta and Crave's blue.
 *
 * How many tiles a row shows across, and so their size, is each look's
 * (`--across-*` in the row's styles). The first four looks are styled in
 * their components; the newer seven in the global platform stylesheet
 * (apps/web/src/_platform-themes.scss), keyed on the components'
 * `data-look`, to keep each component's styles within its budget.
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
    /**
     * The row drawn a size up, fewer tiles across: Prime Video's poster
     * "super carousel", Apple TV's and Hulu's large 16:9 tiles.
     */
    readonly featuredRow?: string;
    /** The names on the artwork: every 16:9 tile's, or the featured row's. */
    readonly namesOnArt?: 'landscape' | 'featured';
    /** "Series · Drama" under (or with) the name: Apple TV, Hulu. */
    readonly tileSub?: boolean;
    /** The pointer or the keyboard opens a tile's facts on it. */
    readonly tileInfo?: boolean;
    /** Netflix's "Top 10" row, with the big outlined numbers. */
    readonly top10: boolean;
    /** Disney+'s brand tiles (Disney, Pixar, Marvel…) under the hero. */
    readonly brands?: boolean;
    /** The row heading's link to the whole list. */
    readonly seeAllKey: string;
    /** The hero's play button: "Ver ahora", or "Reproducir". */
    readonly playKey: string;
}

/** How a row (or the open list) dresses its tiles. */
export interface TileDress {
    readonly tile: PlatformTile;
    /** The featured row's larger tiles. */
    readonly large: boolean;
    /** The name written on the artwork instead of under it. */
    readonly caption: boolean;
    readonly sub: boolean;
    readonly info: boolean;
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
        namesOnArt: 'landscape',
        tileInfo: true,
        seeAllKey: 'WORKSPACE.PLATFORMS.EXPLORE_ALL',
    },
    'prime-video': {
        ...DEFAULT_DESIGN,
        look: 'prime',
        hero: 'carousel',
        tiles: 'landscape',
        otherTileRows: ['series'],
        featuredRow: 'series',
        tileInfo: true,
        seeAllKey: 'WORKSPACE.PLATFORMS.SEE_MORE',
    },
    'hbo-max': {
        ...billboard('hbo'),
        otherTileRows: ['series'],
        tileInfo: true,
    },
    'apple-tv': {
        ...billboard('apple'),
        tiles: 'poster',
        otherTileRows: ['newest'],
        featuredRow: 'newest',
        tileSub: true,
    },
    'disney-plus': {
        ...DEFAULT_DESIGN,
        look: 'disney',
        hero: 'carousel',
        tiles: 'poster',
        otherTileRows: ['newest'],
        brands: true,
        playKey: PLAY,
    },
    'paramount-plus': {
        ...billboard('paramount'),
        otherTileRows: ['series', 'movies'],
    },
    hulu: {
        ...billboard('hulu'),
        featuredRow: 'series',
        namesOnArt: 'featured',
        tileSub: true,
        playKey: PLAY,
    },
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

/**
 * How a row of the design dresses its tiles: their shape, the featured
 * row's larger size, the name on the artwork or under it, the facts the
 * pointer opens. The open list (`inGrid`) lays every tile out one size.
 */
export function tileDress(
    design: PlatformDesign,
    rowId: string,
    inGrid = false
): TileDress {
    const tile = rowTile(design, rowId);
    const large = !inGrid && design.featuredRow === rowId;
    const caption =
        tile === 'landscape' &&
        (design.namesOnArt === 'landscape' ||
            (design.namesOnArt === 'featured' && large));
    return {
        tile,
        large,
        caption,
        sub: !!design.tileSub,
        info: !!design.tileInfo,
    };
}

/** A Top 10 place's poster: no name under it, nothing over it. */
export const RANKED_DRESS: TileDress = {
    tile: 'poster',
    large: false,
    caption: false,
    sub: false,
    info: false,
};
