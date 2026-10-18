import {
    computed,
    inject,
    Injectable,
    signal,
    type DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { buildXtreamNavigationTarget } from '@iptvnator/portal/shared/util';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import {
    primaryXtreamSource,
    xtreamSourceCredentials,
    type XtreamSourceCredentials,
} from '../xtream-source';
import { buildLiveChannels, type LiveChannelTile } from './live-channels';
import { isMatchOver, KickoffMemory } from './match-clock';
import { TeamCrestResolver } from './team-crests';
import {
    buildSportsCatalog,
    todaysMatches,
    type SportChannel,
    type SportMatch,
    type SportsCatalog,
    type SportsCatalogCategory,
    type SportsCatalogStream,
} from './sports-catalog';

/**
 * Event channels rename themselves through the day, but the list is the
 * provider's whole line-up (tens of thousands of channels): fetching it
 * often can get the account throttled. Finished matches leave "today" by
 * the clock (match-clock), not by a refetch.
 */
const FRESH_MS = 10 * 60 * 1000;
/** How often an open sports view checks the clock (and the cache's age). */
const TICK_MS = 60 * 1000;

/** The source's live categories and channels, as the panel lists them. */
export interface LiveCatalog {
    readonly categories: readonly SportsCatalogCategory[];
    readonly streams: readonly SportsCatalogStream[];
}

interface LoadedCatalog {
    readonly playlistId: string;
    readonly catalog: SportsCatalog;
    readonly liveChannels: readonly LiveChannelTile[];
    readonly live: LiveCatalog;
    readonly at: number;
}

/**
 * The sports view of the Xtream source: loads its live catalog fresh from
 * the panel (the local copy holds the event names of import time) and
 * opens a channel in the live player.
 */
@Injectable({ providedIn: 'root' })
export class SportsCatalogService {
    private readonly api = inject(XtreamApiService);
    private readonly router = inject(Router);
    private readonly playlists = inject(Store).selectSignal(
        selectAllPlaylistsMeta
    );
    private readonly loaded = signal<LoadedCatalog | null>(null);
    private readonly kickOffs = new KickoffMemory(browserStorage());
    private inFlight: Promise<void> | null = null;
    /** The open sports views; the catalog is kept fresh while any is. */
    private holders = 0;
    private ticker: ReturnType<typeof setInterval> | null = null;

    readonly crests = new TeamCrestResolver({
        fetchJson: async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Crest lookup answered ${response.status}`);
            }
            return response.json();
        },
        storage: browserStorage(),
    });
    readonly loading = signal(false);
    readonly failed = signal(false);
    readonly source = computed(() => primaryXtreamSource(this.playlists()));
    readonly catalog = computed(() => {
        const loaded = this.loaded();
        return loaded && loaded.playlistId === this.source()?._id
            ? loaded.catalog
            : null;
    });
    private readonly clock = signal(new Date());
    /** The wall clock, a minute at a time while a sports view is open. */
    readonly now = this.clock.asReadonly();
    readonly today = computed(() => {
        const catalog = this.catalog();
        return catalog
            ? todaysMatches(catalog, this.now(), (match) =>
                  this.kickOffs.kickOffOf(match)
              )
            : [];
    });
    readonly liveChannels = computed(() => {
        const loaded = this.loaded();
        return loaded && loaded.playlistId === this.source()?._id
            ? loaded.liveChannels
            : [];
    });
    /** The fresh live catalog itself, for the other views built on it. */
    readonly liveCatalog = computed(() => {
        const loaded = this.loaded();
        return loaded && loaded.playlistId === this.source()?._id
            ? loaded.live
            : null;
    });

    /** Whether a match listed as live or upcoming is in fact over. */
    isOver(match: SportMatch): boolean {
        return isMatchOver(match, this.kickOffs.kickOffOf(match), this.now());
    }

    /**
     * Loads the catalog and keeps it fresh (and the clock running) until
     * `destroyRef` is destroyed: event channels rename themselves through
     * the day, and a match's "Live" outlasts its final whistle.
     */
    keepFresh(destroyRef: DestroyRef): void {
        void this.load();
        if (this.holders++ === 0) {
            this.clock.set(new Date());
            this.ticker = setInterval(() => this.tick(), TICK_MS);
        }
        destroyRef.onDestroy(() => {
            if (--this.holders === 0 && this.ticker !== null) {
                clearInterval(this.ticker);
                this.ticker = null;
            }
        });
    }

    /** Loads the catalog unless a fresh one is held. */
    load(): Promise<void> {
        const source = this.source();
        const loaded = this.loaded();
        if (
            !source ||
            (loaded?.playlistId === source._id &&
                Date.now() - loaded.at < FRESH_MS)
        ) {
            return Promise.resolve();
        }
        this.inFlight ??= this.fetch(
            source._id,
            xtreamSourceCredentials(source)
        ).finally(() => (this.inFlight = null));
        return this.inFlight;
    }

    play(channel: SportChannel): void {
        const source = this.source();
        if (!source) {
            return;
        }
        const target = buildXtreamNavigationTarget({
            playlistId: source._id,
            type: 'live',
            categoryId: channel.categoryId,
            itemId: channel.streamId,
            title: channel.title,
            imageUrl: channel.icon,
        });
        void this.router.navigate(target.link, { state: target.state });
    }

    private async fetch(
        playlistId: string,
        credentials: XtreamSourceCredentials
    ): Promise<void> {
        this.loading.set(true);
        this.failed.set(false);
        try {
            const options = { suppressErrorLog: true };
            const [categories, streams] = await Promise.all([
                this.api.getCategories(credentials, 'live', options),
                this.api.getLiveStreams(credentials, options),
            ]);
            const catalog = buildSportsCatalog(categories, streams);
            this.kickOffs.remember(
                Object.values(catalog).reduce<SportMatch[]>(
                    (all, content) => all.concat(content.matches),
                    []
                )
            );
            this.loaded.set({
                playlistId,
                catalog,
                liveChannels: buildLiveChannels(categories, streams),
                live: { categories, streams },
                at: Date.now(),
            });
        } catch {
            this.failed.set(true);
        } finally {
            this.loading.set(false);
        }
    }

    private tick(): void {
        this.clock.set(new Date());
        // A hidden window reloads once it is looked at again.
        if (typeof document === 'undefined' || !document.hidden) {
            void this.load();
        }
    }
}

function browserStorage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}
