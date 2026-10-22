import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import {
    toPlatformTitles,
    type PlatformTitle,
} from '../platforms/platform-titles';
import {
    buildPlatformShelves,
    type PlatformCategory,
    type PlatformShelf,
} from '../platforms/streaming-platforms';
import { CATALOG_RETRY_AFTER_PLAYBACK_MS } from './catalog-list-retry';
import {
    CatalogListStore,
    type StoredCategoryList,
} from './catalog-list-store';
import {
    CATALOG_LISTS_RETRY_MS,
    CatalogPlatformLists,
} from './catalog-platform-lists';
import { CatalogRequestLog } from './catalog-request-log';

const SHELVES = buildPlatformShelves(
    [{ category_id: '1535', category_name: '✪ ORIGINAL AMAZON  MULTI' }],
    [
        { category_id: '1270', category_name: '|EN| ✪ AMAZON-PRIME' },
        { category_id: '2330', category_name: '|ES| ✪ HBO-MAX' },
        { category_id: '1721', category_name: '|ES| ✪ HBO' },
        { category_id: '483', category_name: '|EN| ✪ HBO' },
    ]
);

/** Each category's list: one title named after it. */
const listOf = (category: PlatformCategory): PlatformTitle[] =>
    toPlatformTitles(category, [
        {
            stream_id: Number(category.id),
            series_id: Number(category.id),
            name: `Title ${category.id}`,
        },
    ]);

/** The lists kept across launches, in memory. */
class MemoryStore {
    readonly lists = new Map<string, StoredCategoryList>();
    async read(playlistId: string) {
        return [...this.lists.values()].filter(
            (list) => list.playlistId === playlistId
        );
    }
    async write(list: StoredCategoryList) {
        this.lists.set(`${list.kind}:${list.categoryId}`, list);
    }
    async clear() {
        this.lists.clear();
    }
}

describe('CatalogPlatformLists', () => {
    let platforms: {
        source: ReturnType<typeof signal<{ _id: string } | null>>;
        shelves: ReturnType<typeof signal<PlatformShelf[] | null>>;
        failed: ReturnType<typeof signal<boolean>>;
        loadShelves: jest.Mock;
        categoryTitles: jest.Mock;
        categoryName: jest.Mock;
    };
    let store: MemoryStore;
    let asked: string[];

    const create = () => {
        TestBed.configureTestingModule({
            providers: [
                { provide: PlatformsCatalogService, useValue: platforms },
                { provide: CatalogListStore, useValue: store },
            ],
        });
        return TestBed.inject(CatalogPlatformLists);
    };
    const titlesOf = (titles: readonly PlatformTitle[] | null) =>
        (titles ?? []).map((title) => title.title).sort();

    beforeEach(() => {
        store = new MemoryStore();
        asked = [];
        platforms = {
            source: signal<{ _id: string } | null>({ _id: 'p1' }),
            shelves: signal<PlatformShelf[] | null>(null),
            failed: signal(false),
            loadShelves: jest.fn(async () => platforms.shelves.set(SHELVES)),
            categoryTitles: jest.fn(async (category: PlatformCategory) => {
                asked.push(category.id);
                return listOf(category);
            }),
            categoryName: jest.fn(() => '|ES| ✪ HBO'),
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        TestBed.resetTestingModule();
    });

    it("loads a platform's lists one at a time, keeping what answered", async () => {
        jest.useFakeTimers();
        const lists = create();
        let running = 0;
        let most = 0;
        const seen: string[][] = [];
        platforms.categoryTitles.mockImplementation(
            async (category: PlatformCategory) => {
                most = Math.max(most, ++running);
                seen.push(titlesOf(lists.platformTitles('hbo-max')));
                await Promise.resolve();
                running--;
                asked.push(category.id);
                if (category.id === '1721') {
                    throw new Error('refused');
                }
                return listOf(category);
            }
        );

        const load = lists.loadPlatform('hbo-max');
        await jest.advanceTimersByTimeAsync(0);
        // What answered shows while the rest is still asked.
        expect(titlesOf(lists.platformTitles('hbo-max'))).toEqual([
            'Title 2330',
            'Title 483',
        ]);
        expect(lists.platformProgress('hbo-max')).toMatchObject({
            total: 3,
            answered: 2,
            failed: 1,
            loading: true,
        });

        await jest.advanceTimersByTimeAsync(CATALOG_LISTS_RETRY_MS);
        await load;

        expect(most).toBe(1);
        expect(seen[0]).toEqual([]);
        expect(seen[1]).toEqual(['Title 2330']);
        // Each list once; the refused one once more, a little later.
        expect(asked).toEqual(['2330', '1721', '483', '1721']);
        expect(lists.platformProgress('hbo-max').loading).toBe(false);
        expect(lists.platformTitles('prime-video')).toBeNull();
    });

    it('tries a refused list again once playback stops', async () => {
        jest.useFakeTimers();
        const lists = create();
        let refusing = true;
        platforms.categoryTitles.mockImplementation(
            async (category: PlatformCategory) => {
                asked.push(category.id);
                if (refusing && category.id === '1270') {
                    throw new Error('HTTP Error 403');
                }
                return listOf(category);
            }
        );
        const video = document.createElement('video');
        document.body.appendChild(video);
        Object.defineProperty(video, 'paused', {
            value: false,
            configurable: true,
        });
        video.dispatchEvent(new Event('playing'));
        TestBed.tick();

        const load = lists.loadPlatform('prime-video');
        await jest.advanceTimersByTimeAsync(CATALOG_LISTS_RETRY_MS);
        await load;
        expect(titlesOf(lists.platformTitles('prime-video'))).toEqual([
            'Title 1535',
        ]);
        const log = TestBed.inject(CatalogRequestLog).entries();
        expect(log[0]).toMatchObject({
            action: 'get_series',
            result: 'http',
            status: 403,
            playing: true,
        });

        // The stream stops: the provider takes requests again.
        refusing = false;
        Object.defineProperty(video, 'paused', { value: true });
        video.dispatchEvent(new Event('pause'));
        TestBed.tick();
        await jest.advanceTimersByTimeAsync(CATALOG_RETRY_AFTER_PLAYBACK_MS);

        expect(titlesOf(lists.platformTitles('prime-video'))).toEqual([
            'Title 1270',
            'Title 1535',
        ]);
        expect(asked).toEqual(['1535', '1270', '1270', '1270']);
        video.remove();
    });

    it("asks a list once for Series and a platform's page together", async () => {
        const lists = create();

        await Promise.all([
            lists.load('series'),
            lists.loadPlatform('prime-video'),
        ]);

        expect(asked.filter((id) => id === '1270')).toHaveLength(1);
        expect(asked.sort()).toEqual(['1270', '1535', '1721', '2330', '483']);
        expect(
            lists.view('series').lists.map((list) => list.platform.id)
        ).toEqual(['prime-video', 'hbo-max']);
    });

    it('shows the lists of the last launch before asking anything', async () => {
        await create().load('series');
        TestBed.resetTestingModule();
        asked = [];

        const next = create();
        await next.ready();
        platforms.shelves.set(SHELVES);

        expect(
            next.view('series').lists.map((list) => list.titles.length)
        ).toEqual([1, 3]);
        expect(asked).toEqual([]);
        // Fresh: the background refresh asks nothing again.
        await next.refresh('series');
        expect(asked).toEqual([]);
    });

    it('keeps a list that had titles when a reload answers empty', async () => {
        jest.useFakeTimers();
        const lists = create();
        const load = lists.loadPlatform('prime-video');
        await jest.advanceTimersByTimeAsync(0);
        await load;
        platforms.categoryTitles.mockResolvedValue([]);

        const reload = lists.load('series', 'normal', 0);
        await jest.advanceTimersByTimeAsync(CATALOG_LISTS_RETRY_MS);
        await reload;

        expect(titlesOf(lists.platformTitles('prime-video'))).toEqual([
            'Title 1270',
            'Title 1535',
        ]);
        expect(
            lists.categoryState({ id: '1270', kind: 'series', language: 'EN' })
        ).toMatchObject({ titles: 1, failure: { outcome: 'empty' } });
    });

    it('forgets every list on a reload', async () => {
        const lists = create();
        await lists.load('series');

        await lists.clear();

        expect(lists.view('series').lists).toEqual([]);
        expect(store.lists.size).toBe(0);
    });
});
