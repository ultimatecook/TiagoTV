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
import { NowPlayingDockService } from '@iptvnator/ui/playback';
import { groupChannelFamilies } from '../channel-families';
import { hasLeagueTable, type LeagueTable } from '../league-tables';
import { feedCards, signalCards } from '../signal-cards';
import { playRequest, playRequestMatch } from '../sports-board.service';
import { SportsCatalogService } from '../sports-catalog.service';
import { focusedMatch, SportFeedFallback } from '../sport-feed-fallback';
import { findSportSection, type SportSectionId } from '../sport-sections';
import type { SportChannel, SportMatch } from '../sports-catalog';
import { SportTvGuide } from '../sport-tv-guide';
import { SportTvPlayback } from '../sport-tv-playback';
import { PageStateComponent } from '../../ui-state/page-state.component';
import { FeaturedMatchComponent } from './featured-match.component';
import { LeagueTableComponent } from './league-table.component';
import { SportMatchRowComponent } from './sport-match-row.component';
import { SportStageComponent } from './sport-stage.component';

/**
 * A competition's page (/workspace/sports/:sectionId): its first channel
 * playing across the top (or the one the way in asked for), the row of
 * its signals, then its first match, the others on now and to come (none
 * that is over), and its standings where it has a league table. The match
 * the way in (or a click) asked for, or the one whose feed plays, is in
 * focus: the row lists its signals in every language (see match-feeds).
 */
@Component({
    selector: 'lib-sport-section-page',
    imports: [
        FeaturedMatchComponent,
        LeagueTableComponent,
        PageStateComponent,
        SportMatchRowComponent,
        SportStageComponent,
        TranslatePipe,
    ],
    providers: [SportTvPlayback, SportTvGuide, SportFeedFallback],
    templateUrl: './sport-section-page.component.html',
    styleUrl: './sport-section-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportSectionPageComponent {
    readonly sports = inject(SportsCatalogService);
    readonly tv = inject(SportTvPlayback);
    private readonly host: HTMLElement = inject(ElementRef).nativeElement;
    private readonly router = inject(Router);
    private readonly dock = inject(NowPlayingDockService);
    private readonly fallback = inject(SportFeedFallback);

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
    /** The match the way in or a click asked for (its key). */
    private readonly focusKey = signal<string | null>(null);
    readonly focus = computed(() =>
        focusedMatch(
            this.matches(),
            this.focusKey(),
            this.tv.selection()?.streamId ?? null
        )
    );
    readonly feeds = computed(() => {
        const match = this.focus();
        return match ? feedCards(match) : [];
    });
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
            const key = this.focus()?.key ?? null;
            untracked(() => this.fallback.focus(key));
        });
        effect(() => {
            const section = this.section();
            const cards = this.cards();
            if (section && this.content() && this.opened !== section.id) {
                untracked(() =>
                    this.open(
                        section.id,
                        cards.map((card) => card.channel)
                    )
                );
            }
        });
    }

    /**
     * A match's channel, on the stage at the top, the match in focus; one
     * the viewer picked from its list, not the one it plays by default,
     * is theirs (see SportFeedFallback).
     */
    watch(channel: SportChannel, match: SportMatch): void {
        this.focusKey.set(match.key);
        const byDefault = match.via[0]?.channel ?? match;
        this.fallback.played(
            channel.streamId,
            channel.streamId !== byDefault.streamId
        );
        this.tv.play(channel);
        this.host
            .querySelector('lib-sport-stage')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    retry(): void {
        void this.sports.load();
    }

    /** "Matches and table": down to them. */
    showMore(): void {
        this.host
            .querySelector('.page__body')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    private open(
        sectionId: SportSectionId,
        channels: readonly SportChannel[]
    ): void {
        this.opened = sectionId;
        // The navigation's state, or (once it ended) the history entry's.
        const state =
            untracked(() => this.router.currentNavigation())?.extras.state ??
            (typeof history === 'undefined' ? null : history.state);
        const request = playRequest(state);
        this.focusKey.set(playRequestMatch(state));
        // The mini-player's channel, when it is one of this page's: back
        // from the mini-player, the state replays the way in (the channel
        // asked for then), not the one picked later and left playing.
        const docked = this.tv.dockedChannel(channels);
        const returning =
            !!docked &&
            request?.streamId ===
                playRequest(this.dock.session()?.returnState ?? null)?.streamId;
        const channel = (returning ? docked : request) ?? docked ?? channels[0];
        if (channel) {
            this.fallback.played(channel.streamId, false);
            this.tv.open(channel, !!request && !returning);
        } else {
            // Reused for another competition with no channel: the previous
            // one's stream must not carry over (it goes like any page's).
            this.tv.clear();
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
