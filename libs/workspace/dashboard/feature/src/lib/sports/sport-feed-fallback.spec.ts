import type { MatchFeed } from './match-feeds';
import { focusedMatch, SportFeedFallback } from './sport-feed-fallback';
import type { SportMatch } from './sports-catalog';

const feed = (streamId: number, named = true): MatchFeed => ({
    channel: { streamId, categoryId: '1', title: `${streamId}`, icon: null },
    name: `${streamId}`,
    number: null,
    language: 'ES',
    label: 'España',
    flag: 'es',
    named,
    quality: null,
});

const match = (
    key: string,
    streamId: number,
    feeds: MatchFeed[],
    via = false
): SportMatch =>
    ({
        key,
        keys: [key, `${key}-alias`],
        streamId,
        via: via ? [{ name: 'M+', channel: feeds[0].channel }] : [],
        feeds,
    }) as unknown as SportMatch;

describe('SportFeedFallback', () => {
    const feeds = [feed(1), feed(2), feed(3)];

    it('plays the next signal once per match when the app picked the failed one', () => {
        const fallback = new SportFeedFallback();
        fallback.focus('psg-barcelona');
        fallback.played(1, false);

        const next = fallback.fail(1, feeds);
        expect(next?.channel.streamId).toBe(2);
        expect(fallback.switched()?.channel.streamId).toBe(2);
        fallback.played(2, false);
        // It says which one it tries; the failed one is marked.
        expect(fallback.switched()?.channel.streamId).toBe(2);
        expect(fallback.failed()).toBeNull();
        expect([...fallback.broken()]).toEqual([1]);

        // The second one fails too: offered, never played on its own.
        expect(fallback.fail(2, feeds)).toBeNull();
        expect(fallback.failed()).toBe(2);
        expect([...fallback.broken()]).toEqual([1, 2]);
    });

    it('only offers the next signal when the viewer picked the failed one', () => {
        const fallback = new SportFeedFallback();
        fallback.focus('psg-barcelona');
        fallback.played(2, true);

        expect(fallback.fail(2, feeds)).toBeNull();
        expect(fallback.failed()).toBe(2);
        expect(fallback.switched()).toBeNull();
    });

    it('starts each match afresh, and forgets a failure that plays again', () => {
        const fallback = new SportFeedFallback();
        fallback.focus('a');
        fallback.played(1, false);
        fallback.fail(1, feeds);
        fallback.played(2, true);
        fallback.fail(2, feeds);

        fallback.recovered(2);
        expect(fallback.failed()).toBeNull();
        expect([...fallback.broken()]).toEqual([1]);

        fallback.focus('b');
        expect(fallback.broken().size).toBe(0);
        fallback.played(1, false);
        expect(fallback.fail(1, feeds)?.channel.streamId).toBe(2);
    });

    it('plays nothing on its own without a match in focus', () => {
        const fallback = new SportFeedFallback();
        fallback.played(1, false);

        expect(fallback.fail(1, feeds)).toBeNull();
        expect(fallback.failed()).toBe(1);
    });
});

describe('focusedMatch', () => {
    const psg = match(
        'champions|psg|barcelona',
        11,
        [feed(11, false), feed(20)],
        true
    );
    const benfica = match(
        'champions|benfica|celtic',
        11,
        [feed(11, false), feed(30)],
        true
    );
    const matches = [benfica, psg];

    it('keeps the match asked for while the stage plays one of its feeds', () => {
        expect(focusedMatch(matches, psg.key, 11)).toBe(psg);
        expect(focusedMatch(matches, `${psg.key}-alias`, 20)).toBe(psg);
        expect(focusedMatch(matches, psg.key, null)).toBe(psg);
    });

    it('follows a feed that names another match', () => {
        expect(focusedMatch(matches, psg.key, 30)).toBe(benfica);
        expect(focusedMatch(matches, null, 20)).toBe(psg);
    });

    it('takes no match for a competition’s channel nobody asked about', () => {
        expect(focusedMatch(matches, null, 11)).toBeNull();
        expect(focusedMatch(matches, psg.key, 99)).toBeNull();
    });
});
