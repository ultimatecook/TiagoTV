import { feedTitle, groupChannelFamilies } from './channel-families';
import type { SportSectionId } from './sport-sections';
import type { SportChannel, SportsCatalog } from './sports-catalog';

/**
 * TiagoTV sports: a match no kept feed names (in Spain LaLiga airs on M+
 * LaLiga TV and DAZN LaLiga, whose names never carry the match; only the
 * French feeds list it) is offered on its competition's channels.
 */
export interface MatchChannel {
    /** The channel's name: "M+ LaLiga TV", "DAZN LaLiga". */
    readonly name: string;
    /** Its first feed, which plays. */
    readonly channel: SportChannel;
}

/**
 * The football competitions that are one competition each, so their
 * channels show their matches: not "Resto del mundo", basketball (NBA,
 * ACB, Euroleague), tennis or motor.
 */
export const SINGLE_COMPETITION_SECTIONS: ReadonlySet<SportSectionId> =
    new Set<SportSectionId>([
        'premier-league',
        'laliga',
        'serie-a',
        'ligue-1',
        'bundesliga',
        'champions-league',
        'europa-league',
        'liga-argentina',
        'libertadores',
        'hypermotion',
        'mls',
        'eredivisie',
    ]);

/** Channels named after one event ("UEFA | 13 - Aston Villa vs Ajax"). */
const EVENT_NAMED = /\bvs?\b|@/;
/** Pay-per-view passes, whose numbered feeds carry anything. */
const PASS = /\bppv\b|\+$/;
/** The broadcasters' own channels, by family key (see channel-families). */
const BROADCASTER =
    /^(m\+ |dazn\b|sky sports\b|espn\b|fox sports\b|tnt sports\b|tyc sports\b|directv sports\b|bein sports\b|eurosport\b)/;
/** How many of a competition's channels a match offers. */
const OFFERED = 4;

/**
 * A competition's channels, the broadcasters' first (M+ LaLiga TV, DAZN
 * LaLiga), then the others, the pay-per-view passes last; each as its
 * first feed.
 */
export function competitionChannels(
    channels: readonly SportChannel[]
): MatchChannel[] {
    return groupChannelFamilies(channels)
        .filter((family) => !EVENT_NAMED.test(family.key))
        .map((family) => ({ family, rank: familyRank(family.key) }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, OFFERED)
        .map(({ family }) => {
            const channel = family.feeds[0].channels[0];
            return {
                name: family.name,
                channel: { ...channel, title: feedTitle(family, channel) },
            };
        });
}

/**
 * Each channel's copies, by stream id: the HD and SD streams of its feed
 * ("M+ LaLigaTV FHD Orange", "|ES| M LA LIGA TV ᴴᴰ"), itself among them.
 */
export function channelCopies(
    channels: readonly SportChannel[]
): Map<number, readonly SportChannel[]> {
    const copies = new Map<number, readonly SportChannel[]>();
    for (const family of groupChannelFamilies(channels)) {
        for (const feed of family.feeds) {
            for (const channel of feed.channels) {
                copies.set(channel.streamId, feed.channels);
            }
        }
    }
    return copies;
}

/**
 * A competition's channel family, by how surely it shows its matches:
 * the broadcasters' own (0), the others (1), the pay-per-view passes (2).
 */
export function familyRank(key: string): number {
    return PASS.test(key) ? 2 : BROADCASTER.test(key) ? 0 : 1;
}

/**
 * The sections whose matches can be watched on their channels when no
 * kept feed names them: the ones other languages' fixtures are read for.
 */
export function sectionsWithChannels(
    catalog: SportsCatalog
): Set<SportSectionId> {
    const sections = new Set<SportSectionId>();
    SINGLE_COMPETITION_SECTIONS.forEach((id) => {
        if (competitionChannels(catalog[id]?.channels ?? []).length > 0) {
            sections.add(id);
        }
    });
    return sections;
}
