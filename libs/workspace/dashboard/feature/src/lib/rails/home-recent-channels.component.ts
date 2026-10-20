import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { isCatalogUnavailable } from '@iptvnator/shared/interfaces';
import {
    buildDashboardPortalLiveEpgKey,
    DashboardDataService,
    type GlobalRecentItem,
} from '@iptvnator/workspace/dashboard/data-access';
import type { DashboardRailCard } from './dashboard-rail-card';
import { buildDashboardCollectionViewState } from './dashboard-rail.utils';
import { DashboardLiveEpgPresenter } from './dashboard-live-epg.presenter';
import { HomeHeadingComponent } from './home-heading.component';
import { HomeNearDirective } from './home-near.directive';
import { homeChannelFace, type HomeChannelFace } from './home-recent-channels';
import { RememberScrollDirective } from '../ui-state/remember-scroll.directive';

/** Channels the row lists. */
const CHANNEL_LIMIT = 12;
/** The cards in view when the row comes near: their programmes are asked. */
const CARDS_IN_VIEW = 5;

interface HomeChannelCard extends HomeChannelFace {
    readonly card: DashboardRailCard;
    readonly programme: string | null;
    readonly progress: number | null;
}

/**
 * "Últimos canales vistos": the live channels watched last, from the
 * playback history, with the programme on air where the guide knows it
 * (the page's `DashboardLiveEpgPresenter`, asked for the cards in view
 * once the row comes near). A card plays its channel.
 */
@Component({
    selector: 'lib-home-recent-channels',
    imports: [
        HomeHeadingComponent,
        HomeNearDirective,
        RememberScrollDirective,
        RouterLink,
        TranslatePipe,
    ],
    templateUrl: './home-recent-channels.component.html',
    styleUrl: './home-recent-channels.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeRecentChannelsComponent {
    private readonly data = inject(DashboardDataService);
    private readonly liveEpg = inject(DashboardLiveEpgPresenter);
    private readonly failedLogos = signal<ReadonlySet<string>>(new Set());

    readonly seeAllState = buildDashboardCollectionViewState('live');

    private readonly baseCards = computed<DashboardRailCard[]>(() =>
        this.data
            .globalRecentLiveItems()
            .filter((item) => !isCatalogUnavailable(item))
            .slice(0, CHANNEL_LIMIT)
            .map((item) => this.toCard(item))
    );

    readonly channels = computed<HomeChannelCard[]>(() =>
        this.liveEpg.enrich(this.baseCards()).map((card) => {
            const face = homeChannelFace(card.title, card.imageUrl);
            return {
                ...face,
                logo:
                    face.logo && !this.failedLogos().has(face.logo)
                        ? face.logo
                        : null,
                card,
                programme: card.nowPlayingTitle ?? null,
                progress: card.nowPlayingProgress ?? null,
            };
        })
    );

    constructor() {
        this.liveEpg.connect(this.baseCards);
    }

    /** The row came near: the programmes of the cards in view are asked. */
    onNear(): void {
        this.liveEpg.setVisibleCards(
            'recent',
            this.baseCards().slice(0, CARDS_IN_VIEW)
        );
    }

    markFailed(url: string): void {
        this.failedLogos.update((failed) => new Set(failed).add(url));
    }

    private toCard(item: GlobalRecentItem): DashboardRailCard {
        return {
            id: `recent-${item.id}-${item.playlist_id}-${item.viewed_at}`,
            title: item.title,
            imageUrl: item.poster_url,
            icon: 'live_tv',
            contentType: 'live',
            epgLookupKey: item.epg_lookup_key,
            epgPlaylistId: item.playlist_id,
            liveEpgSourceKey: buildDashboardPortalLiveEpgKey(item),
            link: this.data.getRecentItemLink(item),
            state: this.data.getRecentItemNavigationState(item),
        };
    }
}
