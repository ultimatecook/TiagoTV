import {
    displayTitle,
    isCatalogUnavailable,
} from '@iptvnator/shared/interfaces';
import {
    computed,
    DestroyRef,
    effect,
    inject,
    Injectable,
    linkedSignal,
    signal,
    untracked,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import { splitSeasonSuffix } from '@iptvnator/portal/shared/util';
import {
    playlistDisplayLabel,
    resolvePortalActivityWatchKind,
    type PlaybackPositionData,
    type PortalActivityItem,
} from '@iptvnator/shared/interfaces';
import { DashboardDataService } from '@iptvnator/workspace/dashboard/data-access';
import {
    DashboardHeroTmdbService,
    type DashboardHeroTmdbExtras,
} from './dashboard-hero-tmdb.service';
import {
    dashboardHeroHue,
    resolveDashboardHeroArtwork,
    type DashboardHeroSlide,
} from './dashboard-hero.utils';
import {
    dashboardHeroItemKey,
    pickDashboardHeroSources,
    type DashboardHeroSource,
} from './dashboard-hero-slides.utils';
import { dashboardHeroActions } from './dashboard-hero-actions';
import { DashboardLiveEpgPresenter } from './dashboard-live-epg.presenter';
import { injectDashboardHeroDiscovery } from './dashboard-hero-discovery';
import { injectHeroPageBackdrops } from './dashboard-hero-page-backdrops';
import { heroBackdropUrl, heroPosterUrl } from './home-hero-images';
import { splitCatalogGenres } from './dashboard-match.utils';
import type { DashboardLiveEpgDetails } from './dashboard-live-epg.utils';
import {
    buildDashboardEpisodeBadge,
    playbackProgressPercent,
} from './dashboard-playback.utils';

const TYPE_LABEL_KEYS = {
    live: 'WORKSPACE.DASHBOARD.TYPE_LIVE',
    movie: 'WORKSPACE.DASHBOARD.TYPE_MOVIE',
    series: 'WORKSPACE.DASHBOARD.TYPE_SERIES',
} as const;

/**
 * How long, from the hero's creation, its skeleton may wait for the first
 * programme of a live candidate. Portal answers usually take a few hundred
 * milliseconds; an unreachable portal must not hold the skeleton forever.
 */
export const DASHBOARD_HERO_LIVE_ANSWER_WAIT_MS = 2000;

/** Favourites without a backdrop of their own looked up on TMDB, at most. */
const HERO_FAVORITE_LOOKUPS = 4;

/**
 * A TMDB lookup that found nothing is asked again after these waits: it
 * may have failed for a moment (offline after a sleep, a rate limit), and
 * the resume slide then stood on its small poster for the whole visit.
 */
export const HERO_TMDB_RETRY_MS: readonly number[] = [5_000, 20_000];
/** A backdrop that failed to load is tried once more after this wait. */
export const HERO_IMAGE_RETRY_MS = 15_000;

const PROVIDER_LABEL_KEYS = {
    xtream: 'WORKSPACE.DASHBOARD.XTREAM',
    stalker: 'WORKSPACE.DASHBOARD.STALKER',
    m3u: 'WORKSPACE.DASHBOARD.M3U',
} as const;

/**
 * Builds the cinematic hero's rotation slides from the dashboard data:
 * which titles are featured (`pickDashboardHeroSources`), their artwork,
 * TMDB extras, playback progress, live programme and actions.
 *
 * Component-provided next to the hero; the live programme answers come from
 * the page's `DashboardLiveEpgPresenter`, which already pins the hero's live
 * candidates. TMDB extras are fetched per featured title after first paint,
 * memoized by `DashboardHeroTmdbService`, and vanish immediately when the
 * user opts out of TMDB mid-session.
 */
@Injectable()
export class DashboardHeroSlidesPresenter {
    private readonly data = inject(DashboardDataService);
    private readonly liveEpg = inject(DashboardLiveEpgPresenter);
    private readonly heroTmdb = inject(DashboardHeroTmdbService);
    private readonly translate = inject(TranslateService);
    private readonly languageTick = injectTranslationTick();

    private readonly failedImages = signal<Record<string, true>>({});
    private readonly tmdbExtras = signal<
        ReadonlyMap<string, DashboardHeroTmdbExtras | null>
    >(new Map());
    private readonly requestedTmdbKeys = new Set<string>();
    private readonly retriedImages = new Set<string>();
    private readonly timers = new Set<ReturnType<typeof setTimeout>>();

    private readonly liveAnswerWaitOver = signal(false);
    /** Series / Películas' titles with a backdrop, for discovery slides. */
    private readonly discovery = injectDashboardHeroDiscovery();
    /** The provider's backdrop for titles without one (TMDB off or silent). */
    private readonly pageBackdrops = injectHeroPageBackdrops();

    /**
     * Nothing to feature yet and a source that can feature a title is still
     * on its first load. Every such source counts, not only the history:
     * the Xtream recently-added query waits for the favorites, and a live
     * slide waits for its programme, so dropping the skeleton when the
     * history resolved empty removed the hero and inserted it again moments
     * later, moving every rail below twice. Once the skeleton has gone it
     * does not come back: a later reload must not shift the page either.
     */
    readonly loading = linkedSignal<boolean, boolean>({
        source: () =>
            this.slides().length === 0 &&
            (this.data.globalRecentLoading() ||
                !this.data.continueWatchingSettled() ||
                this.data.globalFavoritesLoading() ||
                this.data.xtreamRecentlyAddedLoading() ||
                this.discovery.reading() ||
                this.discovery.waiting() ||
                (!this.liveAnswerWaitOver() &&
                    this.liveEpg.heroLiveAwaitingFirstAnswer())),
        computation: (loading, previous) =>
            previous?.value === false ? false : loading,
    }).asReadonly();

    /** The first candidate channel with a programme on air right now. */
    private readonly liveSlide = computed(() => {
        for (const candidate of this.liveEpg.heroLiveCandidates()) {
            if (isCatalogUnavailable(candidate.item)) continue;
            const details = this.liveEpg.heroDetailsFor(candidate.item);
            if (details?.nowPlayingTitle) {
                return { candidate, details };
            }
        }
        return null;
    });

    private readonly favoriteCandidates = computed(() =>
        this.data
            .globalFavoriteItems()
            .filter(
                (item) =>
                    !isCatalogUnavailable(item) &&
                    (item.type === 'movie' || item.type === 'series')
            )
    );

    private readonly sources = computed(() =>
        pickDashboardHeroSources({
            continueItems: this.data
                .continueWatchingItems()
                .filter((item) => !isCatalogUnavailable(item)),
            live: this.liveSlide()?.candidate ?? null,
            reserveLive: this.liveEpg
                .heroLiveCandidates()
                .some(({ item }) => !isCatalogUnavailable(item)),
            // A favourite is featured over its backdrop only.
            favorites: this.favoriteCandidates().filter((item) =>
                this.backdropOf(item)
            ),
            // The catalog's titles (ES/EN merged, the platforms taking
            // turns) once their backdrops are known; the provider's raw
            // newest rows only without a catalog. None while it is read:
            // they would be swapped a moment later.
            recentlyAdded: this.discovery.reading()
                ? []
                : this.discovery.hasCatalog()
                  ? this.discovery.added()
                  : this.data.xtreamRecentlyAddedItems(),
            // Until the resume candidates are known the newest row may be one
            // of them; featuring it as the fallback would swap the slide.
            mostRecent: this.data.continueWatchingSettled()
                ? (this.data
                      .globalRecentItems()
                      .find((item) => !isCatalogUnavailable(item)) ?? null)
                : null,
        })
    );

    /**
     * Every slide stands on a real backdrop, resume and live ones too: a
     * poster or a channel logo on the tinted stage looked broken, so a
     * title without a banner is not featured at all (the owner's rule). One
     * whose backdrop failed to load leaves the rotation; a resume title
     * joins it once its page's backdrop arrives.
     */
    readonly slides = computed<DashboardHeroSlide[]>(() => {
        this.languageTick();
        const liveDetails = this.liveSlide()?.details ?? null;
        return this.sources()
            .map((source) => this.toSlide(source, liveDetails))
            .filter((slide) => slide.hasBackdrop);
    });

    constructor() {
        const liveAnswerWait = setTimeout(
            () => this.liveAnswerWaitOver.set(true),
            DASHBOARD_HERO_LIVE_ANSWER_WAIT_MS
        );
        // The featured titles without a backdrop of their own ask for
        // their page: the provider's backdrop when TMDB has none.
        effect(() => {
            const bare = this.sources()
                .map((source) => source.item)
                .filter((item) => !item.backdrop_url);
            untracked(() => this.pageBackdrops.request(bare));
        });

        inject(DestroyRef).onDestroy(() => {
            clearTimeout(liveAnswerWait);
            this.timers.forEach((timer) => clearTimeout(timer));
            this.timers.clear();
        });

        effect(() => {
            if (!this.heroTmdb.isEnabled()) {
                return;
            }
            // Keys read here, tracked: they carry the TMDB language, so a
            // language change loads the localized overview and genres. The
            // first favourites without a backdrop of their own are looked
            // up too: TMDB's may let them feature.
            const requests = [
                ...this.sources().map((source) => source.item),
                ...this.favoriteCandidates()
                    .filter((item) => !item.backdrop_url)
                    .slice(0, HERO_FAVORITE_LOOKUPS),
            ]
                .filter((item) => item.type !== 'live')
                .map((item) => ({ item, key: this.heroTmdb.keyFor(item) }));
            untracked(() =>
                requests.forEach(({ item, key }) =>
                    this.loadTmdbExtras(item, key)
                )
            );
        });
    }

    markImageFailed(url: string): void {
        this.failedImages.update((state) =>
            state[url] ? state : { ...state, [url]: true }
        );
        // Once more a moment later: a failure may be the network waking.
        if (!this.retriedImages.has(url)) {
            this.retriedImages.add(url);
            this.later(HERO_IMAGE_RETRY_MS, () =>
                this.failedImages.update((state) => {
                    const next = { ...state };
                    delete next[url];
                    return next;
                })
            );
        }
    }

    /** The item's own backdrop, else TMDB's (with the opt-in). */
    private backdropOf(item: PortalActivityItem): string | null {
        if (item.backdrop_url) {
            return item.backdrop_url;
        }
        return this.heroTmdb.isEnabled()
            ? (this.tmdbExtras().get(this.heroTmdb.keyFor(item))?.backdropUrl ??
                  null)
            : null;
    }

    private loadTmdbExtras(
        item: PortalActivityItem,
        key: string,
        attempt = 0
    ): void {
        if (attempt === 0 && this.requestedTmdbKeys.has(key)) {
            return;
        }
        this.requestedTmdbKeys.add(key);
        void this.heroTmdb.getExtras(item).then((extras) => {
            if (extras || !this.tmdbExtras().get(key)) {
                this.tmdbExtras.update((state) =>
                    new Map(state).set(key, extras)
                );
            }
            const wait = HERO_TMDB_RETRY_MS[attempt];
            if (!extras && wait !== undefined) {
                this.later(wait, () =>
                    this.loadTmdbExtras(item, key, attempt + 1)
                );
            }
        });
    }

    private later(wait: number, run: () => void): void {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            run();
        }, wait);
        this.timers.add(timer);
    }

    private toSlide(
        source: DashboardHeroSource,
        liveDetails: DashboardLiveEpgDetails | null
    ): DashboardHeroSlide {
        const item = source.item;
        const isLive = item.type === 'live';
        // Single reactive read, gated on the TMDB opt-in
        const extras =
            !isLive && this.heroTmdb.isEnabled()
                ? (this.tmdbExtras().get(this.heroTmdb.keyFor(item)) ?? null)
                : null;
        const details =
            source.kind === 'live'
                ? liveDetails
                : isLive
                  ? this.liveEpg.heroDetailsFor(item)
                  : null;
        const position = isLive
            ? null
            : this.data.getPlaybackPositionForItem(item);
        // Without TMDB a catalog import still lists a rating, genres and a
        // synopsis for many titles; the slide falls back to those.
        const catalog = source.kind === 'added' ? source.item : null;
        // At the hero's size: a provider's small TMDB copy looked blurry.
        // The provider's recorded backdrop first, then TMDB's, then the
        // title page's: one that failed to load gives way to the next
        // before the slide falls to a poster.
        const failed = this.failedImages();
        const backdrop =
            [
                item.backdrop_url,
                extras?.backdropUrl,
                this.pageBackdrops.backdropOf(item),
            ]
                .filter((url): url is string => !!url)
                .map((url) => heroBackdropUrl(url))
                .find((url) => !failed[url]) ?? null;
        const artwork = resolveDashboardHeroArtwork(
            {
                backdropUrl: backdrop,
                posterUrl: item.poster_url
                    ? heroPosterUrl(item.poster_url)
                    : null,
            },
            failed
        );

        // Watch kind: a Stalker embedded-VOD show routes as a movie
        const watchKind = isLive
            ? 'live'
            : (resolvePortalActivityWatchKind(item) ?? item.type);
        const episodeBadge = buildDashboardEpisodeBadge(
            item,
            position,
            (key, params) => this.translate.instant(key, params)
        );
        return {
            ...artwork,
            id: `${source.kind}:${dashboardHeroItemKey(item)}`,
            kind: source.kind,
            contentType: item.type,
            playlistId: item.playlist_id,
            categoryId: String(item.category_id ?? ''),
            // "Большая фарма (1 сезон)" → "Большая фарма" only while the
            // episode badge names the season; without a badge the marker is
            // the sole season identity of a per-season catalog entry. A movie
            // keeps its name as is.
            // TiagoTV: films and shows go by their name alone, without the
            // catalog's year and language tags.
            title: isLive
                ? item.title
                : displayTitle(
                      watchKind === 'series' && episodeBadge
                          ? splitSeasonSuffix(item.title).title
                          : item.title
                  ),
            typeLabelKey: TYPE_LABEL_KEYS[watchKind],
            reasonLabelKey: this.reasonLabelKey(source),
            episodeBadge,
            rating: extras?.rating ?? catalog?.rating ?? null,
            genres: extras?.genres ?? splitCatalogGenres(catalog?.genre),
            year: extras?.year ?? item.release_year ?? null,
            source: playlistDisplayLabel(
                item.playlist_name,
                this.translate.instant(
                    item.source
                        ? PROVIDER_LABEL_KEYS[item.source]
                        : 'WORKSPACE.DASHBOARD.PROVIDER'
                )
            ),
            programmeTitle: details?.nowPlayingTitle ?? null,
            category: details?.nowPlayingCategory ?? null,
            timeRange: details?.nowPlayingTimeRange ?? null,
            description: isLive
                ? (details?.nowPlayingDescription ?? null)
                : (extras?.overview ?? catalog?.plot ?? null),
            progress: isLive
                ? (details?.nowPlayingProgress ?? null)
                : playbackProgressPercent(position),
            accentHue: dashboardHeroHue(item.title),
            ...dashboardHeroActions(this.data, source, position),
        };
    }

    private reasonLabelKey(source: DashboardHeroSource): string {
        switch (source.kind) {
            case 'continue':
                return 'WORKSPACE.DASHBOARD.CONTINUE_WATCHING';
            case 'live':
                return source.origin === 'favorite'
                    ? 'WORKSPACE.DASHBOARD.HERO_FAVORITE_CHANNEL'
                    : 'WORKSPACE.DASHBOARD.RECENTLY_WATCHED';
            case 'favorite':
                return 'WORKSPACE.DASHBOARD.HERO_FAVORITE';
            case 'added':
                return 'WORKSPACE.DASHBOARD.HERO_RECENTLY_ADDED';
            case 'recent':
                return 'WORKSPACE.DASHBOARD.RECENTLY_WATCHED';
        }
    }
}
