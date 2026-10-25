import { inject } from '@angular/core';
import {
    resolvePortalActivityWatchKind,
    type PortalActivityItem,
} from '@iptvnator/shared/interfaces';
import type { CatalogTitleRef } from '../catalog/catalog-titles';
import { CatalogService } from '../catalog/catalog.service';
import { HomeTitlePagesService } from './home-title-pages.service';

/** Title pages the hero asks for its own titles' backdrops, at most, per visit. */
export const HERO_PAGE_LOOKUPS = 6;

/**
 * The provider's own backdrop (the title's page: get_series_info or
 * get_vod_info) for the hero's resume, recent and favourite titles. With
 * TMDB off, or no TMDB answer, the resume slide stood on its small poster
 * however often the Home opened. Pages are asked one at a time behind the
 * Home's others (`HomeTitlePagesService`) and kept app-wide by the
 * catalog, whose `extrasOf` is read reactively: a page that arrives
 * repaints the slide.
 */
export interface HeroPageBackdrops {
    backdropOf(item: PortalActivityItem): string | null;
    request(items: readonly PortalActivityItem[]): void;
}

/** Must run in an injection context (the hero presenter's). */
export function injectHeroPageBackdrops(): HeroPageBackdrops {
    const catalog = inject(CatalogService);
    const pages = inject(HomeTitlePagesService);
    const asked = new Set<string>();

    /** The title's page in the catalog's source; null for anything else. */
    const refOf = (item: PortalActivityItem): CatalogTitleRef | null => {
        if (
            item.type === 'live' ||
            (item.source && item.source !== 'xtream') ||
            item.playlist_id !== catalog.source()?._id
        ) {
            return null;
        }
        const id = Number(item.xtream_id);
        if (!Number.isInteger(id) || id <= 0) {
            return null;
        }
        const kind =
            (resolvePortalActivityWatchKind(item) ?? item.type) === 'series'
                ? 'series'
                : 'movie';
        return { kind, id };
    };

    return {
        backdropOf: (item) => {
            const ref = refOf(item);
            return ref ? (catalog.extrasOf(ref)?.backdrop ?? null) : null;
        },
        request: (items) => {
            for (const item of items) {
                const ref = refOf(item);
                const key = ref ? `${ref.kind}:${ref.id}` : '';
                if (!ref || asked.has(key) || asked.size >= HERO_PAGE_LOOKUPS) {
                    continue;
                }
                asked.add(key);
                void pages.fetch(ref);
            }
        },
    };
}
