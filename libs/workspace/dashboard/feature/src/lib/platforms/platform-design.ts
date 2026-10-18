import type { StreamingPlatformId } from './streaming-platforms';

/**
 * How a platform's page is drawn, after the platform's own app: Netflix's
 * black billboard and 16:9 tiles with a Top 10, Prime Video's navy
 * carousel, HBO Max's posters on black and indigo, Apple TV's large
 * rounded cards. The rest keep TiagoTV's own card hero and posters, in
 * their colour.
 */
export type PlatformLook = 'netflix' | 'prime' | 'hbo' | 'apple' | 'default';

export interface PlatformDesign {
    readonly look: PlatformLook;
    /** A full-bleed billboard, Prime's rounded carousel or the Home's card. */
    readonly hero: 'billboard' | 'carousel' | 'card';
    /** The rows' tiles: 16:9 artwork or 2:3 posters. */
    readonly tiles: 'landscape' | 'poster';
    /** Netflix's "Top 10" row, with the big outlined numbers. */
    readonly top10: boolean;
    /** The row heading's link to the whole list. */
    readonly seeAllKey: string;
}

const DEFAULT_DESIGN: PlatformDesign = {
    look: 'default',
    hero: 'card',
    tiles: 'poster',
    top10: false,
    seeAllKey: 'WORKSPACE.PLATFORMS.SEE_ALL',
};

const DESIGNS: Partial<Record<StreamingPlatformId, PlatformDesign>> = {
    netflix: {
        look: 'netflix',
        hero: 'billboard',
        tiles: 'landscape',
        top10: true,
        seeAllKey: 'WORKSPACE.PLATFORMS.EXPLORE_ALL',
    },
    'prime-video': {
        look: 'prime',
        hero: 'carousel',
        tiles: 'landscape',
        top10: false,
        seeAllKey: 'WORKSPACE.PLATFORMS.SEE_MORE',
    },
    'hbo-max': {
        look: 'hbo',
        hero: 'billboard',
        tiles: 'poster',
        top10: false,
        seeAllKey: 'WORKSPACE.PLATFORMS.SEE_ALL',
    },
    'apple-tv': {
        look: 'apple',
        hero: 'billboard',
        tiles: 'landscape',
        top10: false,
        seeAllKey: 'WORKSPACE.PLATFORMS.SEE_ALL',
    },
};

export function platformDesign(id: StreamingPlatformId): PlatformDesign {
    return DESIGNS[id] ?? DEFAULT_DESIGN;
}
