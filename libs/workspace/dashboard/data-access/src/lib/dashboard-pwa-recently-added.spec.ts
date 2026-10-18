import type { IXtreamDataSource } from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { loadPwaXtreamRecentlyAdded } from './dashboard-pwa-recently-added';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const seconds = (iso: string) => String(Date.parse(iso) / 1000);

const playlist = {
    _id: 'p1',
    title: 'Demo',
    serverUrl: 'http://portal.test',
    username: 'u',
    password: 'p',
} as PlaylistMeta;

function dataSource(
    content: Record<string, unknown[]>,
    failing: string[] = []
): IXtreamDataSource {
    return {
        getContent: jest.fn(
            async (_id: string, _creds: unknown, type: string) => {
                if (failing.includes(type)) {
                    throw new Error('offline');
                }
                return content[type] ?? [];
            }
        ),
    } as unknown as IXtreamDataSource;
}

describe('loadPwaXtreamRecentlyAdded', () => {
    it('merges movies and series newest first with their catalog facts', async () => {
        const source = dataSource({
            movie: [
                {
                    stream_id: 1,
                    name: 'Old Movie',
                    stream_icon: 'old.png',
                    added: seconds('2026-01-01T00:00:00Z'),
                    category_id: '10',
                    rating: 7.4,
                },
            ],
            series: [
                {
                    series_id: 2,
                    name: 'New Show',
                    cover: 'show.png',
                    last_modified: seconds('2026-10-01T00:00:00Z'),
                    category_id: 20,
                    rating: '8.1',
                    genre: 'Drama, Crime',
                    plot: 'A plot.',
                    backdrop_path: ['backdrop.jpg'],
                },
            ],
        });

        const items = await loadPwaXtreamRecentlyAdded(
            source,
            [playlist],
            10,
            NOW
        );

        expect(items.map((item) => item.title)).toEqual([
            'New Show',
            'Old Movie',
        ]);
        expect(items[0]).toMatchObject({
            type: 'series',
            xtream_id: 2,
            poster_url: 'show.png',
            backdrop_url: 'backdrop.jpg',
            rating: '8.1',
            genre: 'Drama, Crime',
            plot: 'A plot.',
            playlist_id: 'p1',
            source: 'xtream',
        });
        expect(items[1]).toMatchObject({
            type: 'movie',
            xtream_id: 1,
            poster_url: 'old.png',
            rating: '7.4',
        });
    });

    it('skips undated titles, honours the limit and survives a failing catalog', async () => {
        const source = dataSource(
            {
                movie: [
                    { stream_id: 1, name: 'Undated' },
                    {
                        stream_id: 2,
                        name: 'A',
                        added: seconds('2026-05-01T00:00:00Z'),
                    },
                    {
                        stream_id: 3,
                        name: 'B',
                        added: seconds('2026-06-01T00:00:00Z'),
                    },
                ],
            },
            ['series']
        );

        const items = await loadPwaXtreamRecentlyAdded(
            source,
            [playlist],
            1,
            NOW
        );

        expect(items.map((item) => item.title)).toEqual(['B']);
    });

    it('ignores sources without Xtream credentials', async () => {
        const source = dataSource({});

        await loadPwaXtreamRecentlyAdded(
            source,
            [{ _id: 'm3u', title: 'M3U' } as PlaylistMeta],
            10,
            NOW
        );

        expect(source.getContent).not.toHaveBeenCalled();
    });
});
