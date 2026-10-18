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
 * TiagoTV's "Canales en vivo": the Home's row of sports channels that are
 * always on (ESPN, FOX Sports, TyC Sports…), one tile per brand the source
 * carries in Spanish or English. A tile plays the brand's main feed.
 */
export interface LiveChannelBrand {
    readonly id: string;
    readonly name: string;
    /** The bundled logo, in white; null where the provider's logo shows. */
    readonly logo: string | null;
    /** The logo's size against the others, so they look even. */
    readonly logoSize?: number;
    readonly background: string;
    /**
     * The brand's channel families (see channel-families), most wanted
     * first: the first one the source carries plays.
     */
    readonly families: readonly RegExp[];
    /** Every family of the brand, for the logo of a competition's channel. */
    readonly owns: RegExp;
}

export interface LiveChannelTile {
    readonly brand: LiveChannelBrand;
    /** The feed the tile plays. */
    readonly channel: SportChannel;
    /** The provider's logo, for brands without a bundled one. */
    readonly icon: string | null;
}

const LOGOS = './assets/channels/';

export const LIVE_CHANNEL_BRANDS: readonly LiveChannelBrand[] = [
    {
        id: 'espn',
        name: 'ESPN',
        logo: `${LOGOS}espn.png`,
        logoSize: 0.88,
        background: 'linear-gradient(140deg, #2a0306 0%, #b0101c 100%)',
        families: [/^espn$/, /^espn (premium|extra)$/],
        owns: /^espn\b/,
    },
    {
        id: 'fox-sports',
        name: 'FOX Sports',
        logo: `${LOGOS}fox-sports.png`,
        logoSize: 1.18,
        background: 'linear-gradient(140deg, #020b1f 0%, #0d3c8f 100%)',
        families: [/^fox sports$/, /^fox sports premium$/],
        owns: /^fox sports\b/,
    },
    {
        id: 'tyc-sports',
        name: 'TyC Sports',
        logo: `${LOGOS}tyc-sports.png`,
        background: 'linear-gradient(140deg, #071a4a 0%, #c4122f 120%)',
        families: [/^tyc sports$/, /^tyc sports internacional$/],
        owns: /^tyc sports\b/,
    },
    {
        id: 'tnt-sports',
        name: 'TNT Sports',
        logo: `${LOGOS}tnt-sports.png`,
        background: 'linear-gradient(140deg, #050505 0%, #34343a 100%)',
        families: [/^tnt sports$/, /^tnt sports premium$/],
        owns: /^tnt sports\b/,
    },
    {
        id: 'dsports',
        name: 'DSports',
        logo: `${LOGOS}dsports.svg`,
        background: 'linear-gradient(140deg, #00122b 0%, #005eb8 100%)',
        families: [/^directv sports$/, /^directv sports plus$/],
        owns: /^directv sports\b/,
    },
    {
        id: 'dazn',
        name: 'DAZN',
        logo: `${LOGOS}dazn.png`,
        logoSize: 1.12,
        background: 'linear-gradient(140deg, #050505 0%, #23251a 100%)',
        families: [/^dazn$/],
        owns: /^dazn\b/,
    },
    {
        id: 'movistar-plus',
        name: 'Movistar+',
        logo: `${LOGOS}movistar-plus.png`,
        logoSize: 0.86,
        background: 'linear-gradient(140deg, #001a33 0%, #0a68c4 100%)',
        families: [/^m\+ deportes$/, /^m\+ laliga$/, /^m\+ liga de campeones$/],
        owns: /^m\+ /,
    },
    {
        id: 'bein-sports',
        name: 'beIN Sports',
        logo: `${LOGOS}bein-sports.png`,
        background: 'linear-gradient(140deg, #1b0633 0%, #5a2096 100%)',
        families: [/^bein sports$/],
        owns: /^bein sports\b/,
    },
    {
        id: 'sky-sports',
        name: 'Sky Sports',
        logo: `${LOGOS}sky-sports.png`,
        logoSize: 0.92,
        background: 'linear-gradient(140deg, #08103a 0%, #c0102a 120%)',
        families: [
            /^sky sports main event$/,
            /^sky sports premier league$/,
            /^sky sports football$/,
            /^sky sports (f1|tennis|golf|cricket|action|arena|mix|nfl|racing)$/,
        ],
        owns: /^sky sports\b/,
    },
    {
        id: 'eurosport',
        name: 'Eurosport',
        logo: `${LOGOS}eurosport.png`,
        logoSize: 0.94,
        background: 'linear-gradient(140deg, #050a3a 0%, #2131c9 100%)',
        families: [/^eurosport$/],
        owns: /^eurosport\b/,
    },
    {
        id: 'nba-tv',
        name: 'NBA TV',
        logo: `${LOGOS}nba-tv.png`,
        logoSize: 1.05,
        background: 'linear-gradient(140deg, #0a1a3d 0%, #1d428a 100%)',
        families: [/^nba$/],
        owns: /^nba\b/,
    },
];

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

/** The brand a channel family belongs to, if any. */
export function brandOfFamily(key: string): LiveChannelBrand | null {
    return LIVE_CHANNEL_BRANDS.find((brand) => brand.owns.test(key)) ?? null;
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
