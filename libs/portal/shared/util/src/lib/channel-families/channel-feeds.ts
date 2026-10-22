import {
    categoryLanguageCode,
    isEventChannelName,
    isIdleEventChannel,
} from '@iptvnator/shared/interfaces';
import {
    brandFamilyRank,
    brandOfFamily,
    type ChannelBrand,
} from './channel-brands';
import {
    channelFamilyName,
    groupChannelFamilies,
    hasWhiteLogo,
    knownFamilyName,
    parseChannelName,
    type ChannelFamily,
    type ChannelFeed,
    type FamilyChannel,
} from './channel-families';

/**
 * TiagoTV's "other feeds" under the live player: when ESPN does not start,
 * the brand's other feeds, and the other copies of the one playing, are a
 * click away. The playing channel's country comes first (Argentina's ESPN,
 * ESPN 2, ESPN+…), then the same brand from the other countries the source
 * keeps.
 */
export type FeedRegion = 'AR' | 'ES' | 'US' | 'GB';

export interface FeedCandidate extends FamilyChannel {
    /** The provider's stream id. */
    readonly id: number;
    /** The country its category files it under; null when untagged. */
    readonly region: FeedRegion | null;
}

export interface ChannelFeedOption<T extends FeedCandidate = FeedCandidate> {
    readonly channel: T;
    /** "ESPN 2", "ESPN Premium". */
    readonly label: string;
    /** 1 for the copy a feed plays first, 2… for its other copies. */
    readonly copy: number;
    readonly current: boolean;
    /** Whether its logo is drawn in white (see hasWhiteLogo). */
    readonly whiteIcon: boolean;
}

export interface ChannelFeedRegion<T extends FeedCandidate = FeedCandidate> {
    readonly region: FeedRegion | null;
    readonly options: readonly ChannelFeedOption<T>[];
}

export interface ChannelFeedGroup<T extends FeedCandidate = FeedCandidate> {
    /** The brand's id, else the family's key. */
    readonly key: string;
    /** "ESPN", "LaLiga TV Hypermotion". */
    readonly name: string;
    readonly brand: ChannelBrand | null;
    /** The provider's logo most of the group carries. */
    readonly icon: string | null;
    /** Whether that logo is drawn in white (see hasWhiteLogo). */
    readonly whiteIcon: boolean;
    /** The playing channel's country first. */
    readonly regions: readonly ChannelFeedRegion<T>[];
    /** How many options there are besides the one playing. */
    readonly alternatives: number;
}

/** After the playing channel's own country: Argentina's, Spain's… */
const REGION_ORDER: readonly (FeedRegion | null)[] = [
    'AR',
    'ES',
    'US',
    'GB',
    null,
];

/**
 * A numbered slot with nothing on it ("NBA 13 :", ":NBA 13", "UEFA | 15 -"),
 * as the Home's sports catalog reads them.
 */
const EMPTY_SLOT =
    /^\s*(:\s*[a-z]{2,6}\s*\d{1,2}|[a-z]{2,6}\s*\d{1,2}\s*[:|]|[a-z]{2,6}\s*\|\s*\d{1,2}\s*-?)\s*$/i;

/**
 * The country a live category files its channels under: "|LAT|  ✪
 * ARGENTINA" is Argentina, "|UK| ✪ SPORTS" the United Kingdom.
 */
export function feedRegionOfCategory(name: string): FeedRegion | null {
    switch (categoryLanguageCode(name)) {
        case 'LAT':
            return /\bargentin/i.test(name) ? 'AR' : null;
        case 'ES':
            return 'ES';
        case 'US':
            return 'US';
        case 'UK':
            return 'GB';
        default:
            return null;
    }
}

/** A channel that is always on: not a match's event slot. */
export function isFeedChannel(title: string): boolean {
    return (
        !isEventChannelName(title) &&
        !isIdleEventChannel(title) &&
        !EMPTY_SLOT.test(title)
    );
}

/**
 * The feeds `current` can switch to: every channel of its brand (or, for
 * a channel no brand claims, of its family), by country, family and feed.
 * The feed playing lists all its copies; another feed, the copy it plays
 * first (its own copies follow once it plays). Null when there is nothing
 * to switch to.
 */
export function channelFeedGroup<T extends FeedCandidate>(
    current: T,
    candidates: readonly T[]
): ChannelFeedGroup<T> | null {
    const key = familyKeyOf(current);
    if (key === null) {
        return null;
    }
    const brand = brandOfFamily(key);
    const belongs = (familyKey: string | null) =>
        familyKey !== null &&
        (brand ? brand.owns.test(familyKey) : familyKey === key);

    // The provider's order, the playing channel in its place, so a feed's
    // copies keep their numbers whichever of them plays.
    let playing: T | null = null;
    const byRegion = new Map<FeedRegion | null, T[]>();
    const add = (channel: T) => {
        const members = byRegion.get(channel.region) ?? [];
        members.push(channel);
        byRegion.set(channel.region, members);
    };
    for (const candidate of candidates) {
        if (candidate.id === current.id) {
            playing = candidate;
            add(candidate);
        } else if (belongs(familyKeyOf(candidate))) {
            add(candidate);
        }
    }
    if (!playing) {
        playing = current;
        add(current);
    }
    const first = playing.region;

    const regions = [...byRegion.entries()]
        .sort(([a], [b]) => regionRank(a, first) - regionRank(b, first))
        .map(([region, members]) => ({
            region,
            options: familyOptions(
                orderFamilies(groupChannelFamilies(members), brand),
                current.id
            ),
        }));
    const options = regions.reduce<ChannelFeedOption<T>[]>(
        (all, region) => all.concat(region.options),
        []
    );
    if (options.length < 2) {
        return null;
    }

    const own = options.find((option) => option.current);
    const icon =
        own?.channel.icon ??
        options.find((option) => option.channel.icon)?.channel.icon ??
        null;
    return {
        key: brand?.id ?? key,
        name:
            brand?.name ??
            knownFamilyName(key) ??
            own?.label ??
            channelFamilyName(key, [current.title]),
        brand,
        icon,
        whiteIcon: hasWhiteLogo(key, icon),
        regions,
        alternatives: options.length - 1,
    };
}

/**
 * "ESPN 2": the family's name and the feed's number; the first feed goes
 * without it unless its copies name it ("FOX Sports 1").
 */
export function feedLabel(
    family: Pick<ChannelFamily, 'name'>,
    feed: ChannelFeed
): string {
    const numbered =
        feed.number !== 1 ||
        feed.channels.some(
            (channel) => parseChannelName(channel.title).feed === 1
        );
    return numbered ? `${family.name} ${feed.number}` : family.name;
}

/**
 * Each candidate's family key, or null for an event slot: a catalog's
 * thousands of names are read once, not on every channel switch.
 */
const familyKeys = new WeakMap<FeedCandidate, string | null>();

function familyKeyOf(candidate: FeedCandidate): string | null {
    let key = familyKeys.get(candidate);
    if (key === undefined) {
        key = isFeedChannel(candidate.title)
            ? parseChannelName(candidate.title).key
            : null;
        familyKeys.set(candidate, key);
    }
    return key;
}

function regionRank(
    region: FeedRegion | null,
    first: FeedRegion | null
): number {
    return region === first ? -1 : REGION_ORDER.indexOf(region);
}

/** The brand's main families first (its own order), then by name. */
function orderFamilies<T extends FeedCandidate>(
    families: ChannelFamily<T>[],
    brand: ChannelBrand | null
): ChannelFamily<T>[] {
    return families.sort(
        (a, b) =>
            (brand
                ? brandFamilyRank(brand, a.key) - brandFamilyRank(brand, b.key)
                : 0) || a.name.localeCompare(b.name)
    );
}

function familyOptions<T extends FeedCandidate>(
    families: readonly ChannelFamily<T>[],
    currentId: number
): ChannelFeedOption<T>[] {
    const options: ChannelFeedOption<T>[] = [];
    for (const family of families) {
        for (const feed of family.feeds) {
            const label = feedLabel(family, feed);
            const playing = feed.channels.some(
                (channel) => channel.id === currentId
            );
            const copies = playing ? feed.channels : feed.channels.slice(0, 1);
            copies.forEach((channel, index) =>
                options.push({
                    channel,
                    label,
                    copy: index + 1,
                    current: channel.id === currentId,
                    whiteIcon: hasWhiteLogo(family.key, channel.icon),
                })
            );
        }
    }
    return options;
}
