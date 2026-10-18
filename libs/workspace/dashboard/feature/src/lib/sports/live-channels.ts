import {
    brandOfFamily,
    CHANNEL_BRANDS,
    type ChannelBrand,
} from '@iptvnator/portal/shared/util';
import {
    categoryLanguageCode,
    isSpanishOrEnglishCategory,
} from '@iptvnator/shared/interfaces';
import {
    feedTitle,
    groupChannelFamilies,
    type ChannelFamily,
} from './channel-families';
import {
    isIdleEventChannel,
    isStaleSlot,
    parseSportEvent,
} from './sport-events';
import {
    cleanChannelTitle,
    type SportChannel,
    type SportsCatalogCategory,
    type SportsCatalogStream,
} from './sports-catalog';

/**
 * The brands (ESPN, FOX Sports…) live in `@iptvnator/portal/shared/util`,
 * which the live player's "other feeds" strip reads too.
 */
export type LiveChannelBrand = ChannelBrand;
export const LIVE_CHANNEL_BRANDS = CHANNEL_BRANDS;
export { brandOfFamily };

/**
 * TiagoTV's "Canales en vivo": the Home's row of sports channels that are
 * always on (ESPN, FOX Sports, TyC Sports…), one tile per brand the source
 * carries in Spanish or English. A tile plays the brand's main feed.
 */
export interface LiveChannelTile {
    readonly brand: LiveChannelBrand;
    /** The feed the tile plays. */
    readonly channel: SportChannel;
    /** The provider's logo, for brands without a bundled one. */
    readonly icon: string | null;
}

/** A cheap look at the name before the full family parse. */
const BRAND_HINT =
    /espn|fox|tyc|tnt|direc|d ?sports|dazn|deportes|liga|lcampeon|bein|sky|eurosport|nba/i;
/** Portuguese feeds filed among the Latin American ones. */
const BRAZIL = /bra[sz]il/i;

export function buildLiveChannels(
    categories: readonly SportsCatalogCategory[],
    streams: readonly SportsCatalogStream[],
    now = new Date()
): LiveChannelTile[] {
    const kept = new Map<string, string>();
    for (const category of categories) {
        if (isSpanishOrEnglishCategory(category.category_name, 'live')) {
            kept.set(String(category.category_id), category.category_name);
        }
    }

    const channels: SportChannel[] = [];
    const ranks = new Map<SportChannel, number>();
    for (const stream of streams) {
        const categoryId = String(stream.category_id ?? '');
        const categoryName = kept.get(categoryId);
        const streamId = Number(stream.stream_id);
        if (
            categoryName === undefined ||
            !Number.isFinite(streamId) ||
            !BRAND_HINT.test(stream.name) ||
            BRAZIL.test(stream.name) ||
            parseSportEvent(stream.name) ||
            isIdleEventChannel(stream.name)
        ) {
            continue;
        }
        const channel: SportChannel = {
            streamId,
            categoryId,
            title: cleanChannelTitle(stream.name),
            icon: stream.stream_icon || null,
        };
        if (!isStaleSlot(channel.title, now)) {
            channels.push(channel);
            ranks.set(channel, regionRank(categoryName));
        }
    }

    const families = groupChannelFamilies(channels);
    const tiles: LiveChannelTile[] = [];
    for (const brand of LIVE_CHANNEL_BRANDS) {
        const family = mainFamily(brand, families);
        if (family) {
            // The family's lowest feed, from the nearest region.
            const channel = [...family.feeds[0].channels].sort(
                (a, b) => (ranks.get(a) ?? 9) - (ranks.get(b) ?? 9)
            )[0];
            tiles.push({
                brand,
                channel: { ...channel, title: feedTitle(family, channel) },
                icon: family.icons[0] ?? null,
            });
        }
    }
    return tiles;
}

function mainFamily(
    brand: LiveChannelBrand,
    families: readonly ChannelFamily[]
): ChannelFamily | null {
    for (const pattern of brand.families) {
        const family = families.find((candidate) =>
            pattern.test(candidate.key)
        );
        if (family) {
            return family;
        }
    }
    return null;
}

/**
 * Argentina's feeds first (TiagoTV's owner), then Spain's, the rest of
 * Latin America's, and the English ones last.
 */
function regionRank(categoryName: string): number {
    const code = categoryLanguageCode(categoryName);
    if (code === 'LAT') {
        return /argentin/i.test(categoryName) ? 0 : 2;
    }
    return code === 'ES' ? 1 : 3;
}
