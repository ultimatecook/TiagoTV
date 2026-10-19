import type { CountryDefinition } from './countries';
import {
    mergeChannelGroups,
    type CountryChannelGroup,
} from './country-channels';
import {
    categoryTier,
    channelGenre,
    isGenericCategory,
    plainText,
    TIER_ORDER,
    type RowTier,
} from './country-genres';

/**
 * A country's rows on "Por países": one per meaningful group, its kinds in
 * order (see country-genres). A kind's own row ("Deportes", "Noticias")
 * holds the provider's category of that name, the channels of that kind
 * the country's main group mixes in (Argentina's lists ESPN, TN and
 * Cartoon Network with Telefe), and the kind's categories too small for
 * a row of their own. Every other category is a row, under its name. A
 * channel listed in several categories shows once, in the first row,
 * with every copy. The main row opens on the country's flagship channels.
 */
/** A translated label (`key`, with `params`), else the provider's `text`. */
export interface RowLabel {
    readonly key: string | null;
    readonly text: string;
    readonly params?: Readonly<Record<string, string>>;
}

export interface TvRow {
    readonly id: string;
    readonly tier: RowTier;
    readonly label: RowLabel;
    readonly channels: readonly CountryChannelGroup[];
}

/** A kept category of the country, with its channels (copies together). */
export interface FiledCategory {
    readonly id: string;
    /** Its readable name; null for the country's own group. */
    readonly label: string | null;
    /** One of Ireland's groups, folded into the United Kingdom. */
    readonly irish: boolean;
    readonly channels: readonly CountryChannelGroup[];
}

const ROWS = 'WORKSPACE.COUNTRIES.ROWS';
/** A category this small joins its kind's own row. */
export const POOL_MAX = 3;
/** Fewer channels of a kind stay in the main row, unless it has a row. */
const KIND_ROW_MIN = 3;

interface KindRow {
    own: CountryChannelGroup[];
    split: CountryChannelGroup[];
    small: CountryChannelGroup[];
}

/** The main groups, in the provider's order: their channels are sorted. */
type MainPart = { readonly mixed: readonly CountryChannelGroup[] };

export function buildCountryRows(
    country: CountryDefinition,
    categories: readonly FiledCategory[]
): TvRow[] {
    const kinds = new Map<RowTier, KindRow>();
    const kind = (tier: RowTier): KindRow => {
        let entry = kinds.get(tier);
        if (!entry) {
            entry = { own: [], split: [], small: [] };
            kinds.set(tier, entry);
        }
        return entry;
    };
    const main: MainPart[] = [];
    const specific: TvRow[] = [];
    const rowId = (category: FiledCategory) => `${country.id}:${category.id}`;

    for (const category of categories) {
        const { label, channels } = category;
        if (category.irish && /^ireland$/i.test(label ?? '')) {
            const ireland = rowKey('IRELAND');
            specific.push(row(rowId(category), 'main', ireland, channels));
            continue;
        }
        const tier = categoryTier(label);
        if (!category.irish && isGenericCategory(label, tier)) {
            if (tier === 'main') {
                main.push({ mixed: channels });
            } else {
                kind(tier).own.push(...channels);
            }
        } else if (channels.length <= POOL_MAX) {
            kind(tier).small.push(...channels);
        } else {
            specific.push(
                row(rowId(category), tier, rowLabel(label ?? ''), channels)
            );
        }
    }

    const moves = movingKinds(
        main,
        (tier) =>
            kinds.has(tier) || specific.some((entry) => entry.tier === tier)
    );
    for (const part of main) {
        for (const channel of part.mixed) {
            const genre = channelGenre(channel.title);
            if (genre && moves.has(genre)) {
                kind(genre).split.push(channel);
            } else {
                kind('main').own.push(channel);
            }
        }
    }

    // A kind of one channel and no row of its own: no row for one tile,
    // the channel joins the main ones.
    const lone = TIER_ORDER.filter((tier) => {
        const entry = kinds.get(tier);
        return (
            tier !== 'main' &&
            !!entry &&
            entry.own.length + entry.split.length + entry.small.length === 1 &&
            !specific.some((other) => other.tier === tier)
        );
    });
    for (const tier of lone) {
        const entry = kinds.get(tier) as KindRow;
        kind('main').small.push(...entry.own, ...entry.split, ...entry.small);
        kinds.delete(tier);
    }

    const ordered: TvRow[] = [];
    for (const tier of TIER_ORDER) {
        const own = kinds.get(tier);
        if (own) {
            const channels = [...own.own, ...own.split, ...own.small];
            ordered.push(
                row(
                    `${country.id}:${tier}`,
                    tier,
                    tierLabel(tier),
                    tier === 'main' ? leadingFirst(channels, country) : channels
                )
            );
        }
        ordered.push(...specific.filter((entry) => entry.tier === tier));
    }
    return withoutRepeats(ordered);
}

/** "Local - NBC" → "NBC locales"; the rest as the provider names it. */
export function rowLabel(label: string): RowLabel {
    const local = /^local\s*-\s*(.+)$/i.exec(label);
    if (local) {
        const network = local[1].trim();
        return /^misc$/i.test(network)
            ? rowKey('LOCAL_OTHER')
            : rowKey('LOCAL', { network });
    }
    if (/^timeshift\b/i.test(label)) {
        return rowKey('TIMESHIFT');
    }
    return { key: null, text: label };
}

function rowKey(
    name: string,
    params?: Readonly<Record<string, string>>
): RowLabel {
    return { key: `${ROWS}.${name}`, text: '', params };
}

/**
 * The kinds the main groups' channels move out to: a kind that has a row
 * anyway, or that gathers enough of them for one. A lone news channel
 * stays among the country's main channels.
 */
function movingKinds(
    main: readonly MainPart[],
    hasRow: (tier: RowTier) => boolean
): Set<RowTier> {
    const counts = new Map<RowTier, number>();
    for (const part of main) {
        for (const channel of part.mixed) {
            const genre = channelGenre(channel.title);
            if (genre) {
                counts.set(genre, (counts.get(genre) ?? 0) + 1);
            }
        }
    }
    const moving = new Set<RowTier>();
    counts.forEach((count, tier) => {
        if (hasRow(tier) || count >= KIND_ROW_MIN) {
            moving.add(tier);
        }
    });
    return moving;
}

/** The country's flagship channels first, in their order; then the rest. */
function leadingFirst(
    channels: readonly CountryChannelGroup[],
    country: CountryDefinition
): CountryChannelGroup[] {
    const leading = country.leading ?? [];
    const rank = (channel: CountryChannelGroup) => {
        const title = plainText(channel.title);
        const index = leading.findIndex((pattern) => pattern.test(title));
        return index < 0 ? leading.length : index;
    };
    return channels
        .map((channel, index) => ({ channel, index, rank: rank(channel) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map((entry) => entry.channel);
}

function tierLabel(tier: RowTier): RowLabel {
    return rowKey(tier.toUpperCase());
}

function row(
    id: string,
    tier: RowTier,
    label: RowLabel,
    channels: readonly CountryChannelGroup[]
): TvRow {
    return { id, tier, label, channels };
}

/**
 * Each channel once, in the first row that lists it, with the copies of
 * every row that does; rows left empty go.
 */
function withoutRepeats(rows: readonly TvRow[]): TvRow[] {
    const firstSeen = new Map<string, { row: number; index: number }>();
    const lists: CountryChannelGroup[][] = rows.map(() => []);
    rows.forEach((entry, rowIndex) => {
        for (const channel of entry.channels) {
            const seen = firstSeen.get(channel.key);
            if (seen) {
                const list = lists[seen.row];
                list[seen.index] = mergeChannelGroups(
                    list[seen.index],
                    channel
                );
                continue;
            }
            firstSeen.set(channel.key, {
                row: rowIndex,
                index: lists[rowIndex].length,
            });
            lists[rowIndex].push(channel);
        }
    });
    return rows
        .map((entry, index) => ({ ...entry, channels: lists[index] }))
        .filter((entry) => entry.channels.length > 0);
}
