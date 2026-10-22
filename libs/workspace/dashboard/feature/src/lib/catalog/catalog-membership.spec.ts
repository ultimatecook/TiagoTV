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
const NOTHING: PlatformListsView = {
    lists: [],
    total: 2,
    answered: 0,
    failed: 0,
};

describe('CatalogMembership', () => {
    let view: ReturnType<typeof signal<PlatformListsView>>;
    let lists: { refresh: jest.Mock; view: jest.Mock };
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
        source = signal<{ _id: string } | null>({ _id: 'p1' });
        view = signal<PlatformListsView>(NOTHING);
        lists = {
            // The lists answer: Prime Video lists "The Boys".
            refresh: jest.fn(async () =>
                view.set({
                    lists: [{ platform: PRIME, titles: primeTitles }],
                    total: 2,
                    answered: 2,
                    failed: 0,
                })
            ),
            view: jest.fn(() => view()),
        };
    });

    afterEach(() => TestBed.resetTestingModule());

    it("learns the platforms' members as their lists answer", async () => {
        const membership = create();
        expect(membership.members('series').size).toBe(0);

        await membership.refresh('series');

        expect(lists.refresh).toHaveBeenCalledWith('series');
        expect(membership.members('series').get('1270')).toEqual(new Set([5]));
        expect(membership.platformOf('series', 5)).toBe(PRIME);
        expect(membership.platformOf('series', 99)).toBeNull();
    });

    it('keeps the members for the next launch, before any list answers', async () => {
        await create().refresh('series');
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
        expect(stored.playlistId).toBe('p1');
        expect(stored.kinds.series.members).toEqual({ '1270': [5] });
        TestBed.resetTestingModule();

        view.set(NOTHING);
        const next = create();

        expect(next.platformOf('series', 5)).toBe(PRIME);
    });

    it("keeps another source's members apart", async () => {
        const membership = create();
        await membership.refresh('series');
        view.set(NOTHING);

        source.set({ _id: 'p2' });

        expect(membership.members('series').size).toBe(0);
        expect(membership.platformOf('series', 5)).toBeNull();
    });

    it('forgets the kept members on a reload', async () => {
        const membership = create();
        await membership.refresh('series');
        view.set(NOTHING);

        membership.clear();

        expect(membership.members('series').size).toBe(0);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});
