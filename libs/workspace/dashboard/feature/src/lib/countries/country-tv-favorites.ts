import { inject, Injectable } from '@angular/core';
import { SettingsStore } from '@iptvnator/services';
import { prefersHdCopies } from '@iptvnator/shared/interfaces';
import { ChannelFavoritesService } from '../my-list/channel-favorites.service';
import {
    startingCopy,
    type CountryChannel,
    type CountryChannelGroup,
} from './country-channels';

/**
 * "En vivo"'s hearts (Mi lista): a channel tile is on the list when any of
 * its copies is. The heart beside the controls saves the copy playing; a
 * card's saves the copy the card starts on ("Fluidez", `startingCopy`), the
 * one Mi lista then plays. Taking a channel off takes off every copy.
 */
@Injectable({ providedIn: 'root' })
export class CountryTvFavorites {
    private readonly favorites = inject(ChannelFavoritesService);
    private readonly settings = inject(SettingsStore);

    isSaved(channel: CountryChannelGroup): boolean {
        return this.favorites.has(streamsOf(channel));
    }

    toggle(channel: CountryChannelGroup, copy?: CountryChannel): void {
        const saved =
            copy ??
            startingCopy(
                channel.copies,
                prefersHdCopies(this.settings.playbackSmoothness?.())
            );
        void this.favorites.toggle(saved.streamId, streamsOf(channel));
    }

    /** The list as stored now: the page opens. */
    refresh(): void {
        void this.favorites.refresh();
    }
}

function streamsOf(channel: CountryChannelGroup): number[] {
    return channel.copies.map((copy) => copy.streamId);
}
