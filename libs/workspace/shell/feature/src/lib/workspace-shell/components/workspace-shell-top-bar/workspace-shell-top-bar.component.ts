import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    Injector,
    input,
    output,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PlaylistSwitcherComponent } from '@iptvnator/playlist/shared/ui';
import {
    WorkspaceBackTarget,
    WorkspaceHeaderAction,
} from '@iptvnator/portal/shared/util';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { WorkspaceHeaderSidebarToggle } from '../../services/helpers/workspace-shell-constants';
import { WorkspaceShellTopBarIconComponent } from './workspace-shell-top-bar-icon.component';
import {
    WORKSPACE_SETTINGS_LINK,
    WORKSPACE_SPORTS_HUB_LINK,
    WORKSPACE_TOP_BAR_TABS,
    WorkspaceTopBarPage,
    WorkspaceTopBarTabId,
} from './workspace-top-bar-nav';

/**
 * How Buscar searches here: `inline` opens a field in the bar that
 * filters the page itself (a channel list, Ajustes, Mi lista); `page`
 * opens the search page.
 */
export type WorkspaceTopBarSearchMode = 'inline' | 'page';

/**
 * The TiagoTV top bar: a transparent 84px band over the top of the window
 * whose groups alone take the pointer. Left, room for the macOS traffic
 * lights, then Back on deep pages ("‹ Deportes" on a league page) and the
 * phone drawer toggle; centre, the glass tab capsule; right, the page's own
 * shortcuts, Buscar, Ajustes and the profile circle, which is the source
 * switcher (⌘P).
 */
@Component({
    selector: 'app-workspace-shell-top-bar',
    imports: [
        MatIcon,
        MatTooltip,
        PlaylistSwitcherComponent,
        RouterLink,
        TranslatePipe,
        WorkspaceShellTopBarIconComponent,
    ],
    templateUrl: './workspace-shell-top-bar.component.html',
    styleUrl: './workspace-shell-top-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(window:resize)': 'measureTabs()',
    },
})
export class WorkspaceShellTopBarComponent {
    private readonly injector = inject(Injector);
    private readonly router = inject(Router);
    private readonly tabsTrack =
        viewChild<ElementRef<HTMLElement>>('tabsTrack');
    private readonly searchInput =
        viewChild<ElementRef<HTMLInputElement>>('searchInput');
    private readonly searchButton =
        viewChild<ElementRef<HTMLButtonElement>>('searchButton');
    private readonly contextDrawerToggle = viewChild<
        ElementRef<HTMLButtonElement>
    >('contextDrawerToggle');

    readonly page = input.required<WorkspaceTopBarPage>();
    readonly activeTab = input<WorkspaceTopBarTabId | null>(null);
    /** The page's Back; null on the pages the bar itself reaches. */
    readonly back = input<WorkspaceBackTarget | null>(null);
    readonly headerShortcut = input<WorkspaceHeaderAction | null>(null);
    readonly headerSidebarToggle = input<WorkspaceHeaderSidebarToggle | null>(
        null
    );
    /** Phone width: the context panel is a drawer, opened from here. */
    readonly showContextDrawerToggle = input(false);
    readonly isContextDrawerOpen = input(false);
    readonly contextDrawerToggleAriaKey = input(
        'WORKSPACE.SHELL.CONTEXT_DRAWER_CATEGORIES_TOGGLE'
    );
    readonly contextDrawerTooltipKey = input(
        'WORKSPACE.SHELL.CONTEXT_DRAWER_CATEGORIES_TOOLTIP'
    );
    readonly searchMode = input<WorkspaceTopBarSearchMode>('page');
    readonly searchQuery = input('');
    readonly searchPlaceholder = input('WORKSPACE.TOP_BAR.SEARCH');
    readonly parentalLockState = input<'off' | 'locked' | 'unlocked'>('off');
    readonly activeDownloadsCount = input(0);
    readonly playlistTitle = input('');
    readonly playlistSubtitle = input('');

    readonly backRequested = output<void>();
    /** "‹ Deportes": up to the sports hub (the shell keeps history flat). */
    readonly sportsHubRequested = output<void>();
    /** The lit tab clicked again, on a URL the router already shows. */
    readonly activeTabReselected = output<void>();
    readonly contextDrawerToggleRequested = output<void>();
    readonly headerShortcutRequested = output<void>();
    readonly headerSidebarToggleRequested = output<void>();
    readonly searchChanged = output<string>();
    readonly searchSubmitted = output<string>();
    /** Buscar on a page that does not filter itself: open the search page. */
    readonly searchPageRequested = output<void>();
    readonly downloadsRequested = output<void>();
    readonly parentalLockToggleRequested = output<void>();
    readonly addPlaylistRequested = output<void>();
    readonly accountInfoForPlaylistRequested = output<PlaylistMeta>();

    readonly tabs = WORKSPACE_TOP_BAR_TABS;
    /** The pill's address, for a new window; a click goes up instead. */
    readonly sportsHubHref = this.router.serializeUrl(
        this.router.createUrlTree([...WORKSPACE_SPORTS_HUB_LINK])
    );
    readonly settingsLink = WORKSPACE_SETTINGS_LINK;
    /** Narrow windows: tabs hidden past either end of the capsule. */
    readonly tabsMoreStart = signal(false);
    readonly tabsMoreEnd = signal(false);

    private readonly searchOpened = signal(false);
    /**
     * The inline field shows while it is opened and, so the filter stays
     * visible, while it holds a query.
     */
    readonly searchOpen = computed(
        () =>
            this.searchMode() === 'inline' &&
            (this.searchOpened() || this.searchQuery().trim().length > 0)
    );
    readonly searchActive = computed(() => this.page().utility === 'search');
    private readonly backPhoneSlot = computed(() => {
        const back = this.back();
        return back ? (back.phoneDrawerToggle ?? 'replace') : null;
    });
    /** The drawer toggle renders unless Back takes its phone slot. */
    readonly showDrawerToggle = computed(
        () =>
            this.showContextDrawerToggle() && this.backPhoneSlot() !== 'replace'
    );
    /** At phone width, the history Back hides behind the drawer toggle. */
    readonly backYieldsToDrawerToggle = computed(
        () => this.showDrawerToggle() && this.backPhoneSlot() === 'yield'
    );
    readonly settingsActive = computed(
        () => this.page().utility === 'settings'
    );

    constructor() {
        // A page change that leaves inline search behind closes the field.
        effect(() => {
            if (this.searchMode() !== 'inline') {
                untracked(() => this.searchOpened.set(false));
            }
        });
        // A narrow capsule scrolls: the lit tab is always in view.
        effect(() => {
            this.activeTab();
            afterNextRender(() => this.revealActiveTab(), {
                injector: this.injector,
            });
        });
    }

    /** A plain click on "‹ Deportes"; a modified one keeps the browser's. */
    onSportsHubClick(event: MouseEvent): void {
        if (isModifiedClick(event)) {
            return;
        }
        event.preventDefault();
        this.sportsHubRequested.emit();
    }

    /** The lit tab clicked again: the router has nowhere to go. */
    onTabClick(event: MouseEvent, tabId: WorkspaceTopBarTabId): void {
        if (tabId === this.activeTab() && !isModifiedClick(event)) {
            this.activeTabReselected.emit();
        }
    }

    /** Which ends of a narrow capsule hide tabs, for its edge fades. */
    measureTabs(): void {
        const track = this.tabsTrack()?.nativeElement;
        if (!track) {
            return;
        }
        const hidden = track.scrollWidth - track.clientWidth;
        this.tabsMoreStart.set(hidden > 1 && track.scrollLeft > 1);
        this.tabsMoreEnd.set(hidden > 1 && track.scrollLeft < hidden - 1);
    }

    /** Buscar: the inline field here, the search page elsewhere. */
    onSearchButton(): void {
        if (this.searchMode() !== 'inline') {
            this.searchPageRequested.emit();
            return;
        }
        this.openSearch();
    }

    /**
     * Opens and focuses the inline field. Reports whether this page has
     * one; without it the caller opens the search page.
     */
    focusSearch(options: { select?: boolean } = {}): boolean {
        if (this.searchMode() !== 'inline') {
            return false;
        }
        this.openSearch(options);
        return true;
    }

    containsSearchInput(target: EventTarget | null): boolean {
        return !!target && target === this.searchInput()?.nativeElement;
    }

    onSearchInput(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchChanged.emit(target?.value ?? '');
    }

    onSearchEnter(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchSubmitted.emit(target?.value ?? this.searchQuery());
    }

    /** Esc clears the query first, then closes the field. */
    onSearchEscape(event: Event): void {
        event.preventDefault();
        if (this.searchQuery().length > 0) {
            this.searchChanged.emit('');
            return;
        }
        this.closeSearch();
    }

    /** × clears the query and closes the field; focus returns to Buscar. */
    closeSearch(): void {
        if (this.searchQuery().length > 0) {
            this.searchChanged.emit('');
        }
        this.searchOpened.set(false);
        afterNextRender(() => this.searchButton()?.nativeElement.focus(), {
            injector: this.injector,
        });
    }

    /**
     * An empty field folds back into the circle once focus leaves it. Only
     * the field's own controls count: the Buscar circle loses focus as the
     * field replaces it.
     */
    onSearchFocusOut(event: FocusEvent): void {
        const group = event.currentTarget as HTMLElement | null;
        const left = event.target as Element | null;
        const next = event.relatedTarget as Node | null;
        if (
            !left?.closest('.topbar__search-field') ||
            (next && group?.contains(next))
        ) {
            return;
        }
        if (this.searchQuery().trim().length === 0) {
            this.searchOpened.set(false);
        }
    }

    /**
     * The tooltip advertises Escape for Back. The page only handles it with
     * focus inside the page, so the button keeps that promise itself.
     */
    onBackEscape(event: Event): void {
        const keyboard = event as KeyboardEvent;
        if (
            !this.back()?.escapeShortcut() ||
            keyboard.defaultPrevented ||
            keyboard.repeat ||
            keyboard.altKey ||
            keyboard.ctrlKey ||
            keyboard.metaKey ||
            keyboard.shiftKey
        ) {
            return;
        }
        keyboard.preventDefault();
        this.backRequested.emit();
    }

    /**
     * Returns focus to the drawer toggle after the drawer closes; reports
     * whether it took it (gone after a navigation, hidden above phone width).
     */
    focusContextDrawerToggle(): boolean {
        const toggle = this.contextDrawerToggle()?.nativeElement;
        if (!toggle) {
            return false;
        }
        toggle.focus();
        return document.activeElement === toggle;
    }

    private revealActiveTab(): void {
        const track = this.tabsTrack()?.nativeElement;
        const active = track?.querySelector<HTMLElement>('.topbar__tab.is-active');
        if (
            track &&
            active &&
            track.scrollWidth > track.clientWidth &&
            typeof track.scrollTo === 'function'
        ) {
            const centre = active.offsetLeft + active.offsetWidth / 2;
            track.scrollTo({ left: centre - track.clientWidth / 2 });
        }
        this.measureTabs();
    }

    private openSearch(options: { select?: boolean } = {}): void {
        this.searchOpened.set(true);
        afterNextRender(
            () => {
                const field = this.searchInput()?.nativeElement;
                if (!field) {
                    return;
                }
                field.focus();
                if (options.select) {
                    field.select();
                }
            },
            { injector: this.injector }
        );
    }
}

function isModifiedClick(event: MouseEvent): boolean {
    return (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
    );
}
