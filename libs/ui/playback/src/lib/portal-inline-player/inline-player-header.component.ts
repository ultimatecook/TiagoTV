import { ClipboardModule } from '@angular/cdk/clipboard';
import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import type { TitlePlatformBrand } from '@iptvnator/services';
import type { PlayerMediaTitle } from '../player-controls/player-controls.model';

/**
 * The title page player's header, over the top of the picture like the
 * En vivo and league stages: the platform's logo, the film or show and the
 * episode on the left; the page's own actions (projected: the sources
 * chip), a "…" menu (copy the stream's address) and a round close button
 * on the right. The address is never shown, only copied on request.
 */
@Component({
    selector: 'app-inline-player-header',
    templateUrl: './inline-player-header.component.html',
    styleUrl: './inline-player-header.component.scss',
    imports: [
        ClipboardModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        TranslateModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'inline-player-header' },
})
export class InlinePlayerHeaderComponent {
    /** The film or show, and the episode ("S1:E2 · Name"). */
    readonly heading = input<PlayerMediaTitle | null>(null);
    readonly brand = input<TitlePlatformBrand | null>(null);
    readonly streamUrl = input('');

    /** Close: back to the title page, the stream stops. */
    readonly closed = output<void>();
    readonly streamUrlCopied = output<void>();

    /** The logo failed to load: the platform's name is written instead. */
    readonly logoFailed = signal(false);

    onCopied(): void {
        this.streamUrlCopied.emit();
    }
}
