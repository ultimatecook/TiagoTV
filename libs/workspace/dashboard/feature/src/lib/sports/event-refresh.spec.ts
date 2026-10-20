import { EventRefresh } from './event-refresh';
import type { LiveCatalog } from './live-catalog';
import { buildSportsCatalog, type SportsCatalogStream } from './sports-catalog';

/** Stored days ago: the UEFA listing still names the last matchday. */
const STORED: LiveCatalog = {
    categories: [
        { category_id: '1', category_name: '|DE| ✪ UEFA CHAMPIONS LEAGUE' },
        { category_id: '2', category_name: '|UK| ✪ UEFA CHAMPIONS LEAGUE' },
        { category_id: '3', category_name: '|ES| ✪ M LCAMPEON' },
        { category_id: '4', category_name: '|ES| ✪ DAZN EVENT' },
    ],
    streams: [
        { stream_id: 1, name: 'DE | No Event', category_id: '1' },
        {
            stream_id: 2,
            name: 'UEFA | 05 - Benfica vs Celtic 21:00 pm',
            category_id: '2',
        },
        { stream_id: 3, name: 'UEFA  | 16 -', category_id: '2' },
        { stream_id: 4, name: '|ES| M+LCAMPEON ᴴᴰ', category_id: '3' },
        { stream_id: 5, name: 'ES | No Event', category_id: '4' },
    ],
};

/** Tonight's lists. */
const TONIGHT: Record<string, SportsCatalogStream[]> = {
    '1': [
        {
            stream_id: 1,
            name: 'Live | Paris Saint-Germain - FC Barcelona | UEFA Champions League | DE',
            category_id: '1',
        },
    ],
    '2': [
        {
            stream_id: 2,
            name: 'UEFA | 05 - PSG vs Barcelona 21:00 pm',
            category_id: '2',
        },
        { stream_id: 3, name: 'UEFA  | 16 -', category_id: '2' },
    ],
    '4': [{ stream_id: 5, name: 'ES | No Event', category_id: '4' }],
};

describe('EventRefresh', () => {
    it('reloads the numbered listings of the competitions on now', async () => {
        const fetchCategory = jest.fn(async (id: string) => TONIGHT[id] ?? []);
        const refresh = new EventRefresh();
        const options = {
            sections: () => new Set(['champions-league'] as const),
            foreignMatchOn: true,
            fetchCategory,
        };

        await refresh.reload('source-1', STORED, options);
        expect(fetchCategory.mock.calls.map(([id]) => id)).toEqual(['4', '1']);

        fetchCategory.mockClear();
        const round = await refresh.reload('source-1', STORED, {
            ...options,
            liveSections: new Set(['champions-league'] as const),
        });
        expect(fetchCategory.mock.calls.map(([id]) => id)).toEqual([
            '4',
            '2',
            '1',
        ]);

        const match = buildSportsCatalog(
            round.live.categories,
            round.live.streams,
            new Date('2026-10-21T19:30:00Z')
        )['champions-league'].matches[0];
        // Tonight's listing names it: among its signals, in English.
        expect(
            match.feeds?.map((feed) => [feed.channel.streamId, feed.label])
        ).toEqual([
            [4, 'España'],
            [2, 'Inglés (UK)'],
            [1, 'Alemán'],
        ]);
    });
});
