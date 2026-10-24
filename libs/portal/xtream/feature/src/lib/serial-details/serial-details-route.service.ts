import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { isProviderOnlyDetailState } from '@iptvnator/portal/shared/util';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { publishTitlePlatform } from '@iptvnator/services';
import type { XtreamSerieDetails } from '@iptvnator/shared/interfaces';
import { seriesLookupInfo } from '../title-lookup-info';
import { SerialDetailsPlaybackService } from './serial-details-playback.service';

/**
 * Route side of the series page: its params, the provider-only flag of the
 * navigation that opened it, and the (re)load of the series the route
 * addresses.
 */
@Injectable()
export class SerialDetailsRouteService {
    private readonly route = inject(ActivatedRoute);
    private readonly xtreamStore = inject(XtreamStore);
    private readonly playback = inject(SerialDetailsPlaybackService);
    /** `playlistId:categoryId:serialId` of the last initialized view */
    private readonly lastInitKey = signal<string | null>(null);

    /**
     * Reactive route params: the component is reused when navigating
     * between two series details (e.g. via the Similar rail).
     */
    readonly params = toSignal(this.route.params, {
        initialValue: this.route.snapshot.params,
    });
    /** The series' name, year and ids, for its episodes' subtitles. */
    private readonly lookupInfo = computed(() =>
        seriesLookupInfo(
            (this.xtreamStore.selectedItem() as XtreamSerieDetails | null)?.info
        )
    );
    readonly providerOnly = computed(() => {
        this.params();
        return isProviderOnlyDetailState(window.history.state);
    });

    constructor() {
        // The page wears the series' platform, wherever it was opened from.
        publishTitlePlatform(() => {
            const playlistId = this.xtreamStore.currentPlaylist()?.id;
            const { categoryId, serialId } = this.params();
            return playlistId && serialId
                ? {
                      playlistId,
                      kind: 'series',
                      itemId: serialId,
                      categoryId: categoryId ?? null,
                      lookup: this.lookupInfo(),
                  }
                : null;
        });
    }

    /**
     * Initializes on first render and RE-initializes when the route params
     * change while the component is reused (Similar rail). Reads signals, so
     * the owning component runs it from an effect.
     */
    loadAddressedSeries(): void {
        const playlistId = this.xtreamStore.currentPlaylist()?.id;
        const { categoryId, serialId } = this.params();
        if (!playlistId || !serialId) {
            return;
        }

        const initKey = `${playlistId}:${categoryId}:${serialId}`;
        if (this.lastInitKey() === initKey) {
            return;
        }
        this.lastInitKey.set(initKey);

        this.playback.resetForNewSeries();
        this.initializeSerialDetails(playlistId, categoryId, serialId);
    }

    private initializeSerialDetails(
        playlistId: string,
        categoryId: string | number,
        serialId: string
    ): void {
        this.xtreamStore.fetchSerialDetailsWithMetadata({
            serialId,
            categoryId: Number(categoryId),
        });
        const serialXtreamId = Number(serialId);
        this.xtreamStore.checkFavoriteStatus(
            serialXtreamId,
            playlistId,
            'series'
        );
        void this.playback.loadSeriesPlaybackPositions(
            playlistId,
            serialXtreamId
        );
    }
}
