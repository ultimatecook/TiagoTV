import {
    channelFamilyName,
    parseChannelName,
} from '@iptvnator/portal/shared/util';
import { feedLanguage } from './feed-languages';
import type { MatchChannel } from './match-channels';
import type { EventSlot } from './match-fixtures';
import type { SportChannel } from './sports-catalog';
import { isSameTeam } from './team-names';

/**
 * TiagoTV sports: every signal that carries a match, in any language. When
 * the Spanish feeds of a big match are overloaded and drop, a French or an
 * English one is better than nothing: the match's page lists them all
 * (`SportMatch.feeds`), Argentina's and Spain's first, then the rest of
 * Latin America's, then the English ones, then every other language; in
 * each, the feeds whose name carries the match before the competition's
 * channels that may show it (`via`), the HD copies before the SD ones.
 */
export type FeedQuality = 'UHD' | 'FHD' | 'HD' | 'SD';

export { feedLanguage } from './feed-languages';

export interface MatchFeed {
    readonly channel: SportChannel;
    /** "DAZN", "UEFA Champions League", "Movistar Liga de Campeones". */
    readonly name: string;
    /** The slot's number on a numbered listing ("UEFA | 13 - …"). */
    readonly number: number | null;
    /**
     * Its language or country: the provider's code ("ES", "UK", "FR"; "AR"
     * is Arabic), "ARG" for Argentina and Latin America's countries' own
     * ISO codes ("MX", "BR") from |LAT|.
     */
    readonly language: string;
    /** In Spanish: "España", "Inglés (UK)", "Francés"; else the code. */
    readonly label: string;
    /** The bundled flag's country ("es", "gb"), where there is one. */
    readonly flag: string | null;
    /**
     * Its name carries the match; false for the competition's channels
     * that may show it (the match's `via`).
     */
    readonly named: boolean;
    readonly quality: FeedQuality | null;
}

/**
 * A channel that is not an event slot but names a match: "UEFA | 13 -
 * Aston Villa vs Ajax 20:00 pm", "Scottish Cup 3: Celtic vs Hibernian".
 */
export interface NamedChannel {
    readonly channel: SportChannel;
    readonly categoryName: string;
    /** Both sides' team keys (see team-names). */
    readonly home: string;
    readonly away: string;
    readonly number: number | null;
    readonly quality: FeedQuality | null;
}

/** A feed's quality, from the provider's name ("ᴴᴰ", "FHD", "SD"). */
export function feedQuality(name: string): FeedQuality | null {
    if (/ᵁᴴᴰ|\b(uhd|4k|8k)\b/i.test(name)) {
        return 'UHD';
    }
    if (/\bfhd\b/i.test(name)) {
        return 'FHD';
    }
    if (/ᴴᴰ|\bhd\b/i.test(name)) {
        return 'HD';
    }
    return /ˢᴰ|\bsd\b/i.test(name) ? 'SD' : null;
}

/** "|ES| ✪ PREMIER LEAGUE PPV" → "Premier League PPV", "|ES| ✪ DAZN EVENT" → "DAZN". */
export function categoryChannelName(categoryName: string): string | null {
    const name = categoryName
        .replace(/[✪★☆]/g, ' ')
        .replace(/\b(solo )?event(o)?s?\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const { key } = parseChannelName(name);
    return key ? channelFamilyName(key, [name]) : null;
}

interface FeedSource {
    readonly channel: SportChannel;
    readonly categoryName: string;
    readonly name: string;
    readonly number: number | null;
    readonly named: boolean;
    readonly quality: FeedQuality | null;
}

/** What a match's feeds are read from besides its slots. */
export interface FeedContext {
    /** The channels that name a match without being its event slots. */
    readonly named: readonly NamedChannel[];
    /** Every category's name, by id. */
    readonly categoryNames: ReadonlyMap<string, string>;
    /** A `via` channel's copies (its HD and SD streams), itself among them. */
    readonly copiesOf: (option: MatchChannel) => readonly SportChannel[];
    readonly qualityOf: (streamId: number) => FeedQuality | null;
}

/** The copies of one `via` channel a match lists, the best first. */
const VIA_COPIES = 2;

/**
 * A match's feeds: its event slots in every language, the channels that
 * name it, and the competition's channels it is offered on (`via`), each
 * with up to VIA_COPIES of its copies.
 */
export function matchFeeds(
    slots: readonly EventSlot[],
    teams: readonly [string, string] | null,
    via: readonly MatchChannel[],
    context: FeedContext
): MatchFeed[] {
    const sources: FeedSource[] = slots.map((slot) => ({
        channel: slot.channel,
        categoryName: slot.categoryName,
        name: categoryChannelName(slot.categoryName) ?? slot.channel.title,
        number: null,
        named: true,
        quality: slot.quality ?? null,
    }));
    for (const channel of teams ? context.named : []) {
        if (
            teams &&
            isSameTeam(teams[0], channel.home) &&
            isSameTeam(teams[1], channel.away)
        ) {
            sources.push({
                channel: channel.channel,
                categoryName: channel.categoryName,
                name:
                    categoryChannelName(channel.categoryName) ??
                    channel.channel.title,
                number: channel.number,
                named: true,
                quality: channel.quality,
            });
        }
    }
    for (const option of via) {
        for (const copy of viaCopies(option, context)) {
            sources.push({
                channel: { ...copy, title: option.channel.title },
                categoryName: context.categoryNames.get(copy.categoryId) ?? '',
                name: option.name,
                number: null,
                named: false,
                quality: context.qualityOf(copy.streamId),
            });
        }
    }
    return orderFeeds(sources);
}

/** The option's best copies, and the one it plays by default. */
function viaCopies(option: MatchChannel, context: FeedContext): SportChannel[] {
    const rank = (channel: SportChannel) =>
        qualityRank(context.qualityOf(channel.streamId));
    const best = [...context.copiesOf(option)]
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, VIA_COPIES);
    return best.some((copy) => copy.streamId === option.channel.streamId)
        ? best
        : [option.channel, ...best.slice(0, VIA_COPIES - 1)];
}

/** HD first; 4K, heavier, with the copies whose name says nothing. */
const QUALITY_RANK: Record<FeedQuality, number> = {
    FHD: 0,
    HD: 0,
    UHD: 1,
    SD: 2,
};

/** In the owner's order (see above), each stream once. */
function orderFeeds(sources: readonly FeedSource[]): MatchFeed[] {
    const ranked = sources.map((source, index) => ({
        source,
        index,
        language: feedLanguage(source.categoryName),
    }));
    ranked.sort(
        (a, b) =>
            a.language.group - b.language.group ||
            a.language.order - b.language.order ||
            a.language.code.localeCompare(b.language.code) ||
            Number(!a.source.named) - Number(!b.source.named) ||
            qualityRank(a.source.quality) - qualityRank(b.source.quality) ||
            a.index - b.index
    );
    const seen = new Set<number>();
    const feeds: MatchFeed[] = [];
    for (const { source, language } of ranked) {
        if (seen.has(source.channel.streamId)) {
            continue;
        }
        seen.add(source.channel.streamId);
        feeds.push({
            channel: source.channel,
            name: source.name,
            number: source.number,
            language: language.code,
            label: language.label,
            flag: language.flag,
            named: source.named,
            quality: source.quality,
        });
    }
    return feeds;
}

function qualityRank(quality: FeedQuality | null): number {
    return quality ? QUALITY_RANK[quality] : 1;
}

/**
 * The feed to try when `playing` fails: the next one in order that has
 * not failed, from the start once the list runs out; null when none is
 * left.
 */
export function nextFeed(
    feeds: readonly MatchFeed[],
    playing: number | null,
    failed: ReadonlySet<number>
): MatchFeed | null {
    const at = feeds.findIndex((feed) => feed.channel.streamId === playing);
    const order =
        at === -1 ? feeds : [...feeds.slice(at + 1), ...feeds.slice(0, at)];
    return (
        order.find(
            (feed) =>
                feed.channel.streamId !== playing &&
                !failed.has(feed.channel.streamId)
        ) ?? null
    );
}
