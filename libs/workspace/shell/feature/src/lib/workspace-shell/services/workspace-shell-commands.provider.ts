import { inject, Provider } from '@angular/core';
import {
    WORKSPACE_SHELL_COMMANDS,
    WorkspaceShellCommands,
} from '@iptvnator/workspace/shell/util';
import { WorkspaceKeyboardShortcutsService } from '../../workspace-keyboard-shortcuts/workspace-keyboard-shortcuts.service';
import { WorkspaceShellFacade } from './workspace-shell.facade';

/**
 * The shell's own actions for the pages in its outlet (Settings → Sources
 * & accounts): the switcher, account details and the shortcuts sheet.
 */
export function provideWorkspaceShellCommands(): Provider {
    return {
        provide: WORKSPACE_SHELL_COMMANDS,
        useFactory: (): WorkspaceShellCommands => {
            const facade = inject(WorkspaceShellFacade);
            const shortcuts = inject(WorkspaceKeyboardShortcutsService);
            return {
                openPlaylistSwitcher: () => {
                    facade.openPlaylistSwitcher();
                },
                openAccountInfo: (playlist) =>
                    facade.openAccountInfoFor(playlist),
                openKeyboardShortcuts: () => shortcuts.openShortcutsDialog(),
            };
        },
    };
}
