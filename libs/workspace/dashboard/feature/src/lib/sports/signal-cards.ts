import { brandOfFamily } from '@iptvnator/portal/shared/util';
import {
    feedTitle,
    parseChannelName,
    type ChannelFamily,
} from './channel-families';
import { familyRank } from './match-channels';
import type { MatchFeed } from './match-feeds';
import type { SportChannel, SportMatch } from './sports-catalog';

/**
 * The "CANALES" row of a competition's page: one glass card per signal.
 * First the feeds of the matches on now that have one of their own
 * ("Live | Leeds United - Manchester United | Premier League | ES"), then
 * every numbered feed of the competition's channels ("DAZN LaLiga 1…5",
 * "M+ LaLiga TV"), the broadcasters' first and the pay-per-view passes
 * last. A card plays its signal on the page.
 */
export interface SignalCard {
    readonly key: string;
    /** "DAZN LaLiga 2", "Premier League PPV". */
    readonly name: string;
    /** The feed's number, on a channel with several. */
    readonly number: number | null;
    readonly channel: SportChannel;
    /** The logos to try, best first: the bundled brand's, the provider's. */
    readonly logos: readonly string[];
    /** The match on the signal, when its name says it. */
    readonly match: SportMatch | null;
    /** One of the signals of the match in focus (see `feedCards`). */
    readonly feed?: MatchFeed;
}

/**
 * "Señales de este partido": one card per signal that carries `match`, in
 * any language, in its feeds' order (see match-feeds).
 */
export function feedCards(match: SportMatch): SignalCard[] {
    return (match.feeds ?? []).map((feed) => {
        const brand = brandOfFamily(parseChannelName(feed.name).key);
        const icon = feed.channel.icon;
        return {
            key: `feed:${feed.channel.streamId}`,
            name: feed.name,
            number: feed.number,
            channel: feed.channel,
            logos: [
                ...(brand?.logo ? [brand.logo] : []),
                ...(icon ? [icon] : []),
            ],
            match,
            feed,
        };
    });
}

export function signalCards(
    families: readonly ChannelFamily[],
    liveMatches: readonly SportMatch[]
): SignalCard[] {
    const cards: SignalCard[] = [];
    const seen = new Set<number>();
    for (const match of liveMatches) {
        // A match on its competition's channels has no feed of its own.
        if (match.via.length > 0 || seen.has(match.streamId)) {
            continue;
        }
        seen.add(match.streamId);
        cards.push({
            key: `match:${match.key}`,
            name: match.channelName || match.title,
            number: null,
            channel: {
                streamId: match.streamId,
                categoryId: match.categoryId,
                title: match.title,
                icon: match.icon,
            },
            logos: match.icon ? [match.icon] : [],
            match,
        });
    }
    const ranked = families
        .map((family, index) => ({
            family,
            index,
            rank: familyRank(family.key),
        }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index);
    for (const { family } of ranked) {
        const brand = brandOfFamily(family.key);
        const logos = [...(brand?.logo ? [brand.logo] : []), ...family.icons];
        const numbered = family.feeds.length > 1;
        for (const feed of family.feeds) {
            const channel = feed.channels[0];
            if (!channel || seen.has(channel.streamId)) {
                continue;
            }
            seen.add(channel.streamId);
            cards.push({
                key: `${family.key}#${feed.number}`,
                name: numbered ? `${family.name} ${feed.number}` : family.name,
                number: numbered ? feed.number : null,
                channel: { ...channel, title: feedTitle(family, channel) },
                logos,
                match: null,
            });
        }
    }
    return cards;
}
