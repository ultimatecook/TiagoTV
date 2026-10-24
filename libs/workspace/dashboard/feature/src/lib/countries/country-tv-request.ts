import { inject, Injectable, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
    buildXtreamNavigationTarget,
    clearLiveChannelPlayRequest,
    readLiveChannelPlayRequest,
    type LiveChannelPlayRequest,
    type WorkspaceNavigationTarget,
} from '@iptvnator/portal/shared/util';
import type { TvCountry } from './countries-catalog';
import { CountriesCatalogService } from './countries-catalog.service';
import { CountryTvPlayback } from './country-tv-playback';
import { findSelection, type TvSelection } from './country-tv-start';

export type RequestedChannel =
    | { readonly selection: TvSelection }
    | { readonly elsewhere: WorkspaceNavigationTarget };

/**
 * Where the asked channel plays: on the stage, the channel of one of the
 * countries with that stream (that very copy), when it is the page's
 * source's; else in the Xtream live view, as "Open in Live TV" opens one
 * (a favourite of a channel no country lists, or of another source).
 */
export function requestedChannel(
    countries: readonly TvCountry[],
    request: LiveChannelPlayRequest,
    sourceId: string | null
): RequestedChannel {
    const selection =
        request.playlistId === sourceId
            ? findSelection(countries, request.streamId)
            : null;
    return selection
        ? { selection }
        : {
              elsewhere: buildXtreamNavigationTarget({
                  playlistId: request.playlistId,
                  type: 'live',
                  categoryId: request.categoryId,
                  itemId: request.streamId,
                  title: request.title,
                  imageUrl: request.icon,
              }),
          };
}

/**
 * The channel the way in asked "En vivo" to play (Mi lista's and Recently
 * viewed's "Canales", the Home's last channels and live hero, Buscar's
 * channels: `LIVE_CHANNEL_PLAY_STATE_KEY`): the navigation's state, or the
 * history entry's once it ended, read as the page is created and played
 * once the countries are in. Component-provided, with the page's player.
 */
@Injectable()
export class CountryTvRequest {
    private readonly router = inject(Router);
    private readonly catalog = inject(CountriesCatalogService);
    private readonly tv = inject(CountryTvPlayback);
    private request = readLiveChannelPlayRequest(
        untracked(() => this.router.currentNavigation())?.extras.state ??
            (typeof history === 'undefined' ? null : history.state)
    );

    /**
     * Plays the asked channel, once: on the stage (its country, for the
     * page to show), or in the live view, which then takes this history
     * entry (Back returns to the page the channel was picked on). Null
     * when nothing was asked.
     */
    play(countries: readonly TvCountry[]): TvCountry | 'elsewhere' | null {
        const request = this.request;
        if (!request) {
            return null;
        }
        this.request = null;
        clearLiveChannelPlayRequest();
        const source = this.catalog.source()?._id ?? null;
        const asked = requestedChannel(countries, request, source);
        if ('selection' in asked) {
            this.tv.play(asked.selection);
            return asked.selection.country;
        }
        const { link, state } = asked.elsewhere;
        void this.router.navigate(link, { state, replaceUrl: true });
        return 'elsewhere';
    }
}
