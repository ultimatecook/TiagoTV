import { DOCUMENT, Location } from '@angular/common';
import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    InjectionToken,
    signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { WorkspaceBackTarget } from '@iptvnator/portal/shared/util';
import { trackRouterHistoryDepth } from './router-history-depth';

/** The parts of the browser's Navigation API the history fallback reads. */
export type WorkspaceHistoryNavigation = Pick<
    Navigation,
    'currentEntry' | 'entries' | 'addEventListener' | 'removeEventListener'
>;

/**
 * The browser's Navigation API; null where it is missing (older Safari and
 * Firefox, jsdom), which leaves the header without the history fallback.
 */
export const WORKSPACE_HISTORY_NAVIGATION =
    new InjectionToken<WorkspaceHistoryNavigation | null>(
        'WORKSPACE_HISTORY_NAVIGATION',
        {
            providedIn: 'root',
            factory: () => inject(DOCUMENT).defaultView?.navigation ?? null,
        }
    );

/**
 * Where a page's Back leads when there is no in-app history: a URL or router
 * commands. Null keeps browser history.
 */
export type WorkspaceBackParent = string | readonly string[] | null;

/**
 * True when the previous history entry belongs to this document, i.e. the
 * router pushed it in this app session. Entries from before a reload or from
 * another page of the origin are excluded, so the fallback never leaves the
 * app or reloads it.
 */
function hasInAppPreviousEntry(history: WorkspaceHistoryNavigation): boolean {
    return previousInAppEntry(history) !== null;
}

function previousInAppEntry(
    history: WorkspaceHistoryNavigation
): NavigationHistoryEntry | null {
    const index = history.currentEntry?.index ?? -1;
    const previous = index > 0 ? history.entries()[index - 1] : undefined;
    return previous?.sameDocument === true ? previous : null;
}

/** True when the next history entry belongs to this document. */
function hasInAppNextEntry(history: WorkspaceHistoryNavigation): boolean {
    const index = history.currentEntry?.index ?? -1;
    const next = index >= 0 ? history.entries()[index + 1] : undefined;
    return next?.sameDocument === true;
}

/**
 * Owns the header's Back slot. Pages register while they offer Back; the most
 * recent registration wins, so a page opened above another one takes the slot
 * and hands it back when it goes away. Without a registration the slot falls
 * back to browser history while an in-app previous entry exists, and is empty
 * otherwise (never a disabled arrow).
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceBackNavigationService {
    private readonly location = inject(Location);
    private readonly router = inject(Router);
    private readonly history = inject(WORKSPACE_HISTORY_NAVIGATION);
    private readonly targets = signal<readonly WorkspaceBackTarget[]>([]);
    private readonly canGoBackInApp = signal(false);
    /**
     * History Forward stays in the app: the next entry is one the router
     * pushed in this document (never one from before a reload).
     */
    readonly canGoForward = signal(false);
    /** In-app history depth where the Navigation API is missing. */
    private readonly routerDepth = this.history
        ? () => null
        : trackRouterHistoryDepth(this.router, inject(DestroyRef));

    /**
     * Generic Back to the previous page. It advertises no Escape (no page
     * handles one) and yields to the phone drawer toggle, so the categories
     * of a list reached by navigation stay reachable.
     */
    private readonly historyTarget: WorkspaceBackTarget = {
        label: signal(null),
        escapeShortcut: signal(false),
        phoneDrawerToggle: 'yield',
        run: () => this.location.back(),
    };

    /**
     * The newest page registration, without the history fallback: a page
     * the bar reaches itself shows Back only for what it opened in place (a
     * title over Mi lista), never for the page it was reached from.
     */
    readonly pageTarget = computed(() => {
        const targets = this.targets();
        return targets[targets.length - 1] ?? null;
    });

    readonly target = computed(
        () =>
            this.pageTarget() ??
            (this.canGoBackInApp() ? this.historyTarget : null)
    );

    constructor() {
        const history = this.history;
        if (!history) return;
        // Fires for router pushes and replacements and for traversals,
        // including a guard-cancelled Back that the router rewrites.
        const sync = () => {
            this.canGoBackInApp.set(hasInAppPreviousEntry(history));
            this.canGoForward.set(hasInAppNextEntry(history));
        };
        sync();
        history.addEventListener('currententrychange', sync);
        inject(DestroyRef).onDestroy(() =>
            history.removeEventListener('currententrychange', sync)
        );
    }

    /**
     * Back for a page with a parent route. Browser history while the previous
     * entry is an in-app one. Otherwise the page opened the session (deep
     * link, reload, restored view), where `Location.back()` would do nothing
     * in Electron or leave the app in a browser: the parent replaces the
     * current entry, so history Back cannot return to the page just left.
     * Without the Navigation API the router's history depth decides, and an
     * unknown depth (a traversal to an entry from before a reload) keeps
     * browser history, which then has a previous entry.
     */
    back(
        resolveParent: () => WorkspaceBackParent | Promise<WorkspaceBackParent>
    ): void {
        const inApp = this.history
            ? this.canGoBackInApp()
            : (this.routerDepth() ?? 1) > 0;
        if (inApp) {
            this.location.back();
            return;
        }
        void this.openParent(resolveParent);
    }

    /**
     * Up to a page's fixed parent (a league page's "‹ Deportes", the parent's
     * router path). History Back while the previous entry is that parent, so
     * the page just left becomes Forward instead of the next Back; otherwise
     * the parent replaces this entry, so history Back cannot return to it.
     */
    up(parentPath: string): void {
        const previous = this.history && previousInAppEntry(this.history);
        if (previous?.url && this.routerPath(previous.url) === parentPath) {
            this.location.back();
            return;
        }
        void this.router.navigateByUrl(parentPath, { replaceUrl: true });
    }

    /**
     * Returns the release function. It removes only this target: when one
     * page replaces another (a loading shell by the loaded one), creation and
     * destruction can interleave in either order.
     */
    register(target: WorkspaceBackTarget): () => void {
        this.targets.update((targets) => [
            ...targets.filter((entry) => entry !== target),
            target,
        ]);
        return () =>
            this.targets.update((targets) =>
                targets.filter((entry) => entry !== target)
            );
    }

    /** Runs the current target; false when the header shows no Back. */
    goBack(): boolean {
        const target = this.target();
        if (!target) return false;
        target.run();
        return true;
    }

    /**
     * History Forward while the next entry is an in-app one; false (nothing
     * runs) otherwise, and where the Navigation API is missing.
     */
    goForward(): boolean {
        if (!this.canGoForward()) return false;
        this.location.forward();
        return true;
    }

    /** A history entry's URL as a router path (base href and query aside). */
    private routerPath(url: string): string | null {
        try {
            return this.location.normalize(new URL(url).pathname);
        } catch {
            return null;
        }
    }

    private async openParent(
        resolveParent: () => WorkspaceBackParent | Promise<WorkspaceBackParent>
    ): Promise<void> {
        const parent = await resolveParent();
        if (parent === null) {
            this.location.back();
        } else if (typeof parent === 'string') {
            await this.router.navigateByUrl(parent, { replaceUrl: true });
        } else {
            await this.router.navigate([...parent], { replaceUrl: true });
        }
    }
}
