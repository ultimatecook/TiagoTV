import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    linkedSignal,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import type { StreamingPlatform } from '../platforms/streaming-platforms';
import { DashboardHeroSlidesPresenter } from './dashboard-hero-slides.presenter';
import { HERO_ROTATION_MS } from './dashboard-hero-slides.utils';
import type { DashboardHeroSlide } from './dashboard-hero.utils';
import { heroEyebrowKey, heroMetaParts } from './home-hero.utils';
import { platformOfCategory } from './home-platform-titles';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The Home's "Seguir viendo" hero: an automatic slider that bleeds up
 * behind the top bar. Each slide is an unfinished title (then, when
 * there are few, a channel on air and a few discovery picks; see
 * `pickDashboardHeroSources`) over its backdrop, or the title-tinted
 * gradient where it has none: its platform's logo, the title in Bebas,
 * how far it was watched, Continue and More info.
 *
 * Rotation is driven by the active indicator's (invisible) timer
 * animation: its `animationend` advances the slide, so pausing (pointer or
 * focus inside the hero, a hidden document) is just
 * `animation-play-state: paused`, and picking a slide restarts the timer.
 * With `prefers-reduced-motion` there is no animation and therefore no
 * auto-advance; the indicators still switch slides.
 *
 * The active slide is tracked by id, so a slide that arrives late (the live
 * slide waits for its EPG answer) never yanks the user off the current one.
 * Every slide is laid out and only the active one is shown, so the hero is
 * as tall as its tallest slide and a rotation never resizes it.
 *
 * The hero is a focusable region: ←/→ switch slides, Enter follows the
 * primary action.
 */
@Component({
    selector: 'lib-dashboard-hero',
    imports: [MatIcon, RouterLink, TranslatePipe],
    templateUrl: './dashboard-hero.component.html',
    styleUrl: './dashboard-hero.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    // The presenter comes from the page (`lib-workspace-dashboard-rails`),
    // which also reads it to decide whether the hero shows at all.
    host: {
        '[style.--hero-rotation-ms]': 'rotationMs + "ms"',
    },
})
export class DashboardHeroComponent {
    readonly presenter = inject(DashboardHeroSlidesPresenter);
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly translate = inject(TranslateService);
    private readonly languageTick = injectTranslationTick();
    readonly slides = this.presenter.slides;
    readonly rotationMs = HERO_ROTATION_MS;
    readonly eyebrowKey = heroEyebrowKey;

    /**
     * The slide on screen, by id. Pinned to the first slide as soon as one
     * exists, so a late slide inserted ahead of it cannot take its place;
     * if the active slide itself disappears, the one now at its position
     * takes over.
     */
    private readonly activeId = linkedSignal<
        DashboardHeroSlide[],
        string | null
    >({
        source: this.slides,
        computation: (slides, previous) => {
            const currentId = previous?.value ?? null;
            if (currentId && slides.some((slide) => slide.id === currentId)) {
                return currentId;
            }
            const previousIndex =
                previous?.source.findIndex((slide) => slide.id === currentId) ??
                -1;
            const index = Math.min(
                Math.max(previousIndex, 0),
                slides.length - 1
            );
            return slides[index]?.id ?? null;
        },
    });
    private readonly hovered = signal(false);
    private readonly focusWithin = signal(false);
    private readonly documentHidden = signal(false);
    readonly reducedMotion = signal(false);

    readonly activeIndex = computed(() => {
        const index = this.slides().findIndex(
            (slide) => slide.id === this.activeId()
        );
        return index >= 0 ? index : 0;
    });

    readonly activeSlide = computed(
        () => this.slides()[this.activeIndex()] ?? null
    );

    readonly canRotate = computed(
        () => this.slides().length > 1 && !this.reducedMotion()
    );

    readonly paused = computed(
        () => this.hovered() || this.focusWithin() || this.documentHidden()
    );

    /** Each slide's platform, where its catalog category belongs to one. */
    readonly platformOf = computed(() => {
        const shelves = this.platforms.shelves() ?? [];
        const sourceId = this.platforms.source()?._id;
        const found = new Map<string, StreamingPlatform>();
        for (const slide of this.slides()) {
            const platform =
                slide.playlistId === sourceId
                    ? platformOfCategory(
                          shelves,
                          slide.contentType,
                          slide.categoryId
                      )
                    : null;
            if (platform) {
                found.set(slide.id, platform);
            }
        }
        return found;
    });

    /** "T2·E5 · Quedan 23 min", "Película · Quedan 38 min", per slide. */
    readonly metaOf = computed(() => {
        this.languageTick();
        const translate = (key: string, params?: Record<string, unknown>) =>
            this.translate.instant(key, params);
        return new Map(
            this.slides().map((slide) => [
                slide.id,
                heroMetaParts(slide, translate).join(' · '),
            ])
        );
    });

    constructor() {
        void this.platforms.loadShelves();
        if (typeof document !== 'undefined') {
            const onVisibility = () =>
                this.documentHidden.set(document.visibilityState === 'hidden');
            onVisibility();
            document.addEventListener('visibilitychange', onVisibility);
            inject(DestroyRef).onDestroy(() =>
                document.removeEventListener('visibilitychange', onVisibility)
            );
        }
        const media =
            typeof window !== 'undefined' && window.matchMedia
                ? window.matchMedia(REDUCED_MOTION_QUERY)
                : null;
        if (media) {
            this.reducedMotion.set(media.matches);
            const onChange = (event: MediaQueryListEvent) =>
                this.reducedMotion.set(event.matches);
            media.addEventListener('change', onChange);
            inject(DestroyRef).onDestroy(() =>
                media.removeEventListener('change', onChange)
            );
        }
    }

    show(index: number): void {
        const slide = this.slides()[index];
        if (slide) {
            this.activeId.set(slide.id);
        }
    }

    /** The active indicator's timer ran out: time for the next slide. */
    onRotationTick(): void {
        if (!this.canRotate() || this.paused()) {
            return;
        }
        this.show((this.activeIndex() + 1) % this.slides().length);
    }

    setHovered(hovered: boolean): void {
        this.hovered.set(hovered);
    }

    onFocusIn(): void {
        this.focusWithin.set(true);
    }

    onFocusOut(event: FocusEvent): void {
        const host = event.currentTarget as HTMLElement | null;
        const next = event.relatedTarget as Node | null;
        if (!host || !next || !host.contains(next)) {
            this.focusWithin.set(false);
        }
    }

    /**
     * On the hero region itself: ←/→ switch slides, Enter follows the
     * primary action. Buttons and indicators inside keep their own keys.
     */
    onHeroKeydown(event: KeyboardEvent): void {
        if (event.target !== event.currentTarget) {
            return;
        }
        const count = this.slides().length;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            if (count < 2) {
                return;
            }
            event.preventDefault();
            const step = event.key === 'ArrowRight' ? 1 : -1;
            this.show((this.activeIndex() + step + count) % count);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            // Every slide is in the DOM; the inactive ones are inert.
            (event.currentTarget as HTMLElement)
                .querySelector<HTMLElement>(
                    '.hero__content:not([inert]) .hero__button--primary'
                )
                ?.click();
        }
    }

    /** Roving arrows between the indicators, like a tab list. */
    onDotKeydown(event: KeyboardEvent, index: number): void {
        const count = this.slides().length;
        const step =
            event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (step === 0 || count < 2) {
            return;
        }
        event.preventDefault();
        const next = (index + step + count) % count;
        this.show(next);
        const group = (event.currentTarget as HTMLElement).parentElement;
        group?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
    }
}
