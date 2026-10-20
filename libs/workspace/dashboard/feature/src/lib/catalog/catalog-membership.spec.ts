import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { toPlatformTitles } from '../platforms/platform-titles';
import {
    buildPlatformShelves,
    findStreamingPlatform,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import { CatalogMembership } from './catalog-membership';
import {
    CatalogPlatformLists,
    type PlatformListsView,
} from './catalog-platform-lists';

const STORAGE_KEY = 'tiagotv:platform-members:v1';
const SHELVES = buildPlatformShelves(
    [],
    [
        { category_id: '1270', category_name: '|EN| ✪ AMAZON-PRIME' },
        { category_id: '2331', category_name: '|ES| ✪ NETFLIX SERIES' },
    ]
);
const PRIME = findStreamingPlatform('prime-video') as StreamingPlatform;
const primeTitles = toPlatformTitles(
    { id: '1270', kind: 'series', language: 'EN' },
    [{ series_id: 5, name: 'The Boys' }]
);

describe('CatalogMembership', () => {
    let view: PlatformListsView;
    let lists: { load: jest.Mock; view: jest.Mock };
    let source: ReturnType<typeof signal<{ _id: string } | null>>;

    const create = () => {
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: PlatformsCatalogService,
                    useValue: { source, shelves: signal(SHELVES) },
                },
                { provide: CatalogPlatformLists, useValue: lists },
            ],
        });
        return TestBed.inject(CatalogMembership);
    };

    beforeEach(() => {
        localStorage.clear();
        jest.useRealTimers();
        source = signal<{ _id: string } | null>({ _id: 'p1' });
        view = {
            lists: [{ platform: PRIME, titles: primeTitles }],
            total: 2,
            answered: 2,
            failed: 0,
        };
        lists = {
            load: jest.fn(async () => undefined),
            view: jest.fn(() => view),
        };
    });

    afterEach(() => TestBed.resetTestingModule());

    it("learns the platforms' members, names their platform and keeps them", async () => {
        const membership = create();
        expect(membership.members('series').size).toBe(0);

        await membership.refresh('series');

        expect(lists.load).toHaveBeenCalledWith('series');
        expect(membership.members('series').get('1270')).toEqual(new Set([5]));
        expect(membership.platformOf('series', 5)).toBe(PRIME);
        expect(membership.platformOf('series', 99)).toBeNull();
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
        expect(stored.playlistId).toBe('p1');
        expect(stored.kinds.series.members).toEqual({ '1270': [5] });
    });

    it('asks again only twice a day, and reads the last answer at launch', async () => {
        await create().refresh('series');
        TestBed.resetTestingModule();
        lists.load.mockClear();

        const next = create();
        await next.refresh('series');

        expect(lists.load).not.toHaveBeenCalled();
        expect(next.platformOf('series', 5)).toBe(PRIME);
    });

    it('tries again sooner after a partial answer', async () => {
        jest.useFakeTimers({ now: 1_000_000_000_000 });
        view = { ...view, failed: 1 };
        const membership = create();
        await membership.refresh('series');
        lists.load.mockClear();

        await membership.refresh('series');
        expect(lists.load).not.toHaveBeenCalled();

        jest.setSystemTime(1_000_000_000_000 + 31 * 60 * 1000);
        await membership.refresh('series');
        expect(lists.load).toHaveBeenCalledTimes(1);
    });

    it("keeps another source's members apart", async () => {
        const membership = create();
        await membership.refresh('series');

        source.set({ _id: 'p2' });

        expect(membership.members('series').size).toBe(0);
        expect(membership.platformOf('series', 5)).toBeNull();
    });
});
