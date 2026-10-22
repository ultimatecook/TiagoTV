import { toPlatformTitles } from '../platforms/platform-titles';
import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import { fromStoredList, toStoredList } from './catalog-list-store';
import { unionPlatformLists } from './catalog-list-views';

const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;
const PRIME = findStreamingPlatform('prime-video') as StreamingPlatform;
const series = (categoryId: string, id: number, name: string, genre = '') =>
    toPlatformTitles({ id: categoryId, kind: 'series', language: 'EN' }, [
        { series_id: id, name, genre },
    ]);

describe('unionPlatformLists', () => {
    it("adds the stored titles the platforms' lists lack, once", () => {
        const listed = [
            { platform: PRIME, titles: series('1270', 5, 'The Boys', 'Drama') },
        ];
        const stored = [
            { platform: NETFLIX, titles: series('482', 6, 'DARK') },
            // Stored under Prime too, without the list's genres.
            { platform: PRIME, titles: series('1270', 5, 'The Boys') },
        ];

        const union = unionPlatformLists(listed, stored);

        expect(
            union.map((list) => [
                list.platform.id,
                list.titles.map((title) => [title.title, title.genres]),
            ])
        ).toEqual([
            ['prime-video', [['The Boys', ['drama']]]],
            ['netflix', [['DARK', []]]],
        ]);
    });
});

describe('the lists kept across launches', () => {
    it('keep what a card shows, and leave the synopsis out', () => {
        const [title] = toPlatformTitles(
            { id: '1270', kind: 'series', language: 'EN' },
            [
                {
                    series_id: 5,
                    name: 'The Boys (2019)',
                    cover: 'http://img/boys.jpg',
                    last_modified: '1760000000',
                    genre: 'Action, Drama',
                    rating: '8.7',
                    plot: 'A long synopsis.',
                    backdrop_path: ['http://img/boys-wide.jpg'],
                    tmdb: '76479',
                },
            ]
        );

        const stored = toStoredList(
            'p1',
            { id: '1270', kind: 'series', language: 'EN' },
            [title],
            123
        );
        const [back] = fromStoredList(
            JSON.parse(JSON.stringify(stored)) as typeof stored
        );

        expect(back).toEqual({ ...title, plot: null });
        expect(JSON.stringify(stored)).not.toContain('synopsis');
    });
});
