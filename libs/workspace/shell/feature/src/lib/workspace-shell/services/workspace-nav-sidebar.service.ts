import { DOCUMENT } from '@angular/common';
import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    signal,
} from '@angular/core';

/** `'1'` while the main navigation sidebar is hidden. */
export const NAV_SIDEBAR_HIDDEN_STORAGE_KEY = 'tiagotv:nav-sidebar-hidden';
/** The phone layout keeps the navigation as a strip above the content. */
const PHONE_QUERY = '(max-width: 640px)';
/** Narrower windows fold the sidebar to icons; its sections open as flyouts. */
const FOLDED_QUERY = '(max-width: 1100px)';

/**
 * Whether the main navigation sidebar is hidden, so the content and header
 * take the whole window, as in fullscreen. The choice is remembered across
 * launches. Phone widths keep the navigation strip whatever it is, so the
 * shell lays out `collapsed`, not `hidden`.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceNavSidebarService {
    private readonly view = inject(DOCUMENT).defaultView;
    private readonly hiddenState = signal(this.readStored());
    private readonly phoneState = signal(false);
    private readonly foldedState = signal(false);

    readonly hidden = this.hiddenState.asReadonly();
    readonly isPhone = this.phoneState.asReadonly();
    /** Folded to icons (or the phone strip): sections open as flyouts. */
    readonly isFolded = this.foldedState.asReadonly();
    /** The sidebar is out of the layout: hidden, and not on a phone. */
    readonly collapsed = computed(
        () => this.hiddenState() && !this.phoneState()
    );
    readonly isMac = isMacPlatform(this.view?.navigator);
    /** ⌃⌘S, as Finder and Mail toggle theirs; Ctrl+Alt+S elsewhere. */
    readonly shortcutLabel = this.isMac ? '⌃⌘S' : 'Ctrl+Alt+S';
    readonly ariaShortcut = this.isMac ? 'Control+Meta+S' : 'Control+Alt+S';

    constructor() {
        const destroyRef = inject(DestroyRef);
        this.watch(
            PHONE_QUERY,
            (matches) => this.phoneState.set(matches),
            destroyRef
        );
        this.watch(
            FOLDED_QUERY,
            (matches) => this.foldedState.set(matches),
            destroyRef
        );
    }

    toggle(): void {
        this.setHidden(!this.hiddenState());
    }

    hide(): void {
        this.setHidden(true);
    }

    show(): void {
        this.setHidden(false);
    }

    /** The toggle chord for this platform. */
    isShortcut(event: KeyboardEvent): boolean {
        const chord = this.isMac
            ? event.ctrlKey && event.metaKey && !event.altKey
            : event.ctrlKey && event.altKey && !event.metaKey;
        return (
            chord &&
            !event.shiftKey &&
            (event.code === 'KeyS' || event.key?.toLowerCase() === 's')
        );
    }

    private watch(
        query: string,
        apply: (matches: boolean) => void,
        destroyRef: DestroyRef
    ): void {
        // Guarded: JSDOM has no matchMedia.
        const media =
            typeof this.view?.matchMedia === 'function'
                ? this.view.matchMedia(query)
                : null;
        if (!media) {
            return;
        }
        apply(media.matches);
        const onChange = (event: MediaQueryListEvent) => apply(event.matches);
        media.addEventListener('change', onChange);
        destroyRef.onDestroy(() =>
            media.removeEventListener('change', onChange)
        );
    }

    private setHidden(hidden: boolean): void {
        this.hiddenState.set(hidden);
        try {
            const storage = this.view?.localStorage;
            if (hidden) {
                storage?.setItem(NAV_SIDEBAR_HIDDEN_STORAGE_KEY, '1');
            } else {
                storage?.removeItem(NAV_SIDEBAR_HIDDEN_STORAGE_KEY);
            }
        } catch {
            // Storage refused (private mode, quota): the choice lasts the
            // session.
        }
    }

    private readStored(): boolean {
        try {
            return (
                this.view?.localStorage?.getItem(
                    NAV_SIDEBAR_HIDDEN_STORAGE_KEY
                ) === '1'
            );
        } catch {
            return false;
        }
    }
}

function isMacPlatform(navigator: Navigator | undefined): boolean {
    const withUserAgentData = navigator as
        (Navigator & { userAgentData?: { platform?: string } }) | undefined;
    const platform =
        withUserAgentData?.userAgentData?.platform || navigator?.userAgent;
    return /Mac|iPhone|iPad|iPod/i.test(platform ?? '');
}
