import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../../platforms/streaming-platforms';
import type { CatalogTitle } from '../catalog-titles';
import { CatalogService } from '../catalog.service';
import { CatalogPageComponent } from './catalog-page.component';

const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;
const HBO = findStreamingPlatform('hbo-max') as StreamingPlatform;

const title = (
    id: number,
    name: string,
    platform: StreamingPlatform,
    genres: CatalogTitle['genres']
): CatalogTitle => ({
    id,
    kind: 'series',
    categoryId: '1',
    title: name,
    poster: `http://img/${id}.jpg`,
    language: 'ES',
    added: 100 - id,
    genres,
    rating: 8,
    plot: null,
    backdrop: null,
    tmdb: null,
    year: 2020 + id,
    versions: [],
    platform,
    platforms: [platform],
});

describe('CatalogPageComponent', () => {
    const titles = signal<readonly CatalogTitle[] | null>(null);
    const catalog = {
        source: signal({ _id: 'p1' }),
        titles: jest.fn(() => titles()),
        status: jest.fn(() => (titles() ? 'ready' : 'loading')),
        load: jest.fn(() => Promise.resolve()),
        extrasOf: jest.fn(() => null),
        loadExtras: jest.fn(),
        open: jest.fn(),
    };

    afterEach(() => jest.useRealTimers());

    beforeEach(() => {
        titles.set(null);
        jest.clearAllMocks();
        TestBed.configureTestingModule({
            imports: [CatalogPageComponent, TranslateModule.forRoot()],
            providers: [{ provide: CatalogService, useValue: catalog }],
        });
    });

    function render() {
        const fixture = TestBed.createComponent(CatalogPageComponent);
        fixture.componentRef.setInput('kind', 'series');
        fixture.detectChanges();
        return fixture;
    }

    it('loads its kind and shows the loading state meanwhile', () => {
        const fixture = render();

        expect(catalog.load).toHaveBeenCalledWith('series');
        const element: HTMLElement = fixture.nativeElement;
        expect(element.querySelector('[role="status"]')).not.toBeNull();
        expect(element.querySelector('lib-catalog-hero')).toBeNull();
    });

    it('features a picked release without leaving the page', () => {
        jest.useFakeTimers();
        titles.set([
            title(1, 'DARK', NETFLIX, ['drama', 'mystery']),
            title(2, 'SUCCESSION', HBO, ['drama']),
            title(3, 'EUPHORIA', HBO, ['comedy']),
        ]);
        const fixture = render();
        const element: HTMLElement = fixture.nativeElement;
        const heroTitle = () =>
            element.querySelector('.hero__title')?.textContent?.trim();

        expect(heroTitle()).toBe('DARK');
        // Its page is asked once it stays featured a moment.
        expect(catalog.loadExtras).not.toHaveBeenCalled();
        jest.advanceTimersByTime(500);
        expect(catalog.loadExtras).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 1 })
        );

        const release = element.querySelector<HTMLButtonElement>(
            '[data-test-id="catalog-release-series:2"]'
        );
        release?.click();
        fixture.detectChanges();

        expect(heroTitle()).toBe('SUCCESSION');
        expect(release?.getAttribute('aria-pressed')).toBe('true');
        expect(catalog.open).not.toHaveBeenCalled();
        jest.advanceTimersByTime(500);
        expect(catalog.loadExtras).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 2 })
        );

        element
            .querySelector<HTMLButtonElement>(
                '[data-test-id="catalog-hero-play"]'
            )
            ?.click();
        expect(catalog.open).toHaveBeenCalledWith(
            expect.objectContaining({ id: 2 })
        );
    });

    it('lays out one row per genre with two titles or more', () => {
        titles.set([
            title(1, 'DARK', NETFLIX, ['drama', 'mystery']),
            title(2, 'SUCCESSION', HBO, ['drama']),
            title(3, 'EUPHORIA', HBO, ['comedy']),
        ]);
        const fixture = render();
        const element: HTMLElement = fixture.nativeElement;

        expect(
            Array.from(element.querySelectorAll('lib-catalog-row section')).map(
                (row) => row.getAttribute('data-test-id')
            )
        ).toEqual(['catalog-row-drama']);
    });
});
