import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
    afterNextRender,
    Component,
    effect,
    ElementRef,
    HostListener,
    inject,
    Injector,
    untracked,
    viewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterOutlet } from '@angular/router';
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
import { WorkspaceShellHeaderComponent } from './components/workspace-shell-header/workspace-shell-header.component';
import { WorkspaceShellImportOverlayComponent } from './components/workspace-shell-import-overlay/workspace-shell-import-overlay.component';
import { WorkspaceShellSidebarComponent } from './components/workspace-shell-sidebar/workspace-shell-sidebar.component';
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
import { WorkspaceNavSidebarService } from './services/workspace-nav-sidebar.service';
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
        MatIcon,
        MatIconButton,
        MatTooltip,
        NowPlayingBarComponent,
        TranslatePipe,
        PlaylistDropOverlayComponent,
        PlaylistDropZoneDirective,
        RouterOutlet,
        TrafficLightsClearanceDirective,
        WorkspaceShellContextSidebarComponent,
        WorkspaceShellHeaderComponent,
        WorkspaceShellImportOverlayComponent,
        WorkspaceShellServerBannerComponent,
        WorkspaceShellSidebarComponent,
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
    /** The main navigation, hideable to browse with the whole window. */
    readonly navSidebar = inject(WorkspaceNavSidebarService);
    private readonly injector = inject(Injector);
    private readonly mpvOverlayVisibility = inject(
        EmbeddedMpvOverlayVisibilityService
    );
    private readonly header =
        viewChild<WorkspaceShellHeaderShortcutTarget>('workspaceHeader');
    private readonly sidebar =
        viewChild<WorkspaceShellSidebarComponent>('workspaceSidebar');
    private readonly sidebarHost = viewChild('workspaceSidebar', {
        read: ElementRef<HTMLElement>,
    });
    private readonly navSidebarShow = viewChild('navSidebarShow', {
        read: ElementRef<HTMLElement>,
    });
    private readonly workspaceContent =
        viewChild<ElementRef<HTMLElement>>('workspaceContent');

    constructor() {
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
                // Deferred: the header is inert while the drawer is open,
                // and focus() on a still-inert element is silently ignored.
                // The timeout runs after the render that removes `inert`.
                setTimeout(() => {
                    if (this.header()?.focusContextDrawerToggle()) {
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

        // Hiding the sidebar inerts the control that hid it, and showing it
        // removes the one that showed it: focus moves to the other control
        // so keyboard users stay where they acted.
        let wasCollapsed = this.navSidebar.collapsed();
        effect(() => {
            const collapsed = this.navSidebar.collapsed();
            if (collapsed !== wasCollapsed) {
                wasCollapsed = collapsed;
                afterNextRender(() => this.moveNavSidebarFocus(collapsed), {
                    injector: this.injector,
                });
            }
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

    // One listener per event: Angular keeps only the last @HostListener
    // declared for the same one.
    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(event: KeyboardEvent): void {
        if (this.handleNavSidebarShortcut(event)) {
            return;
        }
        if (
            event.defaultPrevented ||
            !this.facade.isElectron ||
            !isFindShortcut(event) ||
            // The open drawer is modal: Ctrl/Cmd+F would navigate to global
            // search behind it (the search input it focuses is inside the
            // inert header, so the shortcut would act on obscured UI).
            this.contextDrawer.isOpen()
        ) {
            return;
        }

        const header = this.header();
        const sidebar = this.sidebar();
        const target = event.target;
        if (
            isEditableTarget(target) &&
            !header?.containsSearchInput(target) &&
            !sidebar?.containsSearchInput(target)
        ) {
            return;
        }

        event.preventDefault();
        // On settings the header search already searches the settings, so
        // find stays on the page instead of leaving for global search.
        if (!this.facade.isSettingsRoute()) {
            this.facade.openGlobalSearch(this.facade.searchQuery());
        }
        // The sidebar's field is the visible one on wide windows; folded to
        // icons it hides and the header's copy takes the shortcut.
        setTimeout(() => {
            if (!sidebar?.focusSearchInput({ select: true })) {
                header?.focusSearchInput({ select: true });
            }
        });
    }

    /** ⌃⌘S on macOS, Ctrl+Alt+S elsewhere; not while typing. */
    private handleNavSidebarShortcut(event: KeyboardEvent): boolean {
        if (
            event.defaultPrevented ||
            event.repeat ||
            !this.navSidebar.isShortcut(event) ||
            isEditableTarget(event.target) ||
            this.navSidebar.isPhone() ||
            this.contextDrawer.isOpen() ||
            this.nowPlaying.expanded()
        ) {
            return false;
        }
        event.preventDefault();
        this.navSidebar.toggle();
        return true;
    }

    private moveNavSidebarFocus(collapsed: boolean): void {
        const active = document.activeElement;
        const lost = !active || active === document.body;
        if (collapsed) {
            if (lost || this.sidebarHost()?.nativeElement.contains(active)) {
                this.navSidebarShow()?.nativeElement.focus();
            }
        } else if (lost) {
            this.sidebar()?.focusHideButton();
        }
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

interface WorkspaceShellHeaderShortcutTarget {
    containsSearchInput(target: EventTarget | null): boolean;
    focusSearchInput(options?: { select?: boolean }): void;
    focusContextDrawerToggle(): boolean;
}
