import { inject, Injectable, signal } from '@angular/core';
import { HomeTitlePagesService } from '../rails/home-title-pages.service';
import type { CatalogKind, CatalogTitle } from './catalog-titles';
import { CatalogService } from './catalog.service';

/** Title pages the hero asks for a backdrop, at most, per kind in a session. */
export const CATALOG_HERO_PROBES = 3;

/**
 * Series / Películas' hero features a title only over a real backdrop,
 * never its poster: the one its list names, or the one its page gave
 * (`CatalogService.extrasOf`). Where none of "Novedades" has one known
 * (a movie list names none), their pages are asked one at a time, behind
 * the Home's (`HomeTitlePagesService`), until one has a backdrop: at most
 * `CATALOG_HERO_PROBES` per kind a session, as the provider shuts out an
 * address that asks too much. A backdrop that fails to load, or loads as
 * a portrait, is no backdrop for the rest of the session.
 */
@Injectable({ providedIn: 'root' })
export class CatalogHeroBackdropsService {
    private readonly catalog = inject(CatalogService);
    private readonly pages = inject(HomeTitlePagesService);

    private readonly failed = signal<ReadonlySet<string>>(new Set());
    /** Pages asked, per source and kind. */
    private readonly probes = new Map<string, number>();
    private readonly running = new Set<string>();

    /** The title's backdrop, when one is known and it loads. */
    backdropOf(title: CatalogTitle): string | null {
        const url =
            title.backdrop ?? this.catalog.extrasOf(title)?.backdrop ?? null;
        return url && !this.failed().has(url) ? url : null;
    }

    /** The backdrop failed to load, or is a poster: the hero drops it. */
    fail(url: string): void {
        if (!this.failed().has(url)) {
            this.failed.update((failed) => new Set(failed).add(url));
        }
    }

    /**
     * Asks the candidates' pages in turn while none of them has a backdrop:
     * one at a time, once per title, within the kind's allowance.
     */
    find(kind: CatalogKind, candidates: readonly CatalogTitle[]): void {
        const sourceId = this.catalog.source()?._id;
        if (!sourceId) {
            return;
        }
        const key = `${sourceId}:${kind}`;
        if (this.running.has(key)) {
            return;
        }
        this.running.add(key);
        void this.run(key, sourceId, candidates).finally(() =>
            this.running.delete(key)
        );
    }

    private async run(
        key: string,
        sourceId: string,
        candidates: readonly CatalogTitle[]
    ): Promise<void> {
        for (const title of candidates) {
            if (
                this.catalog.source()?._id !== sourceId ||
                candidates.some((candidate) => this.backdropOf(candidate))
            ) {
                return;
            }
            // Its page is known already: it has no backdrop.
            if (this.catalog.extrasOf(title)) {
                continue;
            }
            const asked = this.probes.get(key) ?? 0;
            if (asked >= CATALOG_HERO_PROBES) {
                return;
            }
            this.probes.set(key, asked + 1);
            await this.pages.fetch(title);
        }
    }
}
