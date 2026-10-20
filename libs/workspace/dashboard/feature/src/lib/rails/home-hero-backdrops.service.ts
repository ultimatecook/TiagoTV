import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { CatalogTitle } from '../catalog/catalog-titles';
import { CatalogService } from '../catalog/catalog.service';
import { titleKey } from '../platforms/platform-titles';
import { heroBackdropUrl } from './home-hero-images';
import { HomeTitlePagesService } from './home-title-pages.service';

/** Discovery slides the hero features, at most. */
export const HERO_DISCOVERY_SLIDES = 4;
/** Title pages asked for a backdrop, at most, in a session. */
export const HERO_BACKDROP_PROBES = 8;
/** How long a backdrop image may take to load before it is skipped. */
export const HERO_BACKDROP_WAIT_MS = 8000;

/** Whether an image loads and is landscape: a real backdrop, not a poster. */
export type HeroImageCheck = (url: string) => Promise<boolean>;

export const HERO_IMAGE_CHECK = new InjectionToken<HeroImageCheck>(
    'HERO_IMAGE_CHECK',
    { providedIn: 'root', factory: () => loadsLandscape }
);

export interface HeroBackdropTitle {
    readonly title: CatalogTitle;
    /** The backdrop at the hero's size, already loaded once. */
    readonly backdrop: string;
}

interface ProbeState {
    readonly sourceId: string;
    readonly found: readonly HeroBackdropTitle[];
    readonly done: boolean;
}

/**
 * The Home hero's discovery titles that have a real backdrop. The stored
 * catalog's rows carry posters only (series lists sometimes a backdrop),
 * and a poster on the tinted stage looked broken, so a title is featured
 * only once its 16:9 backdrop is known and loads.
 *
 * Titles whose row already names a backdrop come first and ask the
 * provider nothing. The others' pages are asked one at a time, behind any
 * other title page the Home asks (`HomeTitlePagesService`), at most
 * `HERO_BACKDROP_PROBES` a session; a title without a backdrop is skipped.
 * Root-provided: a later visit to the Home asks nothing again.
 */
@Injectable({ providedIn: 'root' })
export class HomeHeroBackdropsService {
    private readonly catalog = inject(CatalogService);
    private readonly pages = inject(HomeTitlePagesService);
    private readonly check = inject(HERO_IMAGE_CHECK);

    private readonly state = signal<ProbeState | null>(null);
    private probes = 0;

    /** The titles to feature for the source, in the order found. */
    found(sourceId: string): readonly HeroBackdropTitle[] {
        const state = this.state();
        return state?.sourceId === sourceId ? state.found : [];
    }

    /** Still looking, and nothing found yet: the hero may wait a moment. */
    pending(sourceId: string): boolean {
        const state = this.state();
        return state?.sourceId === sourceId
            ? !state.done && state.found.length === 0
            : false;
    }

    /** Looks once per source and session through these candidates. */
    probe(sourceId: string, candidates: readonly CatalogTitle[]): void {
        if (this.state()?.sourceId === sourceId) {
            return;
        }
        this.state.set({ sourceId, found: [], done: false });
        void this.run(sourceId, candidates).finally(() =>
            this.update(sourceId, (state) => ({ ...state, done: true }))
        );
    }

    private async run(
        sourceId: string,
        candidates: readonly CatalogTitle[]
    ): Promise<void> {
        const seen = new Set<string>();
        const unique = candidates.filter((title) => {
            const key = titleKey(title);
            return !seen.has(key) && !!seen.add(key);
        });
        // Known backdrops first: they cost the provider nothing.
        const known = unique.filter((title) => this.knownBackdrop(title));
        const unknown = unique.filter((title) => !known.includes(title));
        for (const title of [...known, ...unknown]) {
            if (!this.isCurrent(sourceId) || this.full(sourceId)) {
                return;
            }
            const backdrop = await this.backdropOf(title);
            if (!backdrop || !this.isCurrent(sourceId)) {
                continue;
            }
            const url = heroBackdropUrl(backdrop);
            if (await this.check(url)) {
                this.update(sourceId, (state) => ({
                    ...state,
                    found: [...state.found, { title, backdrop: url }].slice(
                        0,
                        HERO_DISCOVERY_SLIDES
                    ),
                }));
            }
        }
    }

    private knownBackdrop(title: CatalogTitle): string | null {
        return title.backdrop ?? this.catalog.extrasOf(title)?.backdrop ?? null;
    }

    private async backdropOf(title: CatalogTitle): Promise<string | null> {
        const known = this.knownBackdrop(title);
        if (known || this.catalog.extrasOf(title)) {
            return known;
        }
        if (this.probes >= HERO_BACKDROP_PROBES) {
            return null;
        }
        this.probes++;
        return (await this.pages.fetch(title))?.backdrop ?? null;
    }

    private isCurrent(sourceId: string): boolean {
        return (
            this.state()?.sourceId === sourceId &&
            this.catalog.source()?._id === sourceId
        );
    }

    private full(sourceId: string): boolean {
        return this.found(sourceId).length >= HERO_DISCOVERY_SLIDES;
    }

    private update(
        sourceId: string,
        change: (state: ProbeState) => ProbeState
    ): void {
        this.state.update((state) =>
            state?.sourceId === sourceId ? change(state) : state
        );
    }
}

/** Loads the image like the hero will; a portrait one is a poster. */
function loadsLandscape(url: string): Promise<boolean> {
    if (typeof Image === 'undefined') {
        return Promise.resolve(true);
    }
    return new Promise((resolve) => {
        const image = new Image();
        const done = (ok: boolean) => {
            clearTimeout(timer);
            image.onload = image.onerror = null;
            resolve(ok);
        };
        const timer = setTimeout(() => done(false), HERO_BACKDROP_WAIT_MS);
        image.onload = () =>
            done(image.naturalWidth >= image.naturalHeight * 1.2);
        image.onerror = () => done(false);
        image.decoding = 'async';
        image.src = url;
    });
}
