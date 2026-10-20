import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    HostListener,
    inject,
    linkedSignal,
    Signal,
    untracked,
    viewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ExternalPlaybackDockComponent } from '@iptvnator/ui/components';
import {
    EmbeddedMpvOverlayVisibilityService,
    NowPlayingBarComponent,
    NowPlayingDockService,
} from '@iptvnator/ui/playback';
import {
    PlaylistDropOverlayComponent,
    PlaylistDropZoneDirective,
} from '../playlist-drop-overlay';
import { WorkspaceShellContextSidebarComponent } from './components/workspace-shell-context-sidebar/workspace-shell-context-sidebar.component';
import { WorkspaceShellImportOverlayComponent } from './components/workspace-shell-import-overlay/workspace-shell-import-overlay.component';
import {
    WorkspaceShellTopBarComponent,
    WorkspaceTopBarSearchMode,
} from './components/workspace-shell-top-bar/workspace-shell-top-bar.component';
import {
    readWorkspaceTopBarPage,
    resolveWorkspaceTopBarTab,
    WorkspaceTopBarPage,
    WorkspaceTopBarTabId,
} from './components/workspace-shell-top-bar/workspace-top-bar-nav';
import { WorkspaceShellServerBannerComponent } from './components/workspace-shell-server-banner/workspace-shell-server-banner.component';
import { LayoutSlideDirective } from './layout-slide.directive';
import { TrafficLightsClearanceDirective } from './traffic-lights-clearance.directive';
import { WorkspaceShellFacade } from './services/workspace-shell.facade';
import { WorkspaceShellXtreamImportService } from './services/workspace-shell-xtream-import.service';
import { WorkspaceShellCommandPaletteService } from './services/workspace-shell-command-palette.service';
import { WorkspaceShellHeaderService } from './services/workspace-shell-header.service';
import { WorkspaceShellRouteStateService } from './services/workspace-shell-route-state.service';
import { WorkspaceShellSearchSyncService } from './services/workspace-shell-search-sync.service';
import { WorkspaceShellSearchService } from './services/workspace-shell-search.service';
import { followWorkspaceScroll } from './workspace-scroll-memory';
import { watchWorkspaceScrolled } from './workspace-top-scrim';
import { provideWorkspaceShellCommands } from './services/workspace-shell-commands.provider';
import { WorkspaceBackGesturesService } from '../workspace-back-gestures/workspace-back-gestures.service';
import { WorkspaceKeyboardShortcutsService } from '../workspace-keyboard-shortcuts/workspace-keyboard-shortcuts.service';
import { WorkspaceLiveCategoriesPopoverService } from '../workspace-live-categories-popover/workspace-live-categories-popover.service';
import { WorkspaceShellContextDrawerService } from '@iptvnator/workspace/shell/util';
import { LIVE_CATEGORIES_POPOVER } from '@iptvnator/portal/shared/util';

@Component({
    selector: 'app-workspace-shell',
    imports: [
        CdkTrapFocus,
        ExternalPlaybackDockComponent,
        LayoutSlideDirective,
        NowPlayingBarComponent,
        TranslatePipe,
        PlaylistDropOverlayComponent,
        PlaylistDropZoneDirective,
        RouterOutlet,
        TrafficLightsClearanceDirective,
        WorkspaceShellContextSidebarComponent,
        WorkspaceShellImportOverlayComponent,
        WorkspaceShellServerBannerComponent,
        WorkspaceShellTopBarComponent,
    ],
    templateUrl: './workspace-shell.component.html',
    styleUrl: './workspace-shell.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        WorkspaceShellFacade,
        WorkspaceShellRouteStateService,
        WorkspaceShellSearchSyncService,
        WorkspaceShellSearchService,
        WorkspaceShellHeaderService,
        WorkspaceShellXtreamImportService,
        WorkspaceShellCommandPaletteService,
        WorkspaceKeyboardShortcutsService,
        // Mouse Back, the Back chord and the Electron window gestures; the
        // shortcuts service creates it for the chord.
        WorkspaceBackGesturesService,
        // Settings → Sources & accounts runs the shell's own actions.
        provideWorkspaceShellCommands(),
        // The live layouts inside the router outlet open the folded categories
        // rail through this token; see `LiveCategoriesPopover`.
        {
            provide: LIVE_CATEGORIES_POPOVER,
            useClass: WorkspaceLiveCategoriesPopoverService,
        },
    ],
})
export class WorkspaceShellComponent {
    readonly facade = inject(WorkspaceShellFacade);
    readonly keyboardShortcuts = inject(WorkspaceKeyboardShortcutsService);
    readonly contextDrawer = inject(WorkspaceShellContextDrawerService);
    /** The bottom mini-player's session, when a page handed a stream over. */
    readonly nowPlaying = inject(NowPlayingDockService);
    private readonly mpvOverlayVisibility = inject(
        EmbeddedMpvOverlayVisibilityService
    );
    private readonly topBar =
        viewChild<WorkspaceShellTopBarComponent>('topBar');
    private readonly workspaceContent =
        viewChild<ElementRef<HTMLElement>>('workspaceContent');

    /** The painted corners of the glass window (see the stylesheet). */
    readonly windowCorners = [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
    ] as const;
    /** The top bar's view of the current page. */
    readonly topBarPage = computed(() =>
        readWorkspaceTopBarPage(this.facade.currentUrl())
    );
    /**
     * The lit tab. A deep page (a title, a channel list) keeps the tab it
     * was opened from, so the previous value is the input.
     */
    readonly activeTab = linkedSignal<
        WorkspaceTopBarPage,
        WorkspaceTopBarTabId | null
    >({
        source: this.topBarPage,
        computation: (page, previous) =>
            resolveWorkspaceTopBarTab(page, previous?.value ?? null),
    });
    /**
     * Back on a deep page; a league page has "‹ Deportes" instead. A tab's
     * own page has none (the bar is the way out) unless it opened a detail
     * in place, a title over Mi lista: the URL stays the tab's, so only
     * the detail's own Back leaves it. Buscar's and Ajustes' registrations
     * serve Escape and the gestures only.
     */
    readonly topBarBack = computed(() => {
        const page = this.topBarPage();
        if (page.isLeague) {
            return null;
        }
        if (!page.isTabRoot) {
            return this.facade.backTarget();
        }
        return page.utility ? null : this.facade.pageBackTarget();
    });
    /** The page under the bar is scrolled: the bar's scrim shows. */
    readonly pageScrolled: Signal<boolean>;
    /**
     * Buscar filters a page that searches itself (a channel list, Ajustes,
     * Mi lista); elsewhere it opens the search page, which has its own
     * field.
     */
    readonly searchMode = computed<WorkspaceTopBarSearchMode>(() => {
        const capability = this.facade.searchCapability();
        return this.topBarPage().utility !== 'search' &&
            capability.enabled &&
            capability.behavior !== 'advanced-only'
            ? 'inline'
            : 'page';
    });

    constructor() {
        const router = inject(Router);
        const destroyRef = inject(DestroyRef);
        const scroller = () => this.workspaceContent()?.nativeElement;
        followWorkspaceScroll(router, scroller, destroyRef);
        this.pageScrolled = watchWorkspaceScrolled(
            router,
            scroller,
            destroyRef
        );

        // Focus restoration is the closing half of the drawer's focus
        // contract: CdkTrapFocus captures focus into the drawer on open, but
        // deactivating a trap does not restore focus, and the closed drawer
        // is visibility: hidden — whatever was focused inside it silently
        // drops to <body>. Returning it to the toggle keeps keyboard users
        // where they acted.
        let wasOpen = false;
        effect(() => {
            const open = this.contextDrawer.isOpen();
            if (wasOpen && !open) {
                // Deferred: the bar is inert while the drawer is open, and
                // focus() on a still-inert element is silently ignored.
                // The timeout runs after the render that removes `inert`.
                setTimeout(() => {
                    if (this.topBar()?.focusContextDrawerToggle()) {
                        return;
                    }
                    // The toggle is gone — a drawer selection navigated to
                    // a route without a context panel. Focus lands on the
                    // route content instead of silently dropping to <body>.
                    this.workspaceContent()?.nativeElement.focus();
                });
            }
            wasOpen = open;
        });

        // The Embedded MPV native-view video surface is composited outside
        // DOM stacking and would paint straight over the drawer regardless
        // of z-index; registering the open drawer as an external modal
        // surface hides the native view exactly like a Material dialog does.
        effect((onCleanup) => {
            if (!this.contextDrawer.isOpen()) {
                return;
            }
            // untracked: the service reads its own signals while
            // recomputing; tracked here, that read would make this effect
            // depend on state its own acquire/release toggles.
            onCleanup(
                untracked(() =>
                    this.mpvOverlayVisibility.acquireExternalModalSurface()
                )
            );
        });
    }

    /**
     * Buscar where the page does not filter itself: the search page. On it,
     * Buscar (or find) puts the focus back in the page's own field.
     */
    openSearchPage(): void {
        if (this.topBarPage().utility === 'search') {
            this.focusPageSearchField();
            return;
        }
        this.facade.openGlobalSearch();
    }

    /**
     * The lit tab clicked again: its URL is already the current one, so the
     * router does nothing. A detail the tab's page opened in place (a title
     * over Mi lista) closes, back to the tab's own page.
     */
    onTabReselected(): void {
        if (this.topBarPage().isTabRoot && this.topBarBack()) {
            this.facade.goBack();
        }
    }

    /**
     * The bar floats over the scroller rather than inside it: a wheel over
     * its capsule or circles still scrolls the page below.
     */
    onTopBarWheel(event: WheelEvent): void {
        const content = this.workspaceContent()?.nativeElement;
        if (
            !content ||
            this.topBarPage().layout !== 'scroll' ||
            event.ctrlKey ||
            Math.abs(event.deltaY) <= Math.abs(event.deltaX)
        ) {
            return;
        }
        const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE;
        content.scrollBy({ top: lines ? event.deltaY * 16 : event.deltaY });
    }

    // Typed Event, not KeyboardEvent: Angular types a key-filtered host
    // listener's $event as Event, and only preventDefault is needed here.
    @HostListener('document:keydown.escape', ['$event'])
    onEscapePressed(event: Event): void {
        if (event.defaultPrevented || !this.contextDrawer.isOpen()) {
            return;
        }

        // Consume the event: this listener registers before any routed
        // content's, and downstream Escape consumers (the portal detail
        // shell's inline player, the shared controls shortcuts) check
        // defaultPrevented — without this, one keypress would close both
        // the drawer and the obscured playback surface behind it.
        event.preventDefault();
        this.contextDrawer.close();
    }

    /** Ctrl/Cmd+F (Electron): the bar's search, else the search page. */
    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(event: KeyboardEvent): void {
        if (
            event.defaultPrevented ||
            !this.facade.isElectron ||
            !isFindShortcut(event) ||
            // The open drawer is modal: Ctrl/Cmd+F would search behind it
            // (the bar is inert, so the shortcut would act on obscured UI).
            this.contextDrawer.isOpen()
        ) {
            return;
        }

        const topBar = this.topBar();
        const target = event.target;
        if (isEditableTarget(target) && !topBar?.containsSearchInput(target)) {
            return;
        }

        event.preventDefault();
        // A page that filters itself (a list, Ajustes) keeps the search
        // here; elsewhere find opens the search page.
        if (!topBar?.focusSearch({ select: true })) {
            this.openSearchPage();
        }
    }

    private focusPageSearchField(): void {
        const field = this.workspaceContent()?.nativeElement.querySelector<
            HTMLInputElement
        >('input[type="search"], input');
        field?.focus();
        field?.select();
    }
}

function isFindShortcut(event: KeyboardEvent): boolean {
    return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    if (target.isContentEditable) {
        return true;
    }

    const tagName = target.tagName.toLowerCase();
    return (
        tagName === 'input' || tagName === 'textarea' || tagName === 'select'
    );
}
