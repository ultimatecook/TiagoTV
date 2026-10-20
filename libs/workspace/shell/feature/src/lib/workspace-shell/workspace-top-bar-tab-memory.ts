import { DestroyRef } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import {
    resolveWorkspaceTopBarTab,
    WorkspaceTopBarOpener,
    WorkspaceTopBarPage,
    WorkspaceTopBarTabId,
} from './components/workspace-shell-top-bar/workspace-top-bar-nav';

/** Remembered entries; older navigations are forgotten. */
const MAX_ENTRIES = 50;

/**
 * The lit tab of each history entry. A fresh navigation resolves its tab
 * from the page it was opened from (`resolveWorkspaceTopBarTab()`); history
 * Back and Forward light the tab the entry lit when it was left, keyed by
 * the router's navigation id, which the router keeps in the entry's state
 * and renews on each visit (as `followWorkspaceScroll()` does). An entry it
 * no longer remembers resolves as one opened from nowhere: its own tab, its
 * section's, else the tab lit before.
 */
export class WorkspaceTopBarTabMemory {
    private readonly tabs = new Map<number, WorkspaceTopBarTabId | null>();
    /** The navigation that showed the current page. */
    private currentId = 0;
    /** The entry the navigation in progress (or last) restores, if any. */
    private restoredId: number | null = null;

    constructor(router: Router, destroyRef: DestroyRef) {
        const subscription = router.events.subscribe((event) => {
            if (event instanceof NavigationStart) {
                this.restoredId = event.restoredState?.navigationId ?? null;
            } else if (event instanceof NavigationEnd) {
                this.currentId = event.id;
            }
        });
        destroyRef.onDestroy(() => subscription.unsubscribe());
    }

    /** The tab to light for `page`, shown after leaving `opener`. */
    resolve(
        page: WorkspaceTopBarPage,
        opener: WorkspaceTopBarOpener | null
    ): WorkspaceTopBarTabId | null {
        const restored = this.restoredId;
        if (restored === null) {
            return resolveWorkspaceTopBarTab(page, opener);
        }
        if (this.tabs.has(restored)) {
            return this.tabs.get(restored) ?? null;
        }
        // A traversal: the page left is not this one's opener.
        return resolveWorkspaceTopBarTab(page, {
            page: null,
            tab: opener?.tab ?? null,
        });
    }

    /** Records the tab the current entry lights. */
    remember(tab: WorkspaceTopBarTabId | null): void {
        this.tabs.delete(this.currentId);
        this.tabs.set(this.currentId, tab);
        while (this.tabs.size > MAX_ENTRIES) {
            const oldest = this.tabs.keys().next().value;
            if (oldest === undefined) {
                return;
            }
            this.tabs.delete(oldest);
        }
    }
}
