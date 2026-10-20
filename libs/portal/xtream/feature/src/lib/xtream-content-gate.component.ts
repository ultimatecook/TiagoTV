import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PlaylistErrorViewComponent } from '@iptvnator/portal/shared/ui';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { XtreamCachedOfflineNoticeComponent } from './xtream-cached-offline-notice.component';

@Component({
    selector: 'app-xtream-content-gate',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        PlaylistErrorViewComponent,
        RouterOutlet,
        TranslatePipe,
        XtreamCachedOfflineNoticeComponent,
    ],
    template: `
        @if (effectiveBlockReason(); as blockReason) {
            <div class="xtream-content-gate">
                <app-playlist-error-view
                    [title]="titleKey() | translate"
                    [description]="descriptionKey() | translate"
                />

                <div class="xtream-content-gate__actions">
                    <button
                        mat-flat-button
                        color="primary"
                        type="button"
                        (click)="retryContentInitialization()"
                    >
                        <mat-icon>refresh</mat-icon>
                        {{ 'DOWNLOADS.RETRY' | translate }}
                    </button>
                </div>
            </div>
        } @else {
            <app-xtream-cached-offline-notice />
            <router-outlet />
        }
    `,
    styles: [
        `
            .xtream-content-gate {
                display: grid;
                gap: 12px;
                justify-items: center;
                padding: 24px;
            }

            /* A platform's title page runs up under the top bar (the
               shell drops its spacer there): the message starts below it. */
            :host-context([data-platform-theme]) .xtream-content-gate {
                padding-top: var(--tv-topbar-h);
            }

            /* Retry follows the message's own actions as one row of the
               state (the view keeps its top padding, not its bottom). */
            .xtream-content-gate ::ng-deep .error-view {
                min-height: 0;
                padding-bottom: 0;
            }

            .xtream-content-gate__actions {
                display: flex;
                justify-content: center;
            }
        `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class XtreamContentGateComponent {
    private readonly xtreamStore = inject(XtreamStore);

    readonly contentInitBlockReason = this.xtreamStore.contentInitBlockReason;
    readonly isPendingRestoreBlocked = this.xtreamStore.isPendingRestoreBlocked;
    readonly effectiveBlockReason = computed(
        () =>
            this.contentInitBlockReason() ??
            (this.isPendingRestoreBlocked() ? 'error' : null)
    );
    private readonly errorViewKey = computed(() => {
        switch (this.effectiveBlockReason()) {
            case 'cancelled':
                return 'IMPORT_CANCELLED';
            case 'expired':
                return 'ACCOUNT_EXPIRED';
            case 'inactive':
                return 'ACCOUNT_INACTIVE';
            case 'unavailable':
                return 'PORTAL_UNAVAILABLE';
            case 'error':
            default:
                return 'UNKNOWN_ERROR';
        }
    });
    readonly titleKey = computed(
        () => `PORTALS.ERROR_VIEW.${this.errorViewKey()}.TITLE`
    );
    readonly descriptionKey = computed(
        () => `PORTALS.ERROR_VIEW.${this.errorViewKey()}.DESCRIPTION`
    );

    retryContentInitialization(): void {
        void this.xtreamStore.retryContentInitialization();
    }
}
