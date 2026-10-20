import { Injectable, signal } from '@angular/core';
import { nextFeed, type MatchFeed } from './match-feeds';
import type { SportMatch } from './sports-catalog';

/**
 * The match whose signals a competition's stage lists: the one the way in
 * (or a click) asked for, while the stage's stream is one of its feeds;
 * else the match whose name-carrying feed the stream is. None for a
 * channel no match names (a competition's channel, which may show several,
 * stands for a match only when one asked for it).
 */
export function focusedMatch(
    matches: readonly SportMatch[],
    key: string | null,
    streamId: number | null
): SportMatch | null {
    const carries = (match: SportMatch, named: boolean) =>
        (match.feeds ?? []).some(
            (feed) =>
                feed.channel.streamId === streamId && (feed.named || !named)
        ) ||
        (match.streamId === streamId && (match.via.length === 0 || !named));
    const asked = key
        ? matches.find((match) => match.key === key || match.keys.includes(key))
        : undefined;
    if (asked && (streamId === null || carries(asked, false))) {
        return asked;
    }
    return streamId === null
        ? null
        : (matches.find((match) => carries(match, true)) ?? null);
}

/**
 * What a competition's page does when the signal of a match fails (the
 * player's diagnostic, Embedded MPV's lost stream): it offers the match's
 * next feed (see nextFeed) as "Probar otra señal", and plays it at once,
 * a single time per match, when the viewer had not picked the failed one
 * themselves. A feed the viewer picks, or one tried after a failure, is
 * never left for another on its own: no loop.
 *
 * Component-provided by the page; the stage reports to it.
 */
@Injectable()
export class SportFeedFallback {
    /** The stream that failed, while it is the one on the stage. */
    readonly failed = signal<number | null>(null);
    /** The focused match's feeds that failed. */
    readonly broken = signal<ReadonlySet<number>>(new Set());
    /** The feed played on its own after a failure, while it plays. */
    readonly switched = signal<MatchFeed | null>(null);
    private matchKey: string | null = null;
    /** The viewer picked the stream on the stage. */
    private explicit = false;
    /** The matches whose failed signal was already replaced on its own. */
    private readonly advanced = new Set<string>();

    /** The match in focus: another one starts with no failures. */
    focus(key: string | null): void {
        if (key === this.matchKey) {
            return;
        }
        this.matchKey = key;
        this.failed.set(null);
        this.broken.set(new Set());
        this.switched.set(null);
    }

    /** A stream goes on the stage; `explicit` when the viewer picked it. */
    played(streamId: number, explicit: boolean): void {
        this.explicit = explicit;
        if (this.failed() !== streamId) {
            this.failed.set(null);
        }
        if (explicit || this.switched()?.channel.streamId !== streamId) {
            this.switched.set(null);
        }
    }

    /**
     * The stream on the stage failed. Returns the feed to play now, if
     * any: the next one, once per match, unless the viewer picked this.
     */
    fail(streamId: number, feeds: readonly MatchFeed[]): MatchFeed | null {
        this.broken.update((broken) => new Set(broken).add(streamId));
        this.failed.set(streamId);
        this.switched.set(null);
        const key = this.matchKey;
        if (this.explicit || !key || this.advanced.has(key)) {
            return null;
        }
        const next = nextFeed(feeds, streamId, this.broken());
        if (next) {
            this.advanced.add(key);
            this.switched.set(next);
        }
        return next;
    }

    /** The stream plays again (the player's Retry): no longer failed. */
    recovered(streamId: number): void {
        if (this.failed() === streamId) {
            this.failed.set(null);
        }
        if (this.broken().has(streamId)) {
            this.broken.update((broken) => {
                const rest = new Set(broken);
                rest.delete(streamId);
                return rest;
            });
        }
    }
}
