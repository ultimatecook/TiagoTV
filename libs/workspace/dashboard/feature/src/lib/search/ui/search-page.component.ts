import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import {
    buildLiveChannelPlayTargetFor,
    buildXtreamNavigationTarget,
} from '@iptvnator/portal/shared/util';
import { CountriesCatalogService } from '../../countries/countries-catalog.service';
import { SPORT_SECTIONS } from '../../sports/sport-sections';
import type { SportMatch } from '../../sports/sports-catalog';
import { SportsBoardService } from '../../sports/sports-board.service';
import { SportsCatalogService } from '../../sports/sports-catalog.service';
import { TeamCrestComponent } from '../../sports/ui/team-crest.component';
import {
    browserStorage,
    readRecentSearches,
    withRecentSearch,
    writeRecentSearches,
} from '../search-recents';
import {
    findChannels,
    findTeams,
    foldTerm,
    SEARCH_MIN_LENGTH,
    SEARCH_SCOPES,
    teamMatchToday,
    type ChannelHit,
    type SearchScope,
    type TeamHit,
    type TitleHit,
} from '../search-results';
import {
    SearchTitlesService,
    type TitleSearch,
} from '../search-titles.service';
import {
    pageMemoryState,
    recallPageChoice,
    rememberPageChoice,
} from '../../ui-state/page-memory';
import { PageStateComponent } from '../../ui-state/page-state.component';

/** A typed term is searched (and written to `q`) this long after typing. */
export const SEARCH_INPUT_DEBOUNCE_MS = 250;
const TITLES_SHOWN = { all: 12, kind: 40 };
/** The history entry's memory of the scope picked (`rememberPageChoice`). */
export const SEARCH_SCOPE_MEMORY = 'search-scope';

/**
 * The global search (`/workspace/search`, handoff 05 · Buscador): a large
 * field, the scope chips (Todo · Fútbol · Canales · Series · Películas)
 * and, without a term, the recent searches; with one, the teams, channels
 * and titles that match, grouped in cards. Teams come from the sports
 * catalog, channels from "En vivo"'s countries (the kept languages), series
 * and movies from the Xtream catalog search. The term lives in `q`, so
 * links (`/workspace/search?q=…`) open on their results.
 */
@Component({
    selector: 'lib-search-page',
    imports: [MatIcon, PageStateComponent, TeamCrestComponent, TranslatePipe],
    providers: [SearchTitlesService],
    templateUrl: './search-page.component.html',
    styleUrl: './search-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly translate = inject(TranslateService);
    readonly sports = inject(SportsCatalogService);
    private readonly board = inject(SportsBoardService);
    private readonly countries = inject(CountriesCatalogService);
    private readonly titlesService = inject(SearchTitlesService);
    private readonly field =
        viewChild<ElementRef<HTMLInputElement>>('searchField');
    private debounce: ReturnType<typeof setTimeout> | null = null;
    private titlesRequest = 0;

    readonly scopes = SEARCH_SCOPES;
    /** The scope picked; Back to the entry brings it again (the term is `q`). */
    readonly scope = signal<SearchScope>(
        recallPageChoice(SEARCH_SCOPE_MEMORY, isSearchScope) ?? 'all'
    );
    private readonly routeQuery = toSignal(
        this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
        { initialValue: this.route.snapshot.queryParamMap.get('q') ?? '' }
    );
    /** What the field shows; the applied term follows it after a pause. */
    readonly draft = signal(this.routeQuery());
    readonly applied = signal(this.routeQuery().trim());
    readonly term = computed(() => {
        const term = foldTerm(this.applied());
        return term.length >= SEARCH_MIN_LENGTH ? term : '';
    });
    readonly recent = signal(readRecentSearches(browserStorage()));
    /** Logos and posters that did not load: their row shows a stand-in. */
    readonly brokenImages = signal<ReadonlySet<string>>(new Set());

    readonly teams = computed(() => {
        const catalog = this.sports.catalog();
        const term = this.term();
        if (!catalog || !term) {
            return [];
        }
        const matches = SPORT_SECTIONS.reduce<SportMatch[]>(
            (all, section) =>
                all.concat(
                    this.sports.upcoming(catalog[section.id]?.matches ?? [])
                ),
            []
        );
        return findTeams(matches, term, (match) => this.sports.isLive(match));
    });
    readonly channels = computed(() =>
        findChannels(this.countries.countries() ?? [], this.term())
    );
    private readonly titleSearch = signal<{
        readonly term: string;
        readonly result: TitleSearch;
    } | null>(null);
    readonly titlesLoading = computed(
        () => !!this.term() && this.titleSearch()?.term !== this.term()
    );
    /** The titles the scope shows, best first, and how many matched. */
    readonly titles = computed(() => {
        const search = this.titleSearch();
        const scope = this.scope();
        if (!search || search.term !== this.term()) {
            return { hits: [] as TitleHit[], total: 0, searchable: true };
        }
        const { series, movies } = search.result;
        const lists =
            scope === 'series'
                ? [series]
                : scope === 'movies'
                  ? [movies]
                  : [series, movies];
        const hits = lists
            .reduce<TitleHit[]>((all, list) => all.concat(list ?? []), [])
            .sort((a, b) => a.rank - b.rank);
        return {
            hits: hits.slice(
                0,
                scope === 'all' ? TITLES_SHOWN.all : TITLES_SHOWN.kind
            ),
            total: hits.length,
            searchable: lists.some((list) => list !== null),
        };
    });
    readonly showTeams = computed(() =>
        ['all', 'football'].includes(this.scope())
    );
    readonly showChannels = computed(() =>
        ['all', 'channels'].includes(this.scope())
    );
    readonly showTitles = computed(() =>
        ['all', 'series', 'movies'].includes(this.scope())
    );
    readonly titlesHeadingKey = computed(() =>
        this.scope() === 'series'
            ? 'WORKSPACE.SEARCH.GROUP_SERIES'
            : this.scope() === 'movies'
              ? 'WORKSPACE.SEARCH.GROUP_MOVIES'
              : 'WORKSPACE.SEARCH.GROUP_TITLES'
    );
    readonly nothingFound = computed(
        () =>
            !!this.term() &&
            !this.titlesLoading() &&
            (!this.showTeams() || this.teams().length === 0) &&
            (!this.showChannels() || this.channels().total === 0) &&
            (!this.showTitles() || this.titles().total === 0)
    );

    constructor() {
        this.sports.keepFresh(inject(DestroyRef));
        inject(DestroyRef).onDestroy(() => this.cancelDebounce());
        // A term from outside (a link, the command palette) replaces the
        // field's; the page's own writes come back equal and change nothing.
        effect(() => {
            const query = this.routeQuery().trim();
            untracked(() => {
                if (query !== this.applied()) {
                    this.cancelDebounce();
                    this.draft.set(query);
                    this.applied.set(query);
                }
            });
        });
        effect(() => {
            const term = this.term();
            untracked(() => void this.searchTitles(term));
        });
        afterNextRender(() => this.field()?.nativeElement.focus());
    }

    onInput(value: string): void {
        this.draft.set(value);
        this.cancelDebounce();
        this.debounce = setTimeout(
            () => this.apply(value),
            SEARCH_INPUT_DEBOUNCE_MS
        );
    }

    /** Enter searches at once and keeps the term among the recent ones. */
    onEnter(value: string): void {
        this.cancelDebounce();
        this.apply(value);
        this.remember(value);
    }

    clear(): void {
        this.cancelDebounce();
        this.apply('');
        this.field()?.nativeElement.focus();
    }

    pickRecent(term: string): void {
        this.cancelDebounce();
        this.apply(term);
        this.remember(term);
    }

    pickScope(scope: SearchScope): void {
        this.scope.set(scope);
        rememberPageChoice(SEARCH_SCOPE_MEMORY, scope);
    }

    clearRecent(): void {
        this.recent.set([]);
        writeRecentSearches(browserStorage(), []);
    }

    /** Opening a result keeps the term that found it. */
    remember(term = this.applied()): void {
        if (foldTerm(term).length < SEARCH_MIN_LENGTH) {
            return;
        }
        const recent = withRecentSearch(this.recent(), term);
        this.recent.set(recent);
        writeRecentSearches(browserStorage(), recent);
    }

    sectionTitle(sectionId: string): string {
        return (
            SPORT_SECTIONS.find((section) => section.id === sectionId)?.title ??
            ''
        );
    }

    /** "21:00" today, "mié 21:00" another day. */
    kickOffLabel(match: SportMatch | null): string {
        const start = match?.event.start;
        if (!start) {
            return '';
        }
        const locale = this.translate.currentLang || undefined;
        const time = start.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
        });
        const now = this.sports.now();
        return start.toDateString() === now.toDateString()
            ? time
            : `${new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(start)} ${time}`;
    }

    /**
     * A team on its competition's page: playing its match when it is on
     * today (as the sports hub's team pills do), else the page as it opens.
     */
    openTeam(team: TeamHit): void {
        this.remember();
        const match = teamMatchToday(
            team,
            this.sports.now(),
            team.match ? this.sports.kickOff(team.match) : null
        );
        if (match) {
            this.board.openMatch(match);
        } else {
            this.board.open(team.sectionId);
        }
    }

    /**
     * A channel plays on "En vivo" (its stage, that stream), where the
     * search found it, rather than in the framed Xtream live view.
     */
    playChannel(channel: ChannelHit): void {
        this.remember();
        const target = buildLiveChannelPlayTargetFor({
            sourceType: 'xtream',
            playlistId: this.countries.source()?._id ?? '',
            streamId: channel.streamId,
            categoryId: channel.categoryId,
            title: channel.title,
            icon: channel.icon,
        });
        if (target) {
            void this.router.navigate(target.link, { state: target.state });
        }
    }

    openTitle(title: TitleHit): void {
        const source = this.titlesService.source();
        if (!source) {
            return;
        }
        this.remember();
        const target = buildXtreamNavigationTarget({
            playlistId: source._id,
            type: title.kind,
            categoryId: title.categoryId,
            itemId: title.xtreamId,
            title: title.title,
            imageUrl: title.poster,
        });
        void this.router.navigate(target.link, { state: target.state });
    }

    imageFailed(url: string): void {
        this.brokenImages.update((broken) => new Set(broken).add(url));
    }

    initials(text: string): string {
        return text
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase() ?? '')
            .join('');
    }

    /**
     * Arrow keys walk the field and the result rows, in page order (a TV
     * remote or a keyboard needs no Tab through every group).
     */
    moveFocus(event: Event, step: 1 | -1): void {
        const field = this.field()?.nativeElement;
        const host = field?.closest('.search-page');
        if (!field || !host) {
            return;
        }
        const stops = [
            field,
            ...Array.from(host.querySelectorAll<HTMLElement>('.search-row')),
        ];
        const index = stops.indexOf(event.target as HTMLElement);
        const next = stops[index + step];
        if (index >= 0 && next) {
            event.preventDefault();
            next.focus();
        }
    }

    private apply(value: string): void {
        const term = value.trim();
        this.draft.set(value);
        if (term === this.applied()) {
            return;
        }
        this.applied.set(term);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { q: term || null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
            // The entry is replaced: the scope picked stays on it.
            state: pageMemoryState(),
        });
    }

    private async searchTitles(term: string): Promise<void> {
        const request = ++this.titlesRequest;
        if (!term) {
            this.titleSearch.set(null);
            return;
        }
        const result = await this.titlesService
            .search(untracked(this.applied), term)
            .catch((): TitleSearch => ({ series: null, movies: null }));
        if (request === this.titlesRequest) {
            this.titleSearch.set({ term, result });
        }
    }

    private cancelDebounce(): void {
        if (this.debounce !== null) {
            clearTimeout(this.debounce);
            this.debounce = null;
        }
    }
}

function isSearchScope(value: unknown): value is SearchScope {
    return SEARCH_SCOPES.some((scope) => scope.id === value);
}
