import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { teamFixtures } from './my-teams';
import { SPORT_SECTIONS, type SportSectionId } from './sport-sections';
import type { SportChannel, SportMatch } from './sports-catalog';
import { SportsCatalogService } from './sports-catalog.service';

/**
 * What the sports views show of the catalog beyond one section: the live
 * matches per competition (the league cards' pills), the followed teams'
 * next matches, and the way into a competition's page playing a channel.
 */
@Injectable({ providedIn: 'root' })
export class SportsBoardService {
    private readonly sports = inject(SportsCatalogService);
    private readonly router = inject(Router);

    /** The matches on now, by section. */
    readonly liveCounts = computed(() => {
        const catalog = this.sports.catalog();
        this.sports.now();
        const counts = new Map<SportSectionId, number>();
        if (catalog) {
            for (const section of SPORT_SECTIONS) {
                const live = (catalog[section.id]?.matches ?? []).filter(
                    (match) => this.sports.isLive(match)
                ).length;
                if (live > 0) {
                    counts.set(section.id, live);
                }
            }
        }
        return counts;
    });

    /** Every section's matches not over yet (the ones on now first). */
    readonly upcoming = computed(() => {
        const catalog = this.sports.catalog();
        this.sports.now();
        const all = SPORT_SECTIONS.filter(
            (section) => !section.catchAll
        ).reduce<SportMatch[]>(
            (matches, section) =>
                matches.concat(catalog?.[section.id]?.matches ?? []),
            []
        );
        return this.sports.upcoming(all);
    });

    /** The followed teams, each with its match on now or next. */
    readonly teams = computed(() => teamFixtures(this.upcoming()));

    /**
     * A competition's page, playing `channel` once it opens (the league
     * page reads it from the navigation's state, see playRequest).
     */
    open(sectionId: SportSectionId, channel?: SportChannel): void {
        const play: SportChannel | null = channel
            ? {
                  streamId: channel.streamId,
                  categoryId: channel.categoryId,
                  title: channel.title,
                  icon: channel.icon,
              }
            : null;
        void this.router.navigate(['/workspace', 'sports', sectionId], {
            state: play ? { [PLAY_STATE_KEY]: play } : undefined,
        });
    }

    /** A match on its competition's page, playing its feed. */
    openMatch(match: SportMatch, channel?: SportChannel): void {
        this.open(match.sectionId, channel ?? match.via[0]?.channel ?? match);
    }
}

const PLAY_STATE_KEY = 'tiagotvSportsPlay';

/** The channel a navigation into a competition's page asked to play. */
export function playRequest(state: unknown): SportChannel | null {
    const channel = (state as Record<string, unknown> | null)?.[
        PLAY_STATE_KEY
    ] as Partial<SportChannel> | undefined;
    return channel &&
        typeof channel.streamId === 'number' &&
        typeof channel.categoryId === 'string' &&
        typeof channel.title === 'string'
        ? {
              streamId: channel.streamId,
              categoryId: channel.categoryId,
              title: channel.title,
              icon: typeof channel.icon === 'string' ? channel.icon : null,
          }
        : null;
}
