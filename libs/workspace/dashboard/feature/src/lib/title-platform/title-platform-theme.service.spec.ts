import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TitlePlatformStore } from '@iptvnator/services';
import { CatalogMembership } from '../catalog/catalog-membership';
import { PlatformThemeService } from '../platforms/platform-theme.service';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import {
    findStreamingPlatform,
    type PlatformShelf,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import { titlePlatform } from './title-platform-resolver';
import { TitlePlatformThemeService } from './title-platform-theme.service';

const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;
const PRIME = findStreamingPlatform('prime-video') as StreamingPlatform;
const SHELVES: PlatformShelf[] = [
    {
        platform: NETFLIX,
        categories: [{ id: '1610', kind: 'movie', language: 'ES' }],
    },
    {
        platform: PRIME,
        categories: [{ id: '1270', kind: 'series', language: 'EN' }],
    },
] as unknown as PlatformShelf[];

describe('titlePlatform', () => {
    const sources = {
        sourceId: 'p1',
        shelves: SHELVES,
        memberOf: (kind: 'movie' | 'series', id: number) =>
            kind === 'movie' && id === 77 ? PRIME : null,
    };

    it('reads the platform of the category the title was opened in', () => {
        expect(
            titlePlatform(
                { playlistId: 'p1', kind: 'movie', itemId: 1, categoryId: '1610' },
                sources
            )
        ).toBe(NETFLIX);
        expect(
            titlePlatform(
                { playlistId: 'p1', kind: 'series', itemId: 1, categoryId: 1270 },
                sources
            )
        ).toBe(PRIME);
    });

    it('reads it from the platforms’ own lists for a genre’s category (search, Mi lista, Continue watching)', () => {
        expect(
            titlePlatform(
                { playlistId: 'p1', kind: 'movie', itemId: 77, categoryId: '5' },
                sources
            )
        ).toBe(PRIME);
        expect(
            titlePlatform({ playlistId: 'p1', kind: 'movie', itemId: '77' }, sources)
        ).toBe(PRIME);
        expect(
            titlePlatform(
                { playlistId: 'p1', kind: 'movie', itemId: 78, categoryId: '5' },
                sources
            )
        ).toBeNull();
    });

    it('knows nothing of another source’s titles', () => {
        expect(
            titlePlatform(
                { playlistId: 'p2', kind: 'movie', itemId: 77, categoryId: '1610' },
                sources
            )
        ).toBeNull();
    });
});

describe('TitlePlatformThemeService', () => {
    const routePlatform = signal<StreamingPlatform | null>(null);
    const shelves = signal<PlatformShelf[] | null>(SHELVES);
    const loadShelves = jest.fn(async () => undefined);
    let service: TitlePlatformThemeService;
    let store: TitlePlatformStore;
    const root = document.documentElement;

    beforeEach(() => {
        routePlatform.set(null);
        shelves.set(SHELVES);
        loadShelves.mockClear();
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                {
                    provide: PlatformsCatalogService,
                    useValue: {
                        source: signal({ _id: 'p1' }),
                        shelves,
                        loadShelves,
                    },
                },
                {
                    provide: CatalogMembership,
                    useValue: {
                        platformOf: (kind: string, id: number) =>
                            kind === 'movie' && id === 77 ? PRIME : null,
                    },
                },
                {
                    provide: PlatformThemeService,
                    useValue: { platform: routePlatform },
                },
            ],
        });
        service = TestBed.inject(TitlePlatformThemeService);
        store = TestBed.inject(TitlePlatformStore);
        service.start();
    });

    afterEach(() => {
        root.removeAttribute('data-platform-theme');
        root.classList.remove('platform-ambient');
        root.style.removeProperty('--platform-ambient');
    });

    it('dresses a title opened outside its platform as that platform', () => {
        const release = store.show({
            playlistId: 'p1',
            kind: 'movie',
            itemId: 77,
            categoryId: '5',
        });
        expect(store.brand()?.name).toBe('Prime Video');

        service.reconcile();
        expect(root.getAttribute('data-platform-theme')).toBe('prime-video');
        expect(root.classList).toContain('platform-ambient');
        expect(root.style.getPropertyValue('--platform-ambient')).toBe(
            PRIME.ambient
        );

        release();
        service.reconcile();
        expect(root.hasAttribute('data-platform-theme')).toBe(false);
        expect(root.classList).not.toContain('platform-ambient');
    });

    it('leaves the marks to the platform page’s own theme', () => {
        store.show({ playlistId: 'p1', kind: 'movie', itemId: 77 });
        routePlatform.set(NETFLIX);
        root.setAttribute('data-platform-theme', 'netflix');

        service.reconcile();
        expect(root.getAttribute('data-platform-theme')).toBe('netflix');
    });

    it('puts its marks back if the platform theme took them off', () => {
        store.show({ playlistId: 'p1', kind: 'movie', itemId: 77 });
        service.reconcile();
        root.removeAttribute('data-platform-theme');

        service.reconcile();
        expect(root.getAttribute('data-platform-theme')).toBe('prime-video');
    });

    it('asks for the platforms’ categories when a title shows before them', () => {
        shelves.set(null);
        store.show({ playlistId: 'p1', kind: 'movie', itemId: 1 });
        TestBed.tick();
        expect(loadShelves).toHaveBeenCalled();
    });
});
