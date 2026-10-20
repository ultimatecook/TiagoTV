import type {
    PlatformCategory,
    PlatformShelf,
    PlatformTitleKind,
    StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';

/**
 * The order the platforms' categories load in: the platforms TiagoTV's
 * owner watches first (Netflix, Prime Video, HBO Max, Disney+), then the
 * rest in the shelves' order; and the kinds taking turns (a movie list, a
 * series list, …), so "Top 10 películas" and "Series para ti" both fill
 * from the first lists instead of one waiting for every list of the other.
 */
export const FIRST_PLATFORMS: readonly string[] = ['netflix', 'prime-video', 'hbo-max', 'disney-plus'];

export interface OrderedCategory {
    readonly platform: StreamingPlatform;
    readonly category: PlatformCategory;
}

function rankOf(platform: StreamingPlatform, shelfIndex: number): number {
    const first = FIRST_PLATFORMS.indexOf(platform.id);
    return first >= 0 ? first : FIRST_PLATFORMS.length + shelfIndex;
}

export function loadOrder(
    shelves: readonly PlatformShelf[],
    kinds: readonly PlatformTitleKind[],
    platformId?: string
): OrderedCategory[] {
    const ranked = shelves
        .map((shelf, index) => ({ shelf, rank: rankOf(shelf.platform, index) }))
        .filter(({ shelf }) => !platformId || shelf.platform.id === platformId)
        .sort((a, b) => a.rank - b.rank);
    const lists = kinds.map((kind) => {
        const list: OrderedCategory[] = [];
        for (const { shelf } of ranked) {
            for (const category of shelf.categories) {
                if (category.kind === kind) {
                    list.push({ platform: shelf.platform, category });
                }
            }
        }
        return list;
    });
    const order: OrderedCategory[] = [];
    const longest = lists.reduce((most, list) => Math.max(most, list.length), 0);
    for (let i = 0; i < longest; i++) {
        for (const list of lists) {
            if (i < list.length) {
                order.push(list[i]);
            }
        }
    }
    return order;
}
