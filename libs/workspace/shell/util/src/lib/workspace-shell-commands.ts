import { InjectionToken } from '@angular/core';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';

/**
 * What the workspace shell itself does for a page in its outlet: the
 * actions the removed header bar held that Settings now offers too.
 * Provided by the shell component; absent outside it (unit tests).
 */
export interface WorkspaceShellCommands {
    /** The source switcher at the sidebar's foot (⌘P / Ctrl+P). */
    openPlaylistSwitcher(): void;
    /** The account details of an Xtream or Stalker source. */
    openAccountInfo(playlist: PlaylistMeta): void;
    /** The keyboard shortcuts sheet (also on `?`). */
    openKeyboardShortcuts(): void;
}

export const WORKSPACE_SHELL_COMMANDS =
    new InjectionToken<WorkspaceShellCommands>('WORKSPACE_SHELL_COMMANDS');
