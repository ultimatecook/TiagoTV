import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    input,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { groupChannelFamilies } from '../channel-families';
import { SportsCatalogService } from '../sports-catalog.service';
import { findSportSection } from '../sport-sections';
import type { SportChannel } from '../sports-catalog';
import { ChannelFamilyCardComponent } from './channel-family-card.component';
import { SportMatchCardComponent } from './sport-match-card.component';

/**
 * A competition's page (/workspace/sports/:sectionId): its matches on now
 * and to come (none that is over), then its channels, one card per
 * channel with its feeds. Everything plays in the live player.
 */
@Component({
    selector: 'lib-sport-section-page',
    imports: [
        ChannelFamilyCardComponent,
        SportMatchCardComponent,
        TranslatePipe,
    ],
    templateUrl: './sport-section-page.component.html',
    styleUrl: './sport-section-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportSectionPageComponent {
    readonly sports = inject(SportsCatalogService);

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
    readonly liveCount = computed(
        () => this.matches().filter((match) => this.sports.isLive(match)).length
    );
    readonly families = computed(() =>
        groupChannelFamilies(this.content()?.channels ?? [])
    );

    constructor() {
        this.sports.keepFresh(inject(DestroyRef));
    }

    play(channel: SportChannel): void {
        this.sports.play(channel);
    }
}
