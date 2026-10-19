import { computed, effect, inject, signal } from '@angular/core';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import {
    languagesLabel,
    languageVersions,
    type PlatformTitle,
    type PlatformTitleVersion,
} from '../platform-titles';

const ROTATE_MS = 8000;

export interface PlatformHeroSlide {
    readonly title: PlatformTitle;
    readonly key: string;
    readonly backdrop: string | null;
    readonly plot: string | null;
    readonly genres: readonly string[];
    /** The rating as a "% Match", Netflix's way. */
    readonly match: number | null;
    /** "ES · EN", the languages it comes in. */
    readonly languages: string;
    /** One version per language, each one's own button when it has two. */
    readonly versions: readonly PlatformTitleVersion[];
}

/**
 * The recommended titles a platform page's hero shows in turn, every
 * look's (card, billboard, carousel), as the page picks them
 * (`pickRecommendations`): their artwork and synopsis (fetched
 * from each title's page), which one is showing, and the turning, paused
 * while the pointer or the keyboard is on the hero and under reduced
 * motion. Create it in an injection context.
 */
export class PlatformHeroSlides {
    private readonly catalog = inject(PlatformsCatalogService);
    private readonly active = signal(0);
    private readonly paused = signal(false);

    readonly slides = computed(() =>
        this.titles().map((title): PlatformHeroSlide => {
            const extras = this.catalog.extrasOf(title);
            return {
                title,
                key: `${title.kind}:${title.id}`,
                backdrop: title.backdrop ?? extras?.backdrop ?? null,
                plot: title.plot ?? extras?.plot ?? null,
                genres: extras?.genres ?? [],
                match:
                    title.rating !== null
                        ? Math.round(title.rating * 10)
                        : null,
                languages: languagesLabel(title),
                versions: languageVersions(title),
            };
        })
    );
    readonly activeIndex = computed(
        () => this.active() % Math.max(this.slides().length, 1)
    );
    /** The current slide alone, so its text animates in on each turn. */
    readonly current = computed(() => {
        const slide = this.slides()[this.activeIndex()];
        return slide ? [slide] : [];
    });

    constructor(private readonly titles: () => readonly PlatformTitle[]) {
        const reduceMotion =
            typeof matchMedia === 'function' &&
            matchMedia('(prefers-reduced-motion: reduce)').matches;
        effect((onCleanup) => {
            const count = this.slides().length;
            if (count < 2 || this.paused() || reduceMotion) {
                return;
            }
            const timer = setInterval(() => this.step(1), ROTATE_MS);
            onCleanup(() => clearInterval(timer));
        });
        effect(() =>
            this.catalog.loadExtras(this.slides().map((slide) => slide.title))
        );
    }

    show(index: number): void {
        this.active.set(index);
    }

    /** The next (1) or previous (-1) slide, round the ends. */
    step(direction: 1 | -1): void {
        const count = this.slides().length;
        if (count > 0) {
            this.active.set((this.activeIndex() + direction + count) % count);
        }
    }

    setPaused(paused: boolean): void {
        this.paused.set(paused);
    }

    /** The title's page: its first version's, or the one picked. */
    open(title: PlatformTitle, version?: PlatformTitleVersion): void {
        this.catalog.open(title, version);
    }
}

/** "Ver en inglés": the key of a version button's language. */
export function languageNameKey(version: PlatformTitleVersion): string {
    return `WORKSPACE.PLATFORMS.LANGUAGE.${version.language}`;
}

/** The "Movie" / "Series" label of a title. */
export function titleTypeKey(title: PlatformTitle): string {
    return title.kind === 'movie'
        ? 'WORKSPACE.DASHBOARD.TYPE_MOVIE'
        : 'WORKSPACE.DASHBOARD.TYPE_SERIES';
}
