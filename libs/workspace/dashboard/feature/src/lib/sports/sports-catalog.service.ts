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
import { EventRefresh, FRESH_MS } from './event-refresh';
import { LeagueTableResolver } from './league-tables';
import { eventCategoryIds, type LiveCatalog } from './live-catalog';
import { buildLiveChannels, type LiveChannelTile } from './live-channels';
import { sectionsWithChannels } from './match-channels';
import { isMatchOn, isMatchOver, KickoffMemory, startOf } from './match-clock';
import { announcedKickOffs } from './match-fixtures';
import { isFollowedTeam } from './my-teams';
import {
    ESPN_API,
    fetchJsonOrNull,
    SportsApiClient,
} from './sports-api-client';
import { StoredLiveCatalog } from './stored-live-catalog';
import { TeamCrestResolver } from './team-crests';
import {
    buildSportsCatalog,
    orderMatches,
    todaysMatches,
    type SportChannel,
    type SportMatch,
    type SportsCatalog,
} from './sports-catalog';

export type { LiveCatalog } from './live-catalog';

/** How often an open sports view checks the clock (and the cache's age). */
const TICK_MS = 60 * 1000;

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
    private readonly events = new EventRefresh();
    /** The open sports views; the catalog is kept fresh while any is. */
    private holders = 0;
    private ticker: ReturnType<typeof setInterval> | null = null;

    /** TheSportsDB, one request at a time for the crests and the tables. */
    private readonly sportsDb = new SportsApiClient({
        fetchJson: fetchJsonOrNull,
    });
    readonly crests = new TeamCrestResolver({
        fetchJson: fetchJsonOrNull,
        storage: browserStorage(),
        client: this.sportsDb,
    });
    readonly tables = new LeagueTableResolver({
        espn: new SportsApiClient(
            { fetchJson: fetchJsonOrNull },
            { base: ESPN_API, gapMs: 1000, retryMs: 5000 }
        ),
        sportsDb: this.sportsDb,
        storage: browserStorage(),
        preferred: isFollowedTeam,
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
                  this.kickOffOf(match)
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
        return isMatchOver(match, this.kickOffOf(match), this.now());
    }

    /** Whether a match is on now (by its feeds' names or by the clock). */
    isLive(match: SportMatch): boolean {
        return isMatchOn(match, this.kickOffOf(match), this.now());
    }

    /** A section's matches not over yet, the ones on now first. */
    upcoming(matches: readonly SportMatch[]): SportMatch[] {
        const kickOffOf = (match: SportMatch) => this.kickOffOf(match);
        return orderMatches(
            matches.filter((match) => !this.isOver(match)),
            this.now(),
            kickOffOf
        );
    }

    /** A match's kick-off: announced, remembered, or when it went live. */
    kickOff(match: SportMatch): Date | null {
        return startOf(match, this.kickOffOf(match));
    }

    private kickOffOf(match: SportMatch): Date | null {
        return match.event.start ?? this.kickOffs.kickOffOf(match);
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
        this.publish(playlistId, live, version, at);
        const catalog = this.loaded()?.catalog;
        this.events.keepDownload(
            playlistId,
            live,
            catalog ? sectionsWithChannels(catalog) : new Set(),
            at
        );
    }

    /**
     * The stored copy with its event categories reloaded from the panel
     * (see EventRefresh), unless they were within FRESH_MS: then only the
     * stored copy (e.g. after a parental-lock change) is read again.
     */
    private async refreshEvents(
        playlistId: string,
        credentials: XtreamSourceCredentials,
        stored: LiveCatalog,
        version: number
    ): Promise<void> {
        // The stored names are a day old or more, but a kick-off they
        // announce is one, for a match first seen once it is on.
        this.kickOffs.fill(announcedKickOffs(stored.streams));
        const fresh = this.events.fresh(playlistId, stored);
        if (fresh) {
            this.publish(playlistId, fresh.live, version, fresh.at);
            return;
        }
        if (
            eventCategoryIds(stored).length > 0 &&
            this.loaded()?.playlistId !== playlistId
        ) {
            // Everything else shows at once; today's events follow.
            const { live } = this.events.current(playlistId, stored);
            this.publish(playlistId, live, version, 0);
        }
        const round = await this.events.reload(playlistId, stored, {
            sections: () => {
                const loaded = this.loaded();
                return sectionsWithChannels(
                    loaded?.playlistId === playlistId
                        ? loaded.catalog
                        : buildSportsCatalog(stored.categories, stored.streams)
                );
            },
            foreignMatchOn: this.today().some(
                (match) => match.via.length > 0 && this.isLive(match)
            ),
            liveSections: new Set(
                this.today()
                    .filter((match) => this.isLive(match))
                    .map((match) => match.sectionId)
            ),
            fetchCategory: (categoryId) =>
                this.api.getLiveStreams(credentials, {
                    categoryId,
                    suppressErrorLog: true,
                }),
        });
        this.publish(playlistId, round.live, version, round.at);
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
