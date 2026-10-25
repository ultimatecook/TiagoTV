import { computed, effect, inject, signal, untracked } from '@angular/core';
import { loadedLandscape } from '../../hero-backdrop';
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
    /** Its backdrop: a title without one is no slide. */
    readonly backdrop: string;
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
 * motion. A title shows only over its backdrop (its list's or its
 * page's), never its poster: one without, or whose backdrop fails to
 * load or is a portrait, is no slide; none, and the hero shows no art.
 * Create it in an injection context.
 */
export class PlatformHeroSlides {
    private readonly catalog = inject(PlatformsCatalogService);
    /** The slide showing, by key: it stays as slides arrive or leave. */
    private readonly activeKey = signal<string | null>(null);
    private readonly paused = signal(false);
    private readonly failed = signal<ReadonlySet<string>>(new Set());

    readonly slides = computed(() => {
        const failed = this.failed();
        const slides: PlatformHeroSlide[] = [];
        for (const title of this.titles()) {
            const extras = this.catalog.extrasOf(title);
            const backdrop = title.backdrop ?? extras?.backdrop ?? null;
            if (!backdrop || failed.has(backdrop)) {
                continue;
            }
            slides.push({
                title,
                key: `${title.kind}:${title.id}`,
                backdrop,
                plot: title.plot ?? extras?.plot ?? null,
                genres: extras?.genres ?? [],
                match:
                    title.rating !== null
                        ? Math.round(title.rating * 10)
                        : null,
                languages: languagesLabel(title),
                versions: languageVersions(title),
            });
        }
        return slides;
    });
    readonly activeIndex = computed(() =>
        Math.max(
            this.slides().findIndex((slide) => slide.key === this.activeKey()),
            0
        )
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
        // The first slide to show stays while the others' pages answer.
        effect(() => {
            const first = this.slides()[0];
            if (first && !untracked(this.activeKey)) {
                this.activeKey.set(first.key);
            }
        });
        effect(() => this.catalog.loadExtras(this.titles()));
    }

    show(index: number): void {
        const slide = this.slides()[index];
        if (slide) {
            this.activeKey.set(slide.key);
        }
    }

    /** The next (1) or previous (-1) slide, round the ends. */
    step(direction: 1 | -1): void {
        const count = this.slides().length;
        if (count > 0) {
            this.show((this.activeIndex() + direction + count) % count);
        }
    }

    /** A backdrop that fails to load: its slide leaves, the next shows. */
    artFailed(url: string): void {
        const slides = this.slides();
        const at = slides.findIndex((slide) => slide.backdrop === url);
        if (at < 0) {
            return;
        }
        if (at === this.activeIndex() && slides.length > 1) {
            this.activeKey.set(slides[(at + 1) % slides.length].key);
        }
        this.failed.update((failed) => new Set(failed).add(url));
    }

    /** A portrait "backdrop" is a poster: its slide leaves too. */
    artLoaded(url: string, event: Event): void {
        if (!loadedLandscape(event)) {
            this.artFailed(url);
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
