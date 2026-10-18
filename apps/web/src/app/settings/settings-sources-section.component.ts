import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
    RecentPlaylistsComponent,
    SourceTileComponent,
} from '@iptvnator/playlist/shared/ui';
import {
    PlaylistContextFacade,
    sourceDisplayName,
    sourceTypeLabel,
} from '@iptvnator/playlist/shared/util';
import { injectTranslationTick } from '@iptvnator/services';
import {
    isStalkerAccountPlaylist,
    isXtreamAccountPlaylist,
} from '@iptvnator/shared/interfaces';
import {
    WORKSPACE_SHELL_ACTIONS,
    WORKSPACE_SHELL_COMMANDS,
    WorkspacePlaylistType,
} from '@iptvnator/workspace/shell/util';

/**
 * Settings → Sources & accounts: what the removed header bar held. The
 * active source and its switcher, its account details, adding a playlist,
 * every source (a row opens it; its menu edits, refreshes or removes it),
 * the keyboard shortcuts sheet and the quick parental lock.
 */
@Component({
    selector: 'app-settings-sources-section',
    imports: [
        MatButtonModule,
        MatIconModule,
        RecentPlaylistsComponent,
        RouterLink,
        SourceTileComponent,
        TranslateModule,
    ],
    templateUrl: './settings-sources-section.component.html',
    styleUrl: './settings-sources-section.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSourcesSectionComponent {
    private readonly translate = inject(TranslateService);
    private readonly languageTick = injectTranslationTick();
    private readonly playlistContext = inject(PlaylistContextFacade);
    private readonly shellActions = inject(WORKSPACE_SHELL_ACTIONS, {
        optional: true,
    });
    /** The shell's own actions; absent outside the workspace shell. */
    private readonly shellCommands = inject(WORKSPACE_SHELL_COMMANDS, {
        optional: true,
    });

    readonly parentalEnabled = input(false);
    readonly parentalUnlocked = input(false);
    readonly parentalBusy = input(false);
    readonly lockNow = output<void>();
    readonly unlock = output<void>();
    readonly openParental = output<void>();

    readonly hasShell = !!this.shellCommands;
    readonly isMac =
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    readonly switcherShortcut = this.isMac ? '⌘P' : 'Ctrl+P';

    readonly active = this.playlistContext.activePlaylist;
    readonly activeName = computed(() => {
        this.languageTick();
        const active = this.active();
        return (
            (active && sourceDisplayName(active)) ||
            this.translate.instant(
                active
                    ? 'HOME.PLAYLISTS.UNTITLED_PLAYLIST'
                    : 'HOME.PLAYLISTS.SELECT_PLAYLIST'
            )
        );
    });
    readonly activeType = computed(() => {
        this.languageTick();
        const active = this.active();
        return active
            ? sourceTypeLabel(active, (key, params) =>
                  this.translate.instant(key, params)
              )
            : '';
    });
    /** Account details exist for Xtream and Stalker portals. */
    readonly hasAccount = computed(() => {
        const active = this.active();
        return (
            !!active &&
            (isXtreamAccountPlaylist(active) ||
                isStalkerAccountPlaylist(active))
        );
    });

    switchSource(): void {
        this.shellCommands?.openPlaylistSwitcher();
    }

    openAccount(): void {
        const active = this.active();
        if (active) {
            this.shellCommands?.openAccountInfo(active);
        }
    }

    addPlaylist(type?: WorkspacePlaylistType): void {
        this.shellActions?.openAddPlaylistDialog(type);
    }

    openShortcuts(): void {
        this.shellCommands?.openKeyboardShortcuts();
    }
}
