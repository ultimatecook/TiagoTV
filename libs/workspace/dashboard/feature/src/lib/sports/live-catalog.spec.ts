import {
    eventCategoryIds,
    reloadEventCategories,
    toLiveCatalog,
    withFreshEvents,
    type LiveCatalog,
} from './live-catalog';

const LIVE: LiveCatalog = {
    categories: [
        { category_id: '10', category_name: '|ES| ✪ DAZN EVENT' },
        { category_id: '11', category_name: '|UK| ✪ SKY SPORTS' },
        { category_id: '12', category_name: '|DE| ✪ SPORT EVENTS' },
        { category_id: '13', category_name: '|ES| ✪ DEPORTES' },
    ],
    streams: [
        { stream_id: 1, name: 'ES | No Event', category_id: '10' },
        { stream_id: 2, name: '|UK| SKY SPORTS MAIN EVENT', category_id: '11' },
        {
            stream_id: 3,
            name: 'Live | Bayern - Dortmund | Bundesliga | DE',
            category_id: '12',
        },
        { stream_id: 4, name: '|ES| DAZN 1', category_id: '13' },
        {
            stream_id: 5,
            name: 'End | Udinese - Lecce | Serie A | ES',
            category_id: '13',
        },
        { stream_id: 6, name: '|ES| DAZN 2', category_id: '13' },
    ],
};

describe('toLiveCatalog', () => {
    it('maps SQLite rows to the panel shape and the provider ids', () => {
        const live = toLiveCatalog(
            [
                {
                    id: 501,
                    name: '|ES| ✪ DEPORTES',
                    playlist_id: 'p1',
                    type: 'live',
                    xtream_id: 13,
                    hidden: false,
                    locked: false,
                },
            ],
            [
                {
                    xtream_id: 4,
                    title: '|ES| DAZN 1',
                    poster_url: 'https://logo.example/dazn.png',
                    category_id: 501,
                },
                // A hidden category's channel: its category is not listed.
                { xtream_id: 7, title: '|ES| OTRO', category_id: 502 },
            ],
            true
        );

        expect(live.categories).toEqual([
            { category_id: '13', category_name: '|ES| ✪ DEPORTES' },
        ]);
        expect(live.streams).toEqual([
            {
                stream_id: 4,
                name: '|ES| DAZN 1',
                stream_icon: 'https://logo.example/dazn.png',
                category_id: '13',
            },
            {
                stream_id: 7,
                name: '|ES| OTRO',
                stream_icon: null,
                category_id: null,
            },
        ]);
    });

    it('keeps the panel fields of the browser session cache', () => {
        const live = toLiveCatalog(
            [{ category_id: '13', category_name: '|ES| X', parent_id: 0 }],
            [
                {
                    stream_id: 4,
                    xtream_id: 4,
                    name: '|ES| DAZN 1',
                    title: '|ES| DAZN 1',
                    stream_icon: 'https://logo.example/dazn.png',
                    poster_url: 'https://logo.example/dazn.png',
                    category_id: '13',
                    is_adult: 0,
                },
            ],
            false
        );

        expect(live.streams).toEqual([
            {
                stream_id: 4,
                name: '|ES| DAZN 1',
                stream_icon: 'https://logo.example/dazn.png',
                category_id: '13',
                is_adult: 0,
            },
        ]);
    });
});

describe('eventCategoryIds', () => {
    it('lists the Spanish and English categories that hold event channels', () => {
        expect(eventCategoryIds(LIVE)).toEqual(['10', '13']);
    });
});

describe('withFreshEvents', () => {
    it('puts each fresh list where the stored one stood', () => {
        const live = withFreshEvents(
            LIVE,
            ['10', '13'],
            new Map([
                [
                    '13',
                    [
                        {
                            stream_id: 5,
                            name: 'Live | Getafe - Elche | LaLiga | ES',
                            category_id: '13',
                        },
                        {
                            stream_id: 4,
                            name: '|ES| DAZN 1',
                            category_id: '13',
                        },
                    ],
                ],
            ])
        );

        expect(live.categories).toBe(LIVE.categories);
        expect(live.streams.map((stream) => stream.stream_id)).toEqual([
            // 10 is not reloaded yet: its "No Event" slot is left out.
            2, 3, 5, 4,
        ]);
    });

    it('leaves a category that is no longer listed out', () => {
        const live = withFreshEvents(
            { categories: LIVE.categories, streams: [] },
            ['10'],
            new Map([
                ['10', [{ stream_id: 1, name: 'x', category_id: '10' }]],
                ['99', [{ stream_id: 9, name: 'y', category_id: '99' }]],
            ])
        );

        expect(live.streams.map((stream) => stream.stream_id)).toEqual([1]);
    });
});

describe('reloadEventCategories', () => {
    afterEach(() => jest.useRealTimers());

    it('asks for one category at a time, a gap apart', async () => {
        jest.useFakeTimers();
        const fetchCategory = jest.fn(async (id: string) => [
            { stream_id: Number(id), name: 'n', category_id: id },
        ]);

        const round = reloadEventCategories(
            ['10', '13'],
            fetchCategory,
            new Map(),
            500
        );
        await jest.advanceTimersByTimeAsync(0);
        expect(fetchCategory.mock.calls).toEqual([['10']]);
        await jest.advanceTimersByTimeAsync(499);
        expect(fetchCategory).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);

        const fresh = await round;
        expect(fetchCategory.mock.calls).toEqual([['10'], ['13']]);
        expect([...fresh.keys()]).toEqual(['10', '13']);
    });

    it('stops at the first failure and keeps the earlier lists', async () => {
        const fetchCategory = jest.fn(async (id: string) => {
            if (id === '13') {
                throw new Error('busy');
            }
            return [{ stream_id: 1, name: 'n', category_id: id }];
        });
        const previous = new Map([
            ['13', [{ stream_id: 4, name: 'old', category_id: '13' }]],
        ]);

        const fresh = await reloadEventCategories(
            ['10', '13', '14'],
            fetchCategory,
            previous,
            0
        );

        expect(fetchCategory).toHaveBeenCalledTimes(2);
        expect(fresh.get('13')).toBe(previous.get('13'));
        expect(fresh.has('14')).toBe(false);
    });

    it('serves every category from a panel that ignores the category', async () => {
        const fetchCategory = jest.fn(async () => LIVE.streams);

        const fresh = await reloadEventCategories(
            ['10', '13'],
            fetchCategory,
            new Map(),
            0
        );

        expect(fetchCategory).toHaveBeenCalledTimes(1);
        expect(fresh.get('10')?.map((stream) => stream.stream_id)).toEqual([1]);
        expect(fresh.get('13')?.map((stream) => stream.stream_id)).toEqual([
            4, 5, 6,
        ]);
    });
});
