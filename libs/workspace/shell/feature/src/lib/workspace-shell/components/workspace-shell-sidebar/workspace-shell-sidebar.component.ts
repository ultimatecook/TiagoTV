import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    Injector,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PlaylistSwitcherComponent } from '@iptvnator/playlist/shared/ui';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import type { WorkspacePortalContext } from '@iptvnator/workspace/shell/util';
import { WorkspaceNavSidebarService } from '../../services/workspace-nav-sidebar.service';
import { WorkspaceShellSidebarIconComponent } from './workspace-shell-sidebar-icon.component';
import { buildWorkspaceSidebarNav } from './workspace-shell-sidebar-nav';
import { WorkspaceShellSidebarSectionComponent } from './workspace-shell-sidebar-section.component';
import { WorkspaceSidebarCatalogService } from './workspace-sidebar-catalog.service';

/** Folded: the search opens beside its icon. */
const SEARCH_FLYOUT_POSITIONS = [
    {
        originX: 'end' as const,
        originY: 'center' as const,
        overlayX: 'start' as const,
        overlayY: 'center' as const,
        offsetX: 10,
    },
    {
        originX: 'start' as const,
        originY: 'bottom' as const,
        overlayX: 'start' as const,
        overlayY: 'top' as const,
        offsetY: 8,
    },
];

/**
 * The TiagoTV glass sidebar, the app's only chrome above the content:
 * greeting, search, the main links, the collapsible Plataformas, Deportes,
 * Canales en vivo and Guardados sections, and at the bottom the source
 * switcher and Ajustes. Folded to icons (≤1100px), the search and the
 * sections open as flyouts beside the rail.
 */
@Component({
    selector: 'app-workspace-shell-sidebar',
    imports: [
        CdkConnectedOverlay,
        CdkOverlayOrigin,
        MatIcon,
        MatTooltip,
        PlaylistSwitcherComponent,
        RouterLink,
        RouterLinkActive,
        TranslatePipe,
        WorkspaceShellSidebarIconComponent,
        WorkspaceShellSidebarSectionComponent,
    ],
    templateUrl: './workspace-shell-sidebar.component.html',
    styleUrl: './workspace-shell-sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellSidebarComponent {
    private readonly injector = inject(Injector);
    private readonly searchInput =
        viewChild<ElementRef<HTMLInputElement>>('searchInput');
    private readonly flyoutSearchInput =
        viewChild<ElementRef<HTMLInputElement>>('flyoutSearchInput');
    private readonly hideButton =
        viewChild<ElementRef<HTMLButtonElement>>('hideButton');
    readonly navSidebar = inject(WorkspaceNavSidebarService);
    readonly catalog = inject(WorkspaceSidebarCatalogService);

    /** The active source the catalog entries browse; null without one. */
    readonly context = input<WorkspacePortalContext | null>(null);
    readonly searchQuery = input('');
    readonly canUseSearch = input(false);
    readonly searchPlaceholder = input('');
    readonly hasNoPlaylists = input(false);
    /** Settings searches its own rows, also before the first source. */
    readonly isSettingsRoute = input(false);
    readonly activeDownloadsCount = input(0);
    readonly playlistTitle = input('');
    readonly playlistSubtitle = input('');
    readonly parentalLockState = input<'off' | 'locked' | 'unlocked'>('off');

    readonly searchChanged = output<string>();
    readonly searchSubmitted = output<string>();
    readonly commandPaletteRequested = output<void>();
    readonly addPlaylistRequested = output<void>();
    readonly accountInfoForPlaylistRequested = output<PlaylistMeta>();
    readonly parentalLockToggleRequested = output<void>();

    readonly isMac =
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    readonly commandShortcutLabel = this.isMac ? '⌘K' : 'Ctrl+K';
    readonly searchPositions = SEARCH_FLYOUT_POSITIONS;
    readonly searchOpen = signal(false);

    readonly nav = computed(() => buildWorkspaceSidebarNav(this.context()));
    readonly showSearch = computed(
        () => !this.hasNoPlaylists() || this.isSettingsRoute()
    );
    readonly downloadBadges = computed(() => ({
        downloads: this.activeDownloadsCount(),
    }));
    /** Platforms load with the source; until then a short status line. */
    readonly platformsEmptyKey = computed(() => {
        if (!this.catalog.hasSource()) {
            return 'WORKSPACE.SIDEBAR.NO_SOURCE';
        }
        return this.catalog.platforms() === null
            ? 'WORKSPACE.SIDEBAR.LOADING'
            : 'WORKSPACE.SIDEBAR.NO_PLATFORMS';
    });

    onSearchInput(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchChanged.emit(target?.value ?? '');
    }

    onSearchEnter(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchSubmitted.emit(target?.value ?? this.searchQuery());
    }

    toggleSearch(): void {
        if (this.searchOpen()) {
            this.searchOpen.set(false);
        } else {
            this.openSearchFlyout();
        }
    }

    closeSearch(): void {
        this.searchOpen.set(false);
    }

    onSearchFlyoutKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeSearch();
        }
    }

    openCommandPalette(): void {
        this.closeSearch();
        this.commandPaletteRequested.emit();
    }

    /**
     * Focuses the search: the field on a wide window, the flyout's when the
     * sidebar is folded to icons. Reports whether the search will hold the
     * focus (false while it is unavailable or the sidebar is hidden).
     */
    focusSearchInput(options: { select?: boolean } = {}): boolean {
        const inline = this.searchInput()?.nativeElement;
        if (inline && !inline.disabled && inline.offsetParent !== null) {
            focusInput(inline, options);
            return document.activeElement === inline;
        }
        if (
            !this.showSearch() ||
            !this.canUseSearch() ||
            !this.navSidebar.isFolded() ||
            this.navSidebar.collapsed()
        ) {
            return false;
        }
        this.openSearchFlyout(options);
        return true;
    }

    /** Back on the hide control once the sidebar shows again. */
    focusHideButton(): void {
        this.hideButton()?.nativeElement.focus();
    }

    containsSearchInput(target: EventTarget | null): boolean {
        return (
            !!target &&
            (target === this.searchInput()?.nativeElement ||
                target === this.flyoutSearchInput()?.nativeElement)
        );
    }

    private openSearchFlyout(options: { select?: boolean } = {}): void {
        this.searchOpen.set(true);
        afterNextRender(
            () => {
                const field = this.flyoutSearchInput()?.nativeElement;
                if (field && !field.disabled) {
                    focusInput(field, options);
                }
            },
            { injector: this.injector }
        );
    }
}

function focusInput(
    field: HTMLInputElement,
    options: { select?: boolean }
): void {
    field.focus();
    if (options.select) {
        field.select();
    }
}
