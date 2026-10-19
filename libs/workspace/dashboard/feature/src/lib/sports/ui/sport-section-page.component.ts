import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    signal,
    untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { groupChannelFamilies } from '../channel-families';
import { hasLeagueTable, type LeagueTable } from '../league-tables';
import { signalCards } from '../signal-cards';
import { playRequest } from '../sports-board.service';
import { SportsCatalogService } from '../sports-catalog.service';
import { findSportSection, type SportSectionId } from '../sport-sections';
import type { SportChannel } from '../sports-catalog';
import { SportTvGuide } from '../sport-tv-guide';
import { SportTvPlayback } from '../sport-tv-playback';
import { FeaturedMatchComponent } from './featured-match.component';
import { LeagueTableComponent } from './league-table.component';
import { SportMatchRowComponent } from './sport-match-row.component';
import { SportStageComponent } from './sport-stage.component';

/**
 * A competition's page (/workspace/sports/:sectionId): its first channel
 * playing across the top (or the one the way in asked for), the row of
 * its signals, then its first match, the others on now and to come (none
 * that is over), and its standings where it has a league table.
 */
@Component({
    selector: 'lib-sport-section-page',
    imports: [
        FeaturedMatchComponent,
        LeagueTableComponent,
        SportMatchRowComponent,
        SportStageComponent,
        TranslatePipe,
    ],
    providers: [SportTvPlayback, SportTvGuide],
    templateUrl: './sport-section-page.component.html',
    styleUrl: './sport-section-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportSectionPageComponent {
    readonly sports = inject(SportsCatalogService);
    readonly tv = inject(SportTvPlayback);
    private readonly host: HTMLElement = inject(ElementRef).nativeElement;
    private readonly router = inject(Router);

    /** Bound from the route parameter. */
    readonly sectionId = input<string>('');
    readonly section = computed(() => findSportSection(this.sectionId()));
    readonly content = computed(() => {
        const section = this.section();
        const catalog = this.sports.catalog();
        return section && catalog ? catalog[section.id] : null;
    });
    readonly matches = computed(() =>
        this.sports.upcoming(this.content()?.matches ?? [])
    );
    readonly liveMatches = computed(() =>
        this.matches().filter((match) => this.sports.isLive(match))
    );
    readonly families = computed(() =>
        groupChannelFamilies(this.content()?.channels ?? [])
    );
    readonly cards = computed(() =>
        signalCards(this.families(), this.liveMatches())
    );
    readonly featured = computed(() => this.matches()[0] ?? null);
    readonly rest = computed(() => this.matches().slice(1));
    /** The standings, once loaded; null without them. */
    readonly table = signal<LeagueTable | null>(null);
    readonly tableLoading = signal(false);
    /** A table column: the competition has one, loaded or on its way. */
    readonly showTable = computed(
        () => this.table() !== null || this.tableLoading()
    );
    /** The section the stage was opened for. */
    private opened: SportSectionId | null = null;

    constructor() {
        this.sports.keepFresh(inject(DestroyRef));
        effect(() => {
            const section = this.section();
            untracked(() => this.loadTable(section?.id ?? null));
        });
        effect(() => {
            const section = this.section();
            const cards = this.cards();
            if (section && this.content() && this.opened !== section.id) {
                untracked(() => this.open(section.id, cards[0]?.channel));
            }
        });
    }

    /** A match's channel, on the stage at the top. */
    watch(channel: SportChannel): void {
        this.tv.play(channel);
        this.host
            .querySelector('lib-sport-stage')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /** "Matches and table": down to them. */
    showMore(): void {
        this.host
            .querySelector('.page__body')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    private open(sectionId: SportSectionId, first?: SportChannel): void {
        this.opened = sectionId;
        // The navigation's state, or (once it ended) the history entry's.
        const state =
            untracked(() => this.router.currentNavigation())?.extras.state ??
            (typeof history === 'undefined' ? null : history.state);
        const channel = playRequest(state) ?? first;
        if (channel) {
            this.tv.open(channel);
        }
    }

    private loadTable(sectionId: SportSectionId | null): void {
        this.table.set(null);
        if (!sectionId || !hasLeagueTable(sectionId)) {
            this.tableLoading.set(false);
            return;
        }
        this.tableLoading.set(true);
        void this.sports.tables.table(sectionId).then((table) => {
            if (this.section()?.id === sectionId) {
                this.table.set(table);
                this.tableLoading.set(false);
            }
        });
    }
}
