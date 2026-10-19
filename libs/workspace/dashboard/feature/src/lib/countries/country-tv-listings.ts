import { computed, inject, Injectable } from '@angular/core';
import { SportsCatalogService } from '../sports/sports-catalog.service';
import type { CountryChannelGroup } from './country-channels';
import { isFootballProgramme, liveFootball } from './country-tv-football';
import { CountryTvGuide } from './country-tv-guide';

/** What a channel shows now, as far as the page knows. */
export interface TvNow {
    readonly title: string;
    /** 0–100 through the programme; null when only its name is known. */
    readonly progress: number | null;
    readonly football: boolean;
}

/**
 * What "En vivo"'s channels show now, from what the page already has: the
 * guide of a channel played here (`CountryTvGuide`, asked for once a
 * channel plays), else the match the sports catalog says it carries. It
 * asks the provider for nothing more; a channel neither knows has no
 * programme.
 *
 * Component-provided, beside `CountryTvGuide`.
 */
@Injectable()
export class CountryTvListings {
    private readonly sports = inject(SportsCatalogService);
    private readonly guide = inject(CountryTvGuide);

    /** The live football matches by the streams that show them. */
    readonly football = computed(() =>
        liveFootball(this.sports.today(), (match) => this.sports.isLive(match))
    );

    nowOn(channel: CountryChannelGroup): TvNow | null {
        const streamIds = channel.copies.map((copy) => copy.streamId);
        const match = this.matchOn(streamIds);
        const programme = this.guide.nowOn(streamIds);
        if (programme) {
            return {
                title: programme.title,
                progress: programme.progress,
                football: !!match || isFootballProgramme(programme.title),
            };
        }
        return match ? { title: match, progress: null, football: true } : null;
    }

    private matchOn(streamIds: readonly number[]): string | null {
        const football = this.football();
        for (const streamId of streamIds) {
            const match = football.get(streamId);
            if (match) {
                return match;
            }
        }
        return null;
    }
}
