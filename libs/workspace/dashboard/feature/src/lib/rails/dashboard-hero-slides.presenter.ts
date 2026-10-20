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

    private readonly liveAnswerWaitOver = signal(false);
    /** Series / Películas' titles with a backdrop, for discovery slides. */
    private readonly discovery = injectDashboardHeroDiscovery();

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
     * Every slide but a resume or a live one stands on a real backdrop: a
     * discovery title's poster on the tinted stage looked broken. One whose
     * backdrop failed to load leaves the rotation.
     */
    readonly slides = computed<DashboardHeroSlide[]>(() => {
        this.languageTick();
        const liveDetails = this.liveSlide()?.details ?? null;
        return this.sources()
            .map((source) => this.toSlide(source, liveDetails))
            .filter(
                (slide) =>
                    slide.hasBackdrop ||
                    slide.kind === 'continue' ||
                    slide.contentType === 'live'
            );
    });

    constructor() {
        const liveAnswerWait = setTimeout(
            () => this.liveAnswerWaitOver.set(true),
            DASHBOARD_HERO_LIVE_ANSWER_WAIT_MS
        );
        inject(DestroyRef).onDestroy(() => clearTimeout(liveAnswerWait));

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

    private loadTmdbExtras(item: PortalActivityItem, key: string): void {
        if (this.requestedTmdbKeys.has(key)) {
            return;
        }
        this.requestedTmdbKeys.add(key);
        void this.heroTmdb.getExtras(item).then((extras) => {
            this.tmdbExtras.update((state) => new Map(state).set(key, extras));
        });
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
        const backdrop = item.backdrop_url || extras?.backdropUrl || null;
        const artwork = resolveDashboardHeroArtwork(
            {
                backdropUrl: backdrop ? heroBackdropUrl(backdrop) : null,
                posterUrl: item.poster_url
                    ? heroPosterUrl(item.poster_url)
                    : null,
            },
            this.failedImages()
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
