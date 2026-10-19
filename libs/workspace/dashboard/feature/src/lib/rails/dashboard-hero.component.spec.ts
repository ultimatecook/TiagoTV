import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import {
    STREAMING_PLATFORMS,
    type PlatformShelf,
} from '../platforms/streaming-platforms';
import { DashboardHeroComponent } from './dashboard-hero.component';
import { DashboardHeroSlidesPresenter } from './dashboard-hero-slides.presenter';
import type { DashboardHeroSlide } from './dashboard-hero.utils';

const slide = (id: string, title: string): DashboardHeroSlide => ({
    id,
    kind: 'continue',
    contentType: 'movie',
    playlistId: 'p',
    categoryId: '1',
    title,
    typeLabelKey: 'WORKSPACE.DASHBOARD.TYPE_MOVIE',
    reasonLabelKey: 'WORKSPACE.DASHBOARD.CONTINUE_WATCHING',
    episodeBadge: null,
    rating: null,
    genres: [],
    year: null,
    source: 'Source',
    programmeTitle: null,
    category: null,
    timeRange: null,
    description: null,
    progress: null,
    accentHue: 200,
    backdropSource: 'fallback',
    hasBackdrop: false,
    primaryAction: {
        labelKey: 'WORKSPACE.DASHBOARD.HERO_CONTINUE',
        icon: 'play_arrow',
        link: ['/workspace', id],
        testId: 'dashboard-hero-primary-action',
    },
    secondaryAction: null,
});

describe('DashboardHeroComponent', () => {
    let fixture: ComponentFixture<DashboardHeroComponent>;
    let slides: ReturnType<typeof signal<DashboardHeroSlide[]>>;
    let reducedMotion: boolean;
    let shelves: ReturnType<typeof signal<PlatformShelf[] | null>>;

    const host = () => fixture.nativeElement as HTMLElement;
    const activeTitle = () =>
        host().querySelector('[data-test-id=dashboard-hero-slide] h2')
            ?.textContent;
    const dots = () =>
        Array.from(
            host().querySelectorAll<HTMLButtonElement>(
                '[data-test-id=dashboard-hero-dot]'
            )
        );
    const finishActiveDot = () => {
        const timer = host().querySelector(
            '.hero__dot--active .hero__dot-timer'
        ) as HTMLElement;
        timer.dispatchEvent(new Event('animationend'));
        fixture.detectChanges();
    };

    function render(): void {
        window.matchMedia = jest.fn().mockReturnValue({
            matches: reducedMotion,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        });
        TestBed.configureTestingModule({
            imports: [DashboardHeroComponent, TranslateModule.forRoot()],
            providers: [
                provideRouter([]),
                {
                    provide: PlatformsCatalogService,
                    useValue: {
                        shelves,
                        source: signal({ _id: 'p' }),
                        loadShelves: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        });
        TestBed.overrideComponent(DashboardHeroComponent, {
            set: {
                providers: [
                    {
                        provide: DashboardHeroSlidesPresenter,
                        useValue: {
                            slides,
                            loading: signal(false),
                            markImageFailed: jest.fn(),
                        },
                    },
                ],
            },
        });
        fixture = TestBed.createComponent(DashboardHeroComponent);
        fixture.detectChanges();
    }

    beforeEach(() => {
        reducedMotion = false;
        shelves = signal(null);
        slides = signal([
            slide('a', 'First'),
            slide('b', 'Second'),
            slide('c', 'Third'),
        ]);
    });

    it('advances when the active dot finishes its rotation interval', () => {
        render();
        expect(activeTitle()).toBe('First');

        finishActiveDot();
        expect(activeTitle()).toBe('Second');

        finishActiveDot();
        finishActiveDot();
        expect(activeTitle()).toBe('First');
    });

    it('does not advance while the pointer or focus is inside the hero', () => {
        render();
        const section = host().querySelector(
            '[data-test-id=dashboard-hero]'
        ) as HTMLElement;

        section.dispatchEvent(new Event('mouseenter'));
        fixture.detectChanges();
        expect(section.classList).toContain('hero--paused');
        finishActiveDot();
        expect(activeTitle()).toBe('First');

        section.dispatchEvent(new Event('mouseleave'));
        fixture.detectChanges();
        finishActiveDot();
        expect(activeTitle()).toBe('Second');
    });

    it('switches slides from the dots, with roving arrow keys', () => {
        render();

        dots()[2].click();
        fixture.detectChanges();
        expect(activeTitle()).toBe('Third');
        expect(dots()[2].getAttribute('aria-current')).toBe('true');
        expect(dots()[2].tabIndex).toBe(0);
        expect(dots()[0].tabIndex).toBe(-1);

        dots()[2].dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight' })
        );
        fixture.detectChanges();
        expect(activeTitle()).toBe('First');
    });

    it('keeps the current slide when a slide arrives late', () => {
        render();
        dots()[1].click();
        fixture.detectChanges();

        slides.set([
            slide('a', 'First'),
            slide('live', 'Live channel'),
            slide('b', 'Second'),
            slide('c', 'Third'),
        ]);
        fixture.detectChanges();

        expect(activeTitle()).toBe('Second');
        expect(dots()).toHaveLength(4);
    });

    it('keeps the first slide when a slide arrives ahead of it untouched', () => {
        slides.set([slide('fav', 'Favourite'), slide('added', 'Import')]);
        render();
        expect(activeTitle()).toBe('Favourite');

        slides.set([
            slide('live', 'Live channel'),
            slide('fav', 'Favourite'),
            slide('added', 'Import'),
        ]);
        fixture.detectChanges();

        expect(activeTitle()).toBe('Favourite');
    });

    it('shows the slide now at the same position when the active one goes', () => {
        render();
        dots()[1].click();
        fixture.detectChanges();

        slides.set([slide('a', 'First'), slide('c', 'Third')]);
        fixture.detectChanges();

        expect(activeTitle()).toBe('Third');
    });

    it('never auto-rotates under reduced motion, but the dots still work', () => {
        reducedMotion = true;
        render();

        expect(
            host()
                .querySelector('[data-test-id=dashboard-hero]')
                ?.classList.contains('hero--rotating')
        ).toBe(false);
        finishActiveDot();
        expect(activeTitle()).toBe('First');

        dots()[1].click();
        fixture.detectChanges();
        expect(activeTitle()).toBe('Second');
    });

    it('renders a single slide without rotation controls', () => {
        slides.set([slide('a', 'Only')]);
        render();

        expect(activeTitle()).toBe('Only');
        expect(dots()).toHaveLength(0);
        expect(
            host()
                .querySelector('[data-test-id=dashboard-hero-primary-action]')
                ?.getAttribute('href')
        ).toBe('/workspace/a');
    });

    it('lays out every slide but shows and exposes only the active one', () => {
        // The hero is as tall as its tallest slide only while every slide
        // stays in flow; re-creating one slide per change resized it.
        render();
        const contents = () =>
            Array.from(host().querySelectorAll<HTMLElement>('.hero__content'));
        const inert = () => contents().map((el) => el.hasAttribute('inert'));
        const [first, second] = contents();
        expect(inert()).toEqual([false, true, true]);
        const hooks = (testId: string) =>
            Array.from(host().querySelectorAll(`[data-test-id=${testId}]`));
        for (const testId of [
            'dashboard-hero-slide',
            'dashboard-hero-badges',
            'dashboard-hero-primary-action',
        ]) {
            expect(hooks(testId)).toHaveLength(1);
            expect(first.contains(hooks(testId)[0])).toBe(true);
        }

        finishActiveDot();

        expect(contents()).toHaveLength(3);
        expect(contents()[0]).toBe(first);
        expect(contents()[1]).toBe(second);
        expect(inert()).toEqual([true, false, true]);
        expect(second.getAttribute('data-test-id')).toBe(
            'dashboard-hero-slide'
        );
        expect(first.hasAttribute('data-test-id')).toBe(false);
    });

    it('follows Enter to the primary action of the slide on screen', () => {
        render();
        const section = host().querySelector(
            '[data-test-id=dashboard-hero]'
        ) as HTMLElement;
        const followed: (string | null)[] = [];
        host()
            .querySelectorAll<HTMLElement>('.hero__button--primary')
            .forEach((button) =>
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    followed.push(button.getAttribute('href'));
                })
            );

        dots()[1].click();
        fixture.detectChanges();
        section.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        expect(followed).toEqual(['/workspace/b']);
    });

    it('titles each slide with an h2 and leaves the h1 to the page', () => {
        render();

        expect(host().querySelector('h1')).toBeNull();
        expect(activeTitle()).toBe('First');
    });

    it('announces slide changes through one live region that outlives the slides', () => {
        // A live region inserted together with its text is not announced (a
        // slide can arrive late) and the slides not on screen are inert, so
        // it must not belong to a slide.
        render();
        const announcement = () =>
            host().querySelector<HTMLElement>(
                '[data-test-id=dashboard-hero-announcement]'
            );
        const region = announcement();
        expect(region).not.toBeNull();
        expect(
            region?.closest('[data-test-id=dashboard-hero-slide]')
        ).toBeNull();
        expect(
            host()
                .querySelector('[data-test-id=dashboard-hero-slide]')
                ?.hasAttribute('aria-live')
        ).toBe(false);
        // Rotating on its own: silent.
        expect(region?.getAttribute('aria-live')).toBe('off');
        expect(region?.textContent).toContain('First');

        const section = host().querySelector(
            '[data-test-id=dashboard-hero]'
        ) as HTMLElement;
        section.dispatchEvent(new Event('focusin'));
        dots()[1].click();
        fixture.detectChanges();

        expect(announcement()).toBe(region);
        expect(region?.getAttribute('aria-live')).toBe('polite');
        expect(region?.getAttribute('aria-atomic')).toBe('true');
        expect(region?.textContent).toContain('Second');
    });

    it('names the progress bar after what is progressing', () => {
        slides.set([
            { ...slide('a', 'Movie'), progress: 42 },
            {
                ...slide('b', 'Channel'),
                contentType: 'live',
                programmeTitle: 'Evening programme',
                progress: 10,
            },
        ]);
        render();
        const bar = () =>
            host().querySelector(
                '[data-test-id=dashboard-hero-slide] [role=progressbar]'
            );

        expect(bar()?.getAttribute('aria-label')).toBe('Movie');
        // The translate pipe echoes the key in this test bed.
        expect(bar()?.getAttribute('aria-valuetext')).toBe(
            'WORKSPACE.DASHBOARD.PERCENT_WATCHED'
        );

        dots()[1].click();
        fixture.detectChanges();
        expect(bar()?.getAttribute('aria-label')).toBe('Evening programme');
        // Elapsed share of a live programme: the plain percentage.
        expect(bar()?.hasAttribute('aria-valuetext')).toBe(false);
        expect(bar()?.getAttribute('aria-valuenow')).toBe('10');
    });

    it('positions the progress fill through a custom property, never its width', () => {
        // Animating width re-lays out the page on every live-EPG tick; the
        // stylesheet slides the fill with a transform driven by this property.
        slides.set([
            { ...slide('a', 'Live'), contentType: 'live', progress: 42 },
        ]);
        render();

        const fill = host().querySelector<HTMLElement>('.hero__progress i');
        expect(fill?.style.getPropertyValue('--hero-progress')).toBe('42');
        expect(fill?.style.width).toBe('');
    });

    it('renders nothing when there is nothing to feature', () => {
        slides.set([]);
        render();

        expect(
            host().querySelector('[data-test-id=dashboard-hero]')
        ).toBeNull();
    });

    it('switches slides with the arrow keys and follows Enter on the hero itself', () => {
        render();
        const section = host().querySelector(
            '[data-test-id=dashboard-hero]'
        ) as HTMLElement;
        expect(section.getAttribute('tabindex')).toBe('0');

        section.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );
        fixture.detectChanges();
        expect(activeTitle()).toBe('Second');

        section.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
        );
        fixture.detectChanges();
        expect(activeTitle()).toBe('First');

        const primary = host().querySelector<HTMLElement>(
            '[data-test-id=dashboard-hero-primary-action]'
        ) as HTMLElement;
        const clicked = jest.fn();
        primary.addEventListener('click', (event) => {
            event.preventDefault();
            clicked();
        });
        section.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
        expect(clicked).toHaveBeenCalledTimes(1);

        // Keys pressed inside a control belong to that control.
        const dot = dots()[0];
        dot.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('names the platform of a title filed in one of its categories', () => {
        const netflix = STREAMING_PLATFORMS[0];
        shelves.set([
            {
                platform: netflix,
                categories: [{ id: '1', kind: 'movie', language: 'ES' }],
            },
        ]);
        slides.set([
            slide('a', 'Filed'),
            { ...slide('b', 'Elsewhere'), categoryId: '9' },
        ]);
        render();
        const logo = () =>
            host().querySelector<HTMLImageElement>(
                '[data-test-id=dashboard-hero-slide] .hero__platform'
            );

        expect(logo()?.getAttribute('alt')).toBe(netflix.name);
        dots()[1].click();
        fixture.detectChanges();
        expect(logo()).toBeNull();
    });

    it('says "Seguir viendo" over an unfinished title and why the others are there', () => {
        slides.set([
            slide('a', 'Unfinished'),
            {
                ...slide('b', 'Import'),
                kind: 'added',
                reasonLabelKey: 'WORKSPACE.DASHBOARD.HERO_RECENTLY_ADDED',
            },
        ]);
        render();
        const eyebrow = () =>
            host()
                .querySelector(
                    '[data-test-id=dashboard-hero-slide] .hero__eyebrow'
                )
                ?.textContent?.trim();

        expect(eyebrow()).toBe('WORKSPACE.DASHBOARD.KEEP_WATCHING');
        dots()[1].click();
        fixture.detectChanges();
        expect(eyebrow()).toBe('WORKSPACE.DASHBOARD.HERO_RECENTLY_ADDED');
    });

    it('pauses the rotation while the document is hidden', () => {
        const visibility = jest
            .spyOn(document, 'visibilityState', 'get')
            .mockReturnValue('visible');
        render();
        const section = host().querySelector(
            '[data-test-id=dashboard-hero]'
        ) as HTMLElement;
        expect(section.classList).not.toContain('hero--paused');

        visibility.mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        fixture.detectChanges();
        expect(section.classList).toContain('hero--paused');

        visibility.mockReturnValue('visible');
        document.dispatchEvent(new Event('visibilitychange'));
        fixture.detectChanges();
        expect(section.classList).not.toContain('hero--paused');
        visibility.mockRestore();
    });
});

describe('DashboardHeroComponent rotation animation', () => {
    const styles = readFileSync(
        resolve(__dirname, 'dashboard-hero.component.scss'),
        'utf8'
    );
    const keyframes = (name: string) =>
        new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(
            styles
        )?.[1] ?? '';

    // The timer runs for the whole time an idle Home is on screen: a
    // layout property here means style, layout and paint on every frame.
    it('times the active indicator with a compositor-only animation', () => {
        const frames = keyframes('hero-slide-timer');
        const properties = Array.from(
            frames.matchAll(/^\s*([a-z-]+)\s*:/gm),
            (match) => match[1]
        );

        expect(properties.length).toBeGreaterThan(0);
        expect(new Set(properties)).toEqual(new Set(['transform']));
    });
});
