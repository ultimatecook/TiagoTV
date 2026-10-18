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
import {
    eventCategoryIds,
    reloadEventCategories,
    streamsByCategory,
    withFreshEvents,
    type CategoryStreams,
    type LiveCatalog,
} from './live-catalog';
import { buildLiveChannels, type LiveChannelTile } from './live-channels';
import { isMatchOver, KickoffMemory } from './match-clock';
import { StoredLiveCatalog } from './stored-live-catalog';
import { TeamCrestResolver } from './team-crests';
import {
    buildSportsCatalog,
    todaysMatches,
    type SportChannel,
    type SportMatch,
    type SportsCatalog,
} from './sports-catalog';

export type { LiveCatalog } from './live-catalog';

/**
 * Event channels rename themselves through the day; their categories are
 * reloaded at most this often (finished matches leave "today" by the
 * clock, see match-clock, not by a reload).
 */
const FRESH_MS = 10 * 60 * 1000;
/** How often an open sports view checks the clock (and the cache's age). */
const TICK_MS = 60 * 1000;
/** The pause between two category requests: the provider is load-sensitive. */
const GAP_MS = 500;

interface LoadedCatalog {
    readonly playlistId: string;
    readonly catalog: SportsCatalog;
    readonly liveChannels: readonly LiveChannelTile[];
    readonly live: LiveCatalog;
    /** When the event categories were last reloaded. */
    readonly at: number;
    /** The stored copy's read version (parental lock), see StoredLiveCatalog. */
    readonly version: number;
}

/** A playlist's event categories as last reloaded from the panel. */
interface FreshEvents {
    readonly playlistId: string;
    readonly streams: CategoryStreams;
    readonly at: number;
}

/**
 * The sports view of the Xtream source. The live catalog comes from the
 * copy the app already stores (see StoredLiveCatalog); only the categories
 * that hold event channels — whose names change through the day — are
 * reloaded from the panel, one at a time. A channel opens in the live
 * player.
 */
@Injectable({ providedIn: 'root' })
export class SportsCatalogService {
    private readonly api = inject(XtreamApiService);
    private readonly stored = inject(StoredLiveCatalog);
    private readonly router = inject(Router);
    private readonly playlists = inject(Store).selectSignal(
        selectAllPlaylistsMeta
    );
    private readonly loaded = signal<LoadedCatalog | null>(null);
    private readonly kickOffs = new KickoffMemory(browserStorage());
    private inFlight: Promise<void> | null = null;
    /** The first-run download, kept while nothing is stored yet. */
    private downloaded: { playlistId: string; live: LiveCatalog } | null = null;
    private freshEvents: FreshEvents | null = null;
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
    /** The live catalog itself, events fresh, for the views built on it. */
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
                Date.now() - loaded.at < FRESH_MS &&
                loaded.version === this.stored.version())
        ) {
            return Promise.resolve();
        }
        this.inFlight ??= this.refresh(
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

    private async refresh(
        playlistId: string,
        credentials: XtreamSourceCredentials
    ): Promise<void> {
        this.loading.set(true);
        this.failed.set(false);
        try {
            const version = this.stored.version();
            const stored = await this.storedCopy(playlistId, credentials);
            if (stored) {
                await this.refreshEvents(
                    playlistId,
                    credentials,
                    stored,
                    version
                );
            } else {
                await this.download(playlistId, credentials, version);
            }
        } catch {
            this.failed.set(true);
        } finally {
            this.loading.set(false);
        }
    }

    /** The stored copy, else the first-run download of an earlier load. */
    private async storedCopy(
        playlistId: string,
        credentials: XtreamSourceCredentials
    ): Promise<LiveCatalog | null> {
        const stored = await this.stored
            .read(playlistId, credentials)
            .catch(() => null);
        if (stored) {
            this.downloaded = null;
            return stored;
        }
        return this.downloaded?.playlistId === playlistId
            ? this.downloaded.live
            : null;
    }

    /** First run: the whole line-up, once; its event channels are today's. */
    private async download(
        playlistId: string,
        credentials: XtreamSourceCredentials,
        version: number
    ): Promise<void> {
        const live = await this.stored.download(playlistId, credentials);
        const at = Date.now();
        this.downloaded = { playlistId, live };
        this.freshEvents = {
            playlistId,
            streams: streamsByCategory(live.streams, eventCategoryIds(live)),
            at,
        };
        this.publish(playlistId, live, version, at);
    }

    /**
     * The stored copy with its event categories reloaded from the panel,
     * unless they were within FRESH_MS (then only the stored copy, e.g. a
     * parental-lock change, is read again).
     */
    private async refreshEvents(
        playlistId: string,
        credentials: XtreamSourceCredentials,
        stored: LiveCatalog,
        version: number
    ): Promise<void> {
        const ids = eventCategoryIds(stored);
        const held =
            this.freshEvents?.playlistId === playlistId
                ? this.freshEvents
                : null;
        if (held && Date.now() - held.at < FRESH_MS) {
            const live = withFreshEvents(stored, ids, held.streams);
            this.publish(playlistId, live, version, held.at);
            return;
        }
        const previous = held?.streams ?? new Map();
        if (ids.length > 0 && this.loaded()?.playlistId !== playlistId) {
            // Everything else shows at once; today's events follow.
            const live = withFreshEvents(stored, ids, previous);
            this.publish(playlistId, live, version, 0);
        }
        const streams = await reloadEventCategories(
            ids,
            (categoryId) =>
                this.api.getLiveStreams(credentials, {
                    categoryId,
                    suppressErrorLog: true,
                }),
            previous,
            GAP_MS
        );
        const at = Date.now();
        this.freshEvents = { playlistId, streams, at };
        this.publish(
            playlistId,
            withFreshEvents(stored, ids, streams),
            version,
            at
        );
    }

    private publish(
        playlistId: string,
        live: LiveCatalog,
        version: number,
        at: number
    ): void {
        const catalog = buildSportsCatalog(live.categories, live.streams);
        this.kickOffs.remember(
            Object.values(catalog).reduce<SportMatch[]>(
                (all, content) => all.concat(content.matches),
                []
            )
        );
        this.loaded.set({
            playlistId,
            catalog,
            liveChannels: buildLiveChannels(live.categories, live.streams),
            live,
            at,
            version,
        });
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
