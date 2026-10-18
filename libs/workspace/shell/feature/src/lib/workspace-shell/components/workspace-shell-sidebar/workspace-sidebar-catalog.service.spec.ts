import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    PlatformsCatalogService,
    SportsCatalogService,
} from '@iptvnator/workspace/dashboard/feature';
import { WorkspaceSidebarCatalogService } from './workspace-sidebar-catalog.service';

describe('WorkspaceSidebarCatalogService', () => {
    const source = signal<{ _id: string } | null>(null);
    const shelves = signal<unknown[] | null>(null);
    const liveChannels = signal<unknown[]>([]);
    const platforms = { source, shelves, loadShelves: jest.fn() };
    const sports = {
        liveChannels,
        loading: signal(false),
        load: jest.fn(),
        play: jest.fn(),
    };

    beforeEach(() => {
        source.set(null);
        shelves.set(null);
        liveChannels.set([]);
        jest.clearAllMocks();
        TestBed.configureTestingModule({
            providers: [
                { provide: PlatformsCatalogService, useValue: platforms },
                { provide: SportsCatalogService, useValue: sports },
            ],
        });
    });

    it('lists the platforms the source carries, once loaded', () => {
        const catalog = TestBed.inject(WorkspaceSidebarCatalogService);
        expect(catalog.hasSource()).toBe(false);
        expect(catalog.platforms()).toBeNull();

        source.set({ _id: 'p1' });
        shelves.set([
            {
                platform: {
                    id: 'netflix',
                    name: 'Netflix',
                    logo: './assets/platforms/netflix.svg',
                    logoTone: 'brand',
                    wordmarkColor: '#e50914',
                    background: '#000',
                },
                categories: [],
            },
            {
                platform: {
                    id: 'hulu',
                    name: 'hulu',
                    logo: null,
                    logoTone: 'brand',
                    wordmarkColor: '#1ce783',
                    background: '#111',
                },
                categories: [],
            },
        ]);

        expect(catalog.hasSource()).toBe(true);
        expect(catalog.platforms()).toEqual([
            expect.objectContaining({
                id: 'netflix',
                label: 'Netflix',
                link: ['/workspace', 'platforms', 'netflix'],
                chip: expect.objectContaining({
                    logo: './assets/platforms/netflix.svg',
                    whiteLogo: false,
                }),
            }),
            expect.objectContaining({
                id: 'hulu',
                chip: expect.objectContaining({
                    logo: null,
                    letter: 'H',
                    letterColor: '#1ce783',
                }),
            }),
        ]);

        catalog.loadPlatforms();
        expect(platforms.loadShelves).toHaveBeenCalledTimes(1);
    });

    it('opens every competition of the Home', () => {
        const catalog = TestBed.inject(WorkspaceSidebarCatalogService);

        expect(catalog.sports.length).toBeGreaterThan(5);
        expect(catalog.sports[0]).toEqual(
            expect.objectContaining({
                id: 'premier-league',
                link: ['/workspace', 'sports', 'premier-league'],
            })
        );
    });

    it('plays a live channel brand from its row', () => {
        const catalog = TestBed.inject(WorkspaceSidebarCatalogService);
        const channel = { streamId: 7, categoryId: '1', title: 'ESPN' };
        liveChannels.set([
            {
                brand: {
                    id: 'espn',
                    name: 'ESPN',
                    logo: null,
                    background: '#b0101c',
                },
                channel,
                icon: 'https://logo.example/espn.png',
            },
        ]);

        const [row] = catalog.liveChannels();
        expect(row.chip.logo).toBe('https://logo.example/espn.png');
        row.run?.();
        expect(sports.play).toHaveBeenCalledWith(channel);

        catalog.loadLiveChannels();
        expect(sports.load).toHaveBeenCalledTimes(1);
    });
});
