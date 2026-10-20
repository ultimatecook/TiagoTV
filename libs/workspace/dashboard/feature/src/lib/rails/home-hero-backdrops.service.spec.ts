import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CatalogExtras } from '../catalog/catalog-extras';
import type { CatalogTitle } from '../catalog/catalog-titles';
import { CatalogService } from '../catalog/catalog.service';
import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import {
    HERO_BACKDROP_PROBES,
    HERO_DISCOVERY_SLIDES,
    HERO_IMAGE_CHECK,
    HomeHeroBackdropsService,
} from './home-hero-backdrops.service';
import {
    HomeTitlePagesService,
    TITLE_PAGE_WAIT_MS,
} from './home-title-pages.service';

const netflix = findStreamingPlatform('netflix') as StreamingPlatform;

function title(id: number, backdrop: string | null = null): CatalogTitle {
    return {
        id,
        kind: id % 2 === 0 ? 'movie' : 'series',
        categoryId: '1610',
        title: `TITLE ${id}`,
        poster: `https://img/poster-${id}.jpg`,
        language: 'ES',
        added: 1_760_000_000 - id,
        genres: [],
        rating: null,
        plot: null,
        backdrop,
        tmdb: null,
        year: 2024,
        versions: [],
        platform: netflix,
        platforms: [netflix],
    };
}

function extras(backdrop: string | null): CatalogExtras {
    return {
        plot: null,
        backdrop,
        genres: [],
        year: null,
        minutes: null,
        seasons: null,
    };
}

describe('HomeHeroBackdropsService', () => {
    let source: ReturnType<typeof signal<{ _id: string } | null>>;
    let pages: ReturnType<typeof signal<ReadonlyMap<number, CatalogExtras>>>;
    let loadExtras: jest.Mock;
    let check: jest.Mock;

    function create(): HomeHeroBackdropsService {
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: CatalogService,
                    useValue: {
                        source,
                        extrasOf: (item: CatalogTitle) =>
                            pages().get(item.id) ?? null,
                        loadExtras,
                    },
                },
                { provide: HERO_IMAGE_CHECK, useValue: check },
            ],
        });
        return TestBed.inject(HomeHeroBackdropsService);
    }

    /** The title page arrives, as `CatalogService` would keep it. */
    function answer(id: number, backdrop: string | null): void {
        pages.update((state) => new Map(state).set(id, extras(backdrop)));
    }

    async function settle(): Promise<void> {
        for (let round = 0; round < 6; round++) {
            TestBed.tick();
            await Promise.resolve();
            await Promise.resolve();
        }
    }

    beforeEach(() => {
        source = signal({ _id: 'p1' });
        pages = signal(new Map());
        loadExtras = jest.fn();
        check = jest.fn().mockResolvedValue(true);
    });

    afterEach(() => jest.useRealTimers());

    it('features the titles whose row names a backdrop first, asking nothing', async () => {
        const service = create();

        service.probe('p1', [title(2), title(3, 'https://img/bd-3.jpg')]);
        await settle();

        expect(service.found('p1').map((found) => found.title.id)).toEqual([3]);
        expect(service.pending('p1')).toBe(false);
        // Then the movie's page, the only one asked.
        expect(loadExtras.mock.calls.map(([item]) => item.id)).toEqual([2]);
    });

    it('asks the title pages one at a time and skips one without a backdrop', async () => {
        const service = create();

        service.probe('p1', [title(2), title(4), title(6)]);
        await settle();
        expect(loadExtras).toHaveBeenCalledTimes(1);
        expect(service.pending('p1')).toBe(true);

        answer(2, null);
        await settle();
        expect(loadExtras).toHaveBeenCalledTimes(2);
        expect(service.found('p1')).toEqual([]);

        answer(4, 'https://img/bd-4.jpg');
        await settle();
        expect(service.found('p1').map((found) => found.title.id)).toEqual([4]);
        expect(check).toHaveBeenCalledWith('https://img/bd-4.jpg');
        expect(loadExtras).toHaveBeenCalledTimes(3);
    });

    it('skips a backdrop that does not load, or is a poster', async () => {
        check.mockImplementation((url: string) =>
            Promise.resolve(!url.includes('tall'))
        );
        const service = create();

        service.probe('p1', [
            title(3, 'https://img/tall-3.jpg'),
            title(5, 'https://img/bd-5.jpg'),
        ]);
        await settle();

        expect(service.found('p1').map((found) => found.title.id)).toEqual([5]);
    });

    it(`stops at ${HERO_DISCOVERY_SLIDES} titles and ${HERO_BACKDROP_PROBES} title pages a session`, async () => {
        loadExtras.mockImplementation((item: CatalogTitle) =>
            answer(item.id, null)
        );
        const service = create();
        const withBackdrops = [1, 3, 5, 7, 9].map((id) =>
            title(id, `https://img/bd-${id}.jpg`)
        );
        const without = Array.from({ length: 12 }, (_, i) => title(20 + i * 2));

        service.probe('p1', [...withBackdrops, ...without]);
        await settle();
        expect(service.found('p1')).toHaveLength(HERO_DISCOVERY_SLIDES);
        expect(loadExtras).not.toHaveBeenCalled();

        source.set({ _id: 'p2' });
        service.probe('p2', without);
        for (let i = 0; i < without.length; i++) {
            await settle();
        }
        expect(loadExtras).toHaveBeenCalledTimes(HERO_BACKDROP_PROBES);
        expect(service.pending('p2')).toBe(false);
    });

    it('looks once per source: a later visit asks nothing again', async () => {
        const service = create();
        service.probe('p1', [title(2)]);
        await settle();
        answer(2, 'https://img/bd-2.jpg');
        await settle();

        service.probe('p1', [title(4)]);
        await settle();

        expect(loadExtras).toHaveBeenCalledTimes(1);
        expect(service.found('p1')).toHaveLength(1);
    });

    it('moves on from a title page that does not answer', async () => {
        jest.useFakeTimers();
        const service = create();
        service.probe('p1', [title(2), title(3, 'https://img/bd-3.jpg')]);
        // The known backdrop first: no wait for it.
        await settle();
        expect(service.found('p1')).toHaveLength(1);

        jest.advanceTimersByTime(TITLE_PAGE_WAIT_MS);
        await settle();

        expect(service.pending('p1')).toBe(false);
        expect(service.found('p1')).toHaveLength(1);
    });

    it('asks the Home’s title pages one at a time, the hero’s and the rail’s', async () => {
        const service = create();
        const pages = TestBed.inject(HomeTitlePagesService);

        service.probe('p1', [title(2)]);
        const rail = [title(11), title(13)].map((item) => pages.fetch(item));
        await settle();
        expect(loadExtras.mock.calls.map(([item]) => item.id)).toEqual([2]);

        answer(2, null);
        await settle();
        expect(loadExtras.mock.calls.map(([item]) => item.id)).toEqual([2, 11]);

        answer(11, 'https://img/bd-11.jpg');
        answer(13, null);
        await settle();
        await expect(rail[0]).resolves.toMatchObject({
            backdrop: 'https://img/bd-11.jpg',
        });
        // 13's page came in meanwhile: not asked again.
        expect(loadExtras).toHaveBeenCalledTimes(2);
    });
});
