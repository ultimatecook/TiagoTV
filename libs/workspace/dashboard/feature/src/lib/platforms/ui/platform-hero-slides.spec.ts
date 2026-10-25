import { signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import type { PlatformTitleExtras } from '../platform-hero';
import type { PlatformTitle } from '../platform-titles';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../streaming-platforms';
import { PlatformBillboardComponent } from './platform-billboard.component';
import { PlatformCarouselComponent } from './platform-carousel.component';
import { PlatformHeroComponent } from './platform-hero.component';

const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;

const titleOf = (
    id: number,
    kind: PlatformTitle['kind'],
    backdrop: string | null
): PlatformTitle => ({
    id,
    kind,
    categoryId: '1',
    title: `TITLE ${id}`,
    poster: `http://img/poster${id}.jpg`,
    language: 'EN',
    added: 100 - id,
    genres: [],
    rating: 7,
    plot: null,
    backdrop,
    tmdb: null,
    year: null,
    versions: [],
});

const pageWith = (backdrop: string | null): PlatformTitleExtras => ({
    plot: 'From its page.',
    backdrop,
    genres: [],
});

const LOOKS: readonly [string, Type<unknown>, string][] = [
    ['hero', PlatformHeroComponent, '.hero__title'],
    ['billboard', PlatformBillboardComponent, '.billboard__title'],
    ['carousel', PlatformCarouselComponent, '.carousel__title'],
];

describe.each(LOOKS)(
    'a platform page’s %s: only titles with a backdrop',
    (look, component, titleSelector) => {
        const extras = signal<ReadonlyMap<number, PlatformTitleExtras>>(
            new Map()
        );
        const catalog = {
            extrasOf: (title: PlatformTitle) => extras().get(title.id) ?? null,
            loadExtras: jest.fn(),
            open: jest.fn(),
        };
        let fixture: ComponentFixture<unknown>;
        const element = () => fixture.nativeElement as HTMLElement;
        const images = () =>
            Array.from(element().querySelectorAll('img'))
                .map((image) => image.getAttribute('src') ?? '')
                .filter((src) => !src.includes('/assets/'));
        const shown = () =>
            element().querySelector(titleSelector)?.textContent?.trim();

        function render(titles: readonly PlatformTitle[]) {
            TestBed.configureTestingModule({
                imports: [component, TranslateModule.forRoot()],
                providers: [
                    { provide: PlatformsCatalogService, useValue: catalog },
                ],
            });
            fixture = TestBed.createComponent(component);
            fixture.componentRef.setInput('platform', NETFLIX);
            fixture.componentRef.setInput('titles', titles);
            if (look !== 'hero') {
                fixture.componentRef.setInput('look', 'netflix');
            }
            fixture.detectChanges();
        }

        beforeEach(() => {
            extras.set(new Map());
            jest.clearAllMocks();
        });

        it('shows no poster: a title waits for its backdrop, or is left out', () => {
            render([
                titleOf(1, 'movie', null),
                titleOf(2, 'series', 'http://img/b2.jpg'),
                titleOf(3, 'movie', null),
            ]);

            // Every title's page is asked, as before, for its backdrop.
            expect(catalog.loadExtras).toHaveBeenCalledWith([
                expect.objectContaining({ id: 1 }),
                expect.objectContaining({ id: 2 }),
                expect.objectContaining({ id: 3 }),
            ]);
            expect(images()).toEqual(['http://img/b2.jpg']);
            expect(shown()).toBe('TITLE 2');

            // Its page gives the first a backdrop; the third's has none.
            extras.set(
                new Map([
                    [1, pageWith('http://img/page1.jpg')],
                    [3, pageWith(null)],
                ])
            );
            fixture.detectChanges();

            expect(images()).toEqual([
                'http://img/page1.jpg',
                'http://img/b2.jpg',
            ]);
            expect(images().some((src) => src.includes('poster'))).toBe(false);
            // The slide showing stays while another arrives.
            expect(shown()).toBe('TITLE 2');
        });

        it('drops a slide whose backdrop fails to load, or is a portrait', () => {
            render([
                titleOf(1, 'series', 'http://img/b1.jpg'),
                titleOf(2, 'series', 'http://img/b2.jpg'),
                titleOf(3, 'series', 'http://img/b3.jpg'),
            ]);
            const image = (src: string) =>
                element().querySelector(`img[src="${src}"]`) as HTMLElement;
            expect(shown()).toBe('TITLE 1');

            image('http://img/b1.jpg').dispatchEvent(new Event('error'));
            fixture.detectChanges();

            expect(images()).toEqual([
                'http://img/b2.jpg',
                'http://img/b3.jpg',
            ]);
            expect(shown()).toBe('TITLE 2');

            const portrait = image('http://img/b3.jpg');
            Object.defineProperty(portrait, 'naturalWidth', { value: 500 });
            Object.defineProperty(portrait, 'naturalHeight', { value: 750 });
            portrait.dispatchEvent(new Event('load'));
            fixture.detectChanges();

            expect(images()).toEqual(['http://img/b2.jpg']);
            expect(shown()).toBe('TITLE 2');
        });

        it('shows no art and no title when none has a backdrop', () => {
            render([titleOf(1, 'movie', null), titleOf(2, 'movie', null)]);
            extras.set(
                new Map([
                    [1, pageWith(null)],
                    [2, pageWith(null)],
                ])
            );
            fixture.detectChanges();

            expect(images()).toEqual([]);
            expect(shown()).toBeUndefined();
        });
    }
);
