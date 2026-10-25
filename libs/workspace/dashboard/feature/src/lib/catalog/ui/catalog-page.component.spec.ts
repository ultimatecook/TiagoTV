import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../../platforms/streaming-platforms';
import { HomeTitlePagesService } from '../../rails/home-title-pages.service';
import type { CatalogExtras } from '../catalog-extras';
import type { CatalogTitle } from '../catalog-titles';
import { CatalogService } from '../catalog.service';
import { CatalogPageComponent } from './catalog-page.component';

const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;
const HBO = findStreamingPlatform('hbo-max') as StreamingPlatform;

const title = (
    id: number,
    name: string,
    platform: StreamingPlatform,
    genres: CatalogTitle['genres'],
    backdrop: string | null = `http://img/b${id}.jpg`
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
    backdrop,
    tmdb: null,
    year: 2020 + id,
    versions: [],
    platform,
    platforms: [platform],
});

const extrasWith = (backdrop: string | null): CatalogExtras => ({
    plot: null,
    backdrop,
    genres: [],
    year: null,
    minutes: null,
    seasons: null,
});

describe('CatalogPageComponent', () => {
    const titles = signal<readonly CatalogTitle[] | null>(null);
    const preparing = signal(false);
    /** The titles' pages fetched so far, by id. */
    const extras = signal<ReadonlyMap<number, CatalogExtras>>(new Map());
    /** What each title's page answers when asked, by id. */
    const pagesAnswer = new Map<number, CatalogExtras>();
    const catalog = {
        source: signal({ _id: 'p1' }),
        titles: jest.fn(() => titles()),
        status: jest.fn(() => (titles() ? 'ready' : 'loading')),
        preparing: jest.fn(() => preparing()),
        load: jest.fn(() => Promise.resolve()),
        heroLead: jest.fn(() => 0),
        extrasOf: jest.fn(
            (ref: Pick<CatalogTitle, 'id'>) => extras().get(ref.id) ?? null
        ),
        loadExtras: jest.fn(),
        open: jest.fn(),
        play: jest.fn(),
    };
    const pages = {
        fetch: jest.fn((ref: Pick<CatalogTitle, 'id'>) => {
            const answer = pagesAnswer.get(ref.id) ?? null;
            if (answer) {
                extras.update((state) => new Map(state).set(ref.id, answer));
            }
            return Promise.resolve(answer);
        }),
    };

    afterEach(() => jest.useRealTimers());

    beforeEach(() => {
        titles.set(null);
        preparing.set(false);
        extras.set(new Map());
        pagesAnswer.clear();
        jest.clearAllMocks();
        TestBed.configureTestingModule({
            imports: [CatalogPageComponent, TranslateModule.forRoot()],
            providers: [
                { provide: CatalogService, useValue: catalog },
                { provide: HomeTitlePagesService, useValue: pages },
            ],
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

    it('says the catalog is being prepared while the app imports it', () => {
        preparing.set(true);
        const fixture = render();
        const note = () =>
            fixture.nativeElement.querySelector(
                '.catalog__loading lib-page-state'
            )?.textContent;

        expect(catalog.preparing).toHaveBeenCalledWith('series');
        expect(note()).toContain('WORKSPACE.CATALOG.PREPARING');

        preparing.set(false);
        fixture.detectChanges();
        expect(note()).toContain('WORKSPACE.CATALOG.LOADING');
    });

    it('offers a retry when the catalog failed to load', () => {
        const status = catalog.status as jest.Mock<string>;
        status.mockReturnValue('failed');
        const fixture = render();
        const element: HTMLElement = fixture.nativeElement;
        expect(
            element.querySelector('[data-test-id="catalog-failed"]')
                ?.textContent
        ).toContain('WORKSPACE.CATALOG.FAILED');
        catalog.load.mockClear();

        element
            .querySelector<HTMLButtonElement>(
                '[data-test-id="page-state-retry"]'
            )
            ?.click();

        expect(catalog.load).toHaveBeenCalledWith('series');
        status.mockImplementation(() => (titles() ? 'ready' : 'loading'));
    });

    it("keeps its hero while more platforms' lists arrive", () => {
        jest.useFakeTimers();
        titles.set([title(1, 'DARK', NETFLIX, ['drama'])]);
        const fixture = render();
        const heroTitle = () =>
            fixture.nativeElement
                .querySelector('.hero__title')
                ?.textContent?.trim();
        jest.advanceTimersByTime(500);
        expect(heroTitle()).toBe('DARK');

        // HBO Max answers: it now leads "Novedades".
        titles.set([
            title(2, 'SUCCESSION', HBO, ['drama']),
            title(1, 'DARK', NETFLIX, ['drama']),
        ]);
        fixture.detectChanges();
        jest.advanceTimersByTime(500);

        expect(heroTitle()).toBe('DARK');
        // Only its page is asked for (the service asks once per title).
        expect(
            catalog.loadExtras.mock.calls.map(
                ([featured]: [CatalogTitle]) => featured.id
            )
        ).not.toContain(2);
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

        // "Reproducir" plays the title on its page; "Más info" opens it.
        element
            .querySelector<HTMLButtonElement>(
                '[data-test-id="catalog-hero-play"]'
            )
            ?.click();
        expect(catalog.play).toHaveBeenCalledWith(
            expect.objectContaining({ id: 2 }),
            'resume'
        );
        expect(catalog.open).not.toHaveBeenCalled();
        element
            .querySelector<HTMLButtonElement>(
                '[data-test-id="catalog-hero-more"]'
            )
            ?.click();
        expect(catalog.open).toHaveBeenCalledWith(
            expect.objectContaining({ id: 2 })
        );
    });

    describe('only over a backdrop', () => {
        const heroTitle = (element: HTMLElement) =>
            element.querySelector('.hero__title')?.textContent?.trim();
        const heroImages = (element: HTMLElement) =>
            Array.from(
                element.querySelectorAll<HTMLImageElement>(
                    '.hero__backdrop img'
                )
            ).map((image) => image.getAttribute('src'));
        const settle = async (fixture: { detectChanges(): void }) => {
            for (let i = 0; i < 10; i++) {
                await Promise.resolve();
                fixture.detectChanges();
            }
        };

        it('features the first release with a backdrop, never a poster', () => {
            titles.set([
                title(1, 'DARK', NETFLIX, ['drama'], null),
                title(2, 'SUCCESSION', HBO, ['drama']),
            ]);
            const fixture = render();
            const element: HTMLElement = fixture.nativeElement;

            expect(heroTitle(element)).toBe('SUCCESSION');
            expect(heroImages(element)).toEqual(['http://img/b2.jpg']);
            // Both still in "Novedades": a card is no banner.
            expect(
                element.querySelector(
                    '[data-test-id="catalog-release-series:1"]'
                )
            ).not.toBeNull();
            expect(pages.fetch).not.toHaveBeenCalled();
        });

        it("asks a few releases' pages, one at a time, until one has a backdrop", async () => {
            titles.set([
                title(1, 'DARK', NETFLIX, ['drama'], null),
                title(2, 'SUCCESSION', HBO, ['drama'], null),
                title(3, 'EUPHORIA', HBO, ['comedy'], null),
            ]);
            pagesAnswer.set(1, extrasWith(null));
            pagesAnswer.set(2, extrasWith('http://img/page2.jpg'));
            const fixture = render();
            const element: HTMLElement = fixture.nativeElement;

            // Meanwhile the section's name alone: no title, no artwork.
            expect(element.querySelector('.hero__heading')).not.toBeNull();
            expect(element.querySelector('.hero__info')).toBeNull();
            expect(heroImages(element)).toEqual([]);

            await settle(fixture);

            expect(pages.fetch.mock.calls.map(([ref]) => ref.id)).toEqual([
                1, 2,
            ]);
            expect(heroTitle(element)).toBe('SUCCESSION');
            expect(heroImages(element)).toEqual(['http://img/page2.jpg']);
        });

        it('asks no more than a handful of pages when none has one', async () => {
            titles.set(
                [1, 2, 3, 4, 5].map((id) =>
                    title(id, `T${id}`, NETFLIX, ['drama'], null)
                )
            );
            [1, 2, 3, 4, 5].forEach((id) =>
                pagesAnswer.set(id, extrasWith(null))
            );
            const fixture = render();
            const element: HTMLElement = fixture.nativeElement;

            await settle(fixture);
            titles.set([...(titles() ?? [])]);
            await settle(fixture);

            expect(pages.fetch).toHaveBeenCalledTimes(3);
            expect(element.querySelector('.hero__info')).toBeNull();
            expect(heroImages(element)).toEqual([]);
        });

        it('drops a title whose backdrop fails to load, or is a poster', () => {
            titles.set([
                title(1, 'DARK', NETFLIX, ['drama']),
                title(2, 'SUCCESSION', HBO, ['drama']),
                title(3, 'EUPHORIA', HBO, ['comedy']),
            ]);
            const fixture = render();
            const element: HTMLElement = fixture.nativeElement;
            const art = () =>
                element.querySelector<HTMLImageElement>(
                    '[data-test-id="catalog-hero-art"]'
                ) as HTMLImageElement;
            expect(heroTitle(element)).toBe('DARK');

            art().dispatchEvent(new Event('error'));
            fixture.detectChanges();
            expect(heroTitle(element)).toBe('SUCCESSION');
            expect(heroImages(element)).toEqual(['http://img/b2.jpg']);

            Object.defineProperty(art(), 'naturalWidth', { value: 342 });
            Object.defineProperty(art(), 'naturalHeight', { value: 513 });
            art().dispatchEvent(new Event('load'));
            fixture.detectChanges();
            expect(heroTitle(element)).toBe('EUPHORIA');
        });

        it('opens the page of a release picked without a backdrop', async () => {
            titles.set([
                title(1, 'DARK', NETFLIX, ['drama']),
                title(2, 'SUCCESSION', HBO, ['drama'], null),
                title(3, 'EUPHORIA', HBO, ['comedy'], null),
            ]);
            pagesAnswer.set(2, extrasWith(null));
            pagesAnswer.set(3, extrasWith('http://img/page3.jpg'));
            const fixture = render();
            const element: HTMLElement = fixture.nativeElement;
            const pick = (id: number) =>
                element
                    .querySelector<HTMLButtonElement>(
                        `[data-test-id="catalog-release-series:${id}"]`
                    )
                    ?.click();

            pick(2);
            await settle(fixture);
            expect(catalog.open).toHaveBeenCalledWith(
                expect.objectContaining({ id: 2 })
            );
            expect(heroTitle(element)).toBe('DARK');

            // Its page names a backdrop: featured.
            pick(3);
            await settle(fixture);
            expect(catalog.open).toHaveBeenCalledTimes(1);
            expect(heroTitle(element)).toBe('EUPHORIA');
            expect(heroImages(element)).toEqual(['http://img/page3.jpg']);
        });
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
