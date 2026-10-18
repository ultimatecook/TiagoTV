import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PlatformsCatalogService } from './platforms-catalog.service';
import { PlatformThemeService } from './platform-theme.service';
import {
    buildPlatformShelves,
    type PlatformShelf,
} from './streaming-platforms';

@Component({ template: '' })
class BlankPageComponent {}

describe('PlatformThemeService', () => {
    const root = document.documentElement;
    const built = buildPlatformShelves(
        [{ category_id: 1610, category_name: '|ES| ✪ ORIGINAL NETFLIX' }],
        [{ category_id: 1270, category_name: '|EN| ✪ AMAZON-PRIME' }]
    );
    let source: ReturnType<typeof signal<{ _id: string } | null>>;
    let shelves: ReturnType<typeof signal<PlatformShelf[] | null>>;
    let loadShelves: jest.Mock;

    beforeEach(() => {
        source = signal<{ _id: string } | null>(null);
        shelves = signal<PlatformShelf[] | null>(null);
        loadShelves = jest.fn(() => {
            shelves.set(built);
            return Promise.resolve();
        });
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                provideRouter([{ path: '**', component: BlankPageComponent }]),
                {
                    provide: PlatformsCatalogService,
                    useValue: { source, shelves, loadShelves },
                },
            ],
        });
    });

    afterEach(() => {
        root.removeAttribute('data-platform-theme');
        root.classList.remove('platform-ambient');
        root.style.removeProperty('--platform-ambient');
        root.style.removeProperty('--platform-included');
    });

    async function open(url: string): Promise<void> {
        await TestBed.inject(Router).navigateByUrl(url);
        TestBed.tick();
    }

    it('dresses the platform page and takes it off on leaving', async () => {
        TestBed.inject(PlatformThemeService).start();

        await open('/workspace/platforms/netflix');

        expect(root.getAttribute('data-platform-theme')).toBe('netflix');
        expect(root.classList).toContain('platform-ambient');
        expect(root.style.getPropertyValue('--platform-ambient')).toBe(
            '#e50914'
        );

        await open('/workspace/dashboard');

        expect(root.hasAttribute('data-platform-theme')).toBe(false);
        expect(root.classList).not.toContain('platform-ambient');
    });

    it('dresses a title page once the source and its platforms are known', async () => {
        TestBed.inject(PlatformThemeService).start();

        await open('/workspace/xtreams/p1/series/1270/127001');

        expect(loadShelves).not.toHaveBeenCalled();
        expect(root.hasAttribute('data-platform-theme')).toBe(false);

        source.set({ _id: 'p1' });
        TestBed.tick();
        TestBed.tick();

        expect(loadShelves).toHaveBeenCalledTimes(1);
        expect(root.getAttribute('data-platform-theme')).toBe('prime-video');
        expect(root.style.getPropertyValue('--platform-included')).toMatch(
            /^".+"$/
        );

        await open('/workspace/xtreams/p1/vod/1610/161001');

        expect(root.getAttribute('data-platform-theme')).toBe('netflix');
        expect(root.style.getPropertyValue('--platform-included')).toBe('');
    });

    it('starts once', async () => {
        const service = TestBed.inject(PlatformThemeService);
        service.start();
        service.start();

        await open('/workspace/platforms/apple-tv');

        expect(service.platform()?.id).toBe('apple-tv');
    });
});
