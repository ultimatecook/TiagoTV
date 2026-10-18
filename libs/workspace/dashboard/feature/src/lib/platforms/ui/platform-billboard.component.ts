import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { PlatformLook } from '../platform-design';
import type { PlatformTitle } from '../platform-titles';
import type { StreamingPlatform } from '../streaming-platforms';
import { PlatformHeroSlides, titleTypeKey } from './platform-hero-slides';
import { PlatformLogoComponent } from './platform-logo.component';

/** The looks whose "More info" is a labelled button, not a round one. */
const TEXT_INFO: ReadonlySet<PlatformLook> = new Set<PlatformLook>([
    'netflix',
    'hulu',
    'atres',
]);

/**
 * The full-bleed billboard that opens Netflix, HBO Max, Apple TV,
 * Paramount+, Hulu, Movistar Plus+, atresplayer and Crave: recommended
 * titles in turn over the whole width, the title large at the lower left
 * with its synopsis and the platform's own buttons — Netflix's white
 * "Play" and grey "More info", HBO Max's and Apple TV's white pill beside
 * a round button, Paramount+'s blue pill, Hulu's white "Reproducir"…
 */
@Component({
    selector: 'lib-platform-billboard',
    imports: [MatIcon, PlatformLogoComponent, TranslatePipe],
    templateUrl: './platform-billboard.component.html',
    styleUrl: './platform-billboard.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[attr.data-look]': 'look()' },
})
export class PlatformBillboardComponent {
    readonly platform = input.required<StreamingPlatform>();
    readonly look = input.required<PlatformLook>();
    readonly titles = input.required<readonly PlatformTitle[]>();
    readonly playKey = input('WORKSPACE.PLATFORMS.WATCH');

    readonly textInfo = computed(() => TEXT_INFO.has(this.look()));

    readonly hero = new PlatformHeroSlides(this.titles);
    readonly typeKey = titleTypeKey;
}
