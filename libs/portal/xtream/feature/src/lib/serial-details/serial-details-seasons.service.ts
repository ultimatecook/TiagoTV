import {
    computed,
    effect,
    inject,
    Injectable,
    Signal,
    signal,
    untracked,
} from '@angular/core';
import type { SeriesQuickStartAction } from '@iptvnator/portal/shared/util';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { buildSeasonDescriptions } from './season-descriptions.util';
import { buildSeasonPosters } from './season-posters.util';
import type { XtreamSerieDetailsView } from './serial-details-playback.service';
import {
    recallSeriesSeason,
    rememberSeriesSeason,
} from './serial-details-season-memory';

interface SerialDetailsSeasonsBindings {
    readonly selectedItem: Signal<XtreamSerieDetailsView | null>;
    /**
     * The season the detail container shows. `select()` is also called for
     * the fullscreen episode picker, whose choice enriches another season
     * without changing the detail list; the container's metadata flag must
     * follow the container's own selection.
     */
    readonly detailSeasonKey?: Signal<string | null | undefined>;
    /** The page's play button: its episode's season is the one to open on. */
    readonly quickStart?: Signal<SeriesQuickStartAction | null>;
}

/**
 * Season presentation of the series page: the descriptions and posters the
 * season container and the inline player show, and the TMDB enrichment of
 * the season the viewer selected.
 */
@Injectable()
export class SerialDetailsSeasonsService {
    private readonly xtreamStore = inject(XtreamStore);
    private readonly bindings = signal<SerialDetailsSeasonsBindings | null>(
        null
    );
    private readonly selectedItem = computed(
        () => this.bindings()?.selectedItem() ?? null
    );

    /** Season selected last, in the season container or the fullscreen picker. */
    private readonly selectedSeasonKey = signal<string | null>(null);

    /** `playlist:series` of the page, null until the series is in. */
    private readonly identity = computed(
        () => {
            const seriesId = Number(this.selectedItem()?.series_id ?? 0);
            const playlistId = this.xtreamStore.currentPlaylist()?.id ?? '';
            return seriesId > 0 && playlistId ? { playlistId, seriesId } : null;
        },
        // A details refresh of the same series is no new visit.
        { equal: (a, b) => (a && identityKey(a)) === (b && identityKey(b)) }
    );
    /** The season the history entry remembers, read as the series comes in. */
    private readonly recalled = signal<{
        readonly key: string;
        readonly seasonKey: string | null;
    } | null>(null);

    /**
     * The season the detail container opens on (see
     * `SeasonContainerComponent.preferredSeasonKey`): the one shown when
     * this history entry was left (Back, Forward, a reload), else the season
     * of the episode the play button names, so the list and "Play S03E02"
     * agree even before that episode counts as in progress.
     */
    readonly preferredSeason = computed(() => {
        const identity = this.identity();
        const recalled = this.recalled();
        if (identity && recalled?.key === identityKey(identity)) {
            if (recalled.seasonKey) return recalled.seasonKey;
        }
        const episodeId = Number(this.bindings()?.quickStart?.()?.episode.id);
        const seasons = this.selectedItem()?.episodes ?? {};
        return (
            Object.keys(seasons).find((key) =>
                seasons[key]?.some((episode) => Number(episode.id) === episodeId)
            ) ?? null
        );
    });

    /** Season descriptions (provider text, TMDB fallback, URL junk dropped). */
    readonly descriptions = computed<Record<string, string>>(() =>
        buildSeasonDescriptions(this.selectedItem())
    );

    /** Season posters (TMDB season poster first, provider season cover next). */
    readonly posters = computed<Record<string, string>>(() =>
        buildSeasonPosters(this.selectedItem())
    );

    /**
     * True while TMDB may still fill the detail container's season (show
     * match or season enrichment outstanding); the container then keeps
     * rows it would otherwise render bare as skeletons. Before the
     * container reports its selection, the lowest season stands in.
     */
    readonly metadataLoading = computed(() => {
        const seasonKey =
            this.bindings()?.detailSeasonKey?.() ??
            Object.keys(this.selectedItem()?.episodes ?? {}).sort(
                (a, b) => Number(a) - Number(b)
            )[0];
        return (
            !!seasonKey &&
            this.xtreamStore.isTmdbEpisodeMetadataPending(seasonKey)
        );
    });

    constructor() {
        // TMDB season enrichment, keyed on (tmdb_id, selected season). With
        // season tabs the first seasonSelected fires as soon as seasons load —
        // usually BEFORE the async show-level TMDB match has written
        // info.tmdb_id, and enrichSelectedSerialSeason no-ops without it. So
        // the call must re-run when the match arrives, not only on selection.
        // The store-side enrichment is idempotent per (serial, season).
        effect(() => {
            const tmdbId = this.selectedItem()?.info?.tmdb_id;
            const seasonKey = this.selectedSeasonKey();
            if (tmdbId && seasonKey) {
                untracked(() =>
                    this.xtreamStore.enrichSelectedSerialSeason(seasonKey)
                );
            }
        });

        // Read before the first write below for the same series.
        effect(() => {
            const identity = this.identity();
            this.recalled.set(
                identity
                    ? {
                          key: identityKey(identity),
                          seasonKey: recallSeriesSeason(
                              window.history.state,
                              identity
                          ),
                      }
                    : null
            );
        });
        // The season on screen goes on the history entry (adding none).
        effect(() => {
            const identity = this.identity();
            const seasonKey = this.bindings()?.detailSeasonKey?.();
            const recalled = this.recalled();
            if (
                identity &&
                seasonKey &&
                recalled?.key === identityKey(identity) &&
                seasonKey in (this.selectedItem()?.episodes ?? {})
            ) {
                untracked(() => rememberSeriesSeason(identity, seasonKey));
            }
        });
    }

    /** Connects the service to the owning component's reactive state. */
    bind(bindings: SerialDetailsSeasonsBindings): void {
        this.bindings.set(bindings);
    }

    select(seasonKey: string): void {
        // The enrichment call itself runs from the constructor effect keyed
        // on (tmdb_id, selectedSeasonKey) — see the race note there.
        this.selectedSeasonKey.set(seasonKey);
    }
}

function identityKey(identity: {
    readonly playlistId: string;
    readonly seriesId: number;
}): string {
    return `${identity.playlistId}:${identity.seriesId}`;
}
