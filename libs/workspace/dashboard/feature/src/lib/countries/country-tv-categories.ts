import type { TvCountry } from './countries-catalog';
import type { CountryChannelGroup } from './country-channels';
import type { RowTier } from './country-genres';
import type { TvRow } from './country-rows';

/**
 * "En vivo"'s category chips and its row of channel cards, built on a
 * country's rows (see country-rows): a chip per kind of row, sports
 * first, each with its count of channels, after "All", which opens on the
 * country's main channels (La 1, BBC One), then sports and their live
 * events, then the rest. A card keeps its row, which the player's
 * selection names.
 */
export type TvCategoryId = 'all' | RowTier;

export interface TvCategory {
    readonly id: TvCategoryId;
    readonly labelKey: string;
    readonly count: number;
}

export interface TvCard {
    readonly row: TvRow;
    readonly channel: CountryChannelGroup;
}

/** The chips' order: sports and their live events, then the rest. */
export const CATEGORY_ORDER: readonly RowTier[] = [
    'sports',
    'events',
    'main',
    'news',
    'movies',
    'kids',
    'documentary',
    'music',
    'more',
    'copies',
];

/** "All"'s order: the main channels, then the chips' order. */
export const ALL_ORDER: readonly RowTier[] = [
    'main',
    ...CATEGORY_ORDER.filter((tier) => tier !== 'main'),
];

const CATEGORIES = 'WORKSPACE.COUNTRIES.CATEGORIES';

export function countryCategories(country: TvCountry): TvCategory[] {
    const counts = new Map<RowTier, number>();
    for (const row of country.rows) {
        counts.set(row.tier, (counts.get(row.tier) ?? 0) + row.channels.length);
    }
    const kinds: TvCategory[] = [];
    for (const tier of CATEGORY_ORDER) {
        const count = counts.get(tier) ?? 0;
        if (count > 0) {
            kinds.push({ id: tier, labelKey: labelKey(tier), count });
        }
    }
    return [
        { id: 'all', labelKey: labelKey('all'), count: country.channelCount },
        ...kinds,
    ];
}

export function countryCards(
    country: TvCountry,
    category: TvCategoryId
): TvCard[] {
    const tiers = category === 'all' ? ALL_ORDER : [category];
    const cards: TvCard[] = [];
    for (const tier of tiers) {
        for (const row of country.rows) {
            if (row.tier === tier) {
                for (const channel of row.channels) {
                    cards.push({ row, channel });
                }
            }
        }
    }
    return cards;
}

/** Whether a country has a chip for `category` (not every country does). */
export function hasCategory(
    categories: readonly TvCategory[],
    category: TvCategoryId
): boolean {
    return categories.some((entry) => entry.id === category);
}

function labelKey(category: TvCategoryId): string {
    return `${CATEGORIES}.${category.toUpperCase()}`;
}
