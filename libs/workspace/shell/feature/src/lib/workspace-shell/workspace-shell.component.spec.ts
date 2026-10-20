import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
    Component,
    Directive,
    input,
    output,
    signal,
    ChangeDetectionStrategy,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { EmbeddedMpvOverlayVisibilityService } from '@iptvnator/ui/playback';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import {
    WorkspaceShellContextDrawerService,
    WorkspacePortalContext,
    WorkspaceShellContextPanel,
} from '@iptvnator/workspace/shell/util';
import { LayoutSlideDirective } from './layout-slide.directive';
import type { WorkspaceTopBarPage } from './components/workspace-shell-top-bar/workspace-top-bar-nav';
import { TrafficLightsClearanceDirective } from './traffic-lights-clearance.directive';
import { WorkspaceShellComponent } from './workspace-shell.component';
import { WorkspaceShellFacade } from './services/workspace-shell.facade';
import { WorkspaceKeyboardShortcutsService } from '../workspace-keyboard-shortcuts/workspace-keyboard-shortcuts.service';

@Component({
    selector: 'app-workspace-shell-server-banner',
    template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
})
class MockWorkspaceShellServerBannerComponent {}

@Component({
    selector: 'app-workspace-shell-top-bar',
    template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
})
class MockWorkspaceShellTopBarComponent {
    readonly page = input<WorkspaceTopBarPage | null>(null);
    readonly activeTab = input<string | null>(null);
    readonly back = input<unknown>(null);
    readonly headerShortcut = input<unknown>(null);
    readonly headerSidebarToggle = input<unknown>(null);
    readonly showContextDrawerToggle = input(false);
    readonly isContextDrawerOpen = input(false);
    readonly contextDrawerToggleAriaKey = input('');
    readonly contextDrawerTooltipKey = input('');
    readonly searchMode = input('page');
    readonly searchQuery = input('');
    readonly searchPlaceholder = input('');
    readonly parentalLockState = input<'off' | 'locked' | 'unlocked'>('off');
    readonly activeDownloadsCount = input(0);
    readonly playlistTitle = input('');
    readonly playlistSubtitle = input('');
    readonly backRequested = output<void>();
    readonly sportsHubRequested = output<void>();
    readonly activeTabReselected = output<void>();
    readonly contextDrawerToggleRequested = output<void>();
    readonly headerShortcutRequested = output<void>();
    readonly headerSidebarToggleRequested = output<void>();
    readonly searchChanged = output<string>();
    readonly searchSubmitted = output<string>();
    readonly searchPageRequested = output<void>();
    readonly downloadsRequested = output<void>();
    readonly parentalLockToggleRequested = output<void>();
    readonly addPlaylistRequested = output<void>();
    readonly accountInfoForPlaylistRequested = output<unknown>();
    readonly densityChange = output<string>();
    focusSearch = jest.fn(() => false);
    containsSearchInput = jest.fn(() => false);
    focusContextDrawerToggle = jest.fn(() => true);
}

@Component({
    selector: 'app-workspace-shell-context-sidebar',
    template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
})
class MockWorkspaceShellContextSidebarComponent {
    readonly variant = input<WorkspaceShellContextPanel>('none');
    readonly context = input<WorkspacePortalContext | null>(null);
    readonly section = input<string | null>(null);
    readonly hasPlaylists = input(false);
}

@Component({
    selector: 'app-external-playback-dock',
    template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
})
class MockExternalPlaybackDockComponent {
    readonly session = input<unknown>(null);
    readonly closeClicked = output<void>();
    readonly dismissClicked = output<void>();
}

@Component({
    selector: 'app-playlist-drop-overlay',
    template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
})
class MockPlaylistDropOverlayComponent {
    readonly state = input<unknown>({ kind: 'idle' });
}

@Directive({
    selector: '[appPlaylistDropZone]',
    exportAs: 'playlistDropZone',
    standalone: true,
})
class MockPlaylistDropZoneDirective {
    readonly overlayState = signal({ kind: 'idle' });
}

@Component({
    selector: 'app-workspace-shell-import-overlay',
    template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
})
class MockWorkspaceShellImportOverlayComponent {}

class MockWorkspaceKeyboardShortcutsService {
    openShortcutsDialog = jest.fn();
}

class MockWorkspaceShellFacade {
    readonly currentUrl = signal('/workspace/xtreams/p1/vod');
    readonly searchCapability = signal({
        enabled: true,
        behavior: 'local-filter',
    });
    readonly backTarget = signal<unknown>(null);
    readonly pageBackTarget = signal<unknown>(null);
    goBack = jest.fn();
    goUpToSportsHub = jest.fn();
    readonly workspaceLinks = signal([]);
    readonly primaryContextLinks = signal([]);
    readonly secondaryContextLinks = signal([]);
    readonly currentSection = signal<string | null>(null);
    readonly railProviderClass = signal('rail-context-region');
    readonly railContext = signal<WorkspacePortalContext | null>(null);
    readonly isDashboardRoute = signal(false);
    readonly isSettingsRoute = signal(false);
    readonly playlistTitle = signal('Playlist A');
    readonly playlistSubtitle = signal('Subtitle');
    readonly canOpenPlaylistInfo = signal(true);
    readonly canOpenAccountInfo = signal(true);
    readonly searchQuery = signal('');
    readonly canUseSearch = signal(true);
    readonly searchPlaceholder = signal(
        'WORKSPACE.SHELL.SEARCH_PLAYLIST_PLACEHOLDER'
    );
    readonly searchScopeLabel = signal('Movies / All Items');
    readonly searchStatusLabel = signal('');
    readonly headerShortcut = signal(null);
    readonly canRefreshPlaylist = signal(false);
    readonly hasNoPlaylists = signal(false);
    readonly isDownloadsView = signal(false);
    readonly activeDownloadsCount = signal(3);
    readonly headerSidebarToggle = signal(null);
    toggleLiveSidebar = jest.fn();
    readonly parentalLockState = signal<'off' | 'locked' | 'unlocked'>('off');
    toggleParentalLock = jest.fn();
    readonly showContextPanel = signal(true);
    readonly hasContextPanelContent = signal(true);
    readonly contextDrawerLabelKeys = signal({
        aria: 'WORKSPACE.SHELL.CONTEXT_DRAWER_CATEGORIES_TOGGLE',
        tooltip: 'WORKSPACE.SHELL.CONTEXT_DRAWER_CATEGORIES_TOOLTIP',
    });
    readonly contextPanel = signal<WorkspaceShellContextPanel>('category');
    readonly currentContext = signal<WorkspacePortalContext | null>(null);
    readonly showExternalPlaybackBar = signal(true);
    readonly externalPlaybackSession = signal({ id: 'session-1' });
    readonly showXtreamImportOverlay = signal(false);
    readonly xtreamImportCount = signal(0);
    readonly xtreamItemsToImport = signal(0);
    readonly xtreamActiveImportCount = signal(0);
    readonly xtreamActiveItemsToImport = signal(0);
    readonly xtreamImportTitleLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_TITLE'
    );
    readonly xtreamImportSourceLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_REMOTE_BADGE'
    );
    readonly xtreamImportPhaseLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_LOADING'
    );
    readonly xtreamImportDetailLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_DETAIL_REMOTE'
    );
    readonly xtreamImportProgressLabel = signal('');
    readonly xtreamImportPhaseTone = signal<'remote' | 'local' | null>(
        'remote'
    );
    readonly canCancelXtreamImport = signal(false);
    readonly isCancellingXtreamImport = signal(false);
    readonly isMacOS = true;
    readonly isElectron = true;

    onSearchInput = jest.fn();
    onSearchEnter = jest.fn();
    openCommandPalette = jest.fn();
    openGlobalSearch = jest.fn();
    openAddPlaylistDialog = jest.fn();
    runHeaderShortcut = jest.fn();
    refreshCurrentPlaylist = jest.fn();
    openDownloadsShortcut = jest.fn();
    openPlaylistInfo = jest.fn();
    openAccountInfo = jest.fn();
    openAccountInfoFor = jest.fn();
    closeActiveExternalSession = jest.fn();
    dismissActiveExternalSession = jest.fn();
    cancelXtreamImport = jest.fn();
}


async function createShell(facade = new MockWorkspaceShellFacade()) {
    await TestBed.configureTestingModule({
        imports: [WorkspaceShellComponent],
        providers: [
            provideRouter([]),
            {
                provide: TranslateService,
                useValue: {
                    instant: (key: string) => key,
                    get: (key: string) => of(key),
                    stream: (key: string) => of(key),
                    onLangChange: new Subject(),
                    onTranslationChange: new Subject(),
                    onDefaultLangChange: new Subject(),
                    currentLang: 'en',
                    defaultLang: 'en',
                },
            },
        ],
    })
        .overrideComponent(WorkspaceShellComponent, {
            set: {
                imports: [
                    CdkTrapFocus,
                    RouterOutlet,
                    TranslatePipe,
                    MockExternalPlaybackDockComponent,
                    MockPlaylistDropOverlayComponent,
                    MockPlaylistDropZoneDirective,
                    MockWorkspaceShellContextSidebarComponent,
                    MockWorkspaceShellImportOverlayComponent,
                    MockWorkspaceShellServerBannerComponent,
                    MockWorkspaceShellTopBarComponent,
                    TrafficLightsClearanceDirective,
                    LayoutSlideDirective,
                ],
                providers: [
                    {
                        provide: WorkspaceShellFacade,
                        useValue: facade,
                    },
                    {
                        provide: WorkspaceKeyboardShortcutsService,
                        useClass: MockWorkspaceKeyboardShortcutsService,
                    },
                    {
                        provide: EmbeddedMpvOverlayVisibilityService,
                        useValue: {
                            acquireExternalModalSurface: () => () => undefined,
                        },
                    },
                    WorkspaceShellContextDrawerService,
                ],
            },
        })
        .compileComponents();

    const fixture = TestBed.createComponent(WorkspaceShellComponent);
    fixture.detectChanges();
    const topBar = () =>
        fixture.debugElement.query(
            By.directive(MockWorkspaceShellTopBarComponent)
        ).componentInstance as MockWorkspaceShellTopBarComponent;
    return { facade, fixture, topBar };
}

const findChord = () =>
    new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true,
        cancelable: true,
    });

describe('WorkspaceShellComponent', () => {
    afterEach(() => jest.useRealTimers());

    it('renders the top bar over the window, with no sidebar left', async () => {
        const { facade, fixture, topBar } = await createShell();
        const host = fixture.nativeElement as HTMLElement;

        expect(host.querySelector('app-workspace-shell-top-bar')).not.toBeNull();
        expect(host.querySelector('app-workspace-shell-sidebar')).toBeNull();
        expect(
            host.querySelector('app-workspace-shell-page-controls')
        ).toBeNull();
        // The source switcher and the downloads badge live in the bar.
        expect(topBar().playlistTitle()).toBe('Playlist A');
        expect(topBar().activeDownloadsCount()).toBe(3);
        // macOS: the bar keeps its leading group clear of the lights.
        const shell = host.querySelector('.workspace-shell') as HTMLElement;
        expect(shell.classList).toContain('has-traffic-lights');
        expect(shell.style.getPropertyValue('--traffic-lights-clear-x')).toMatch(
            /px$/
        );
        expect(
            host.querySelector('app-workspace-shell-context-sidebar')
        ).not.toBeNull();
        const externalDock = fixture.debugElement.query(
            By.directive(MockExternalPlaybackDockComponent)
        ).componentInstance as MockExternalPlaybackDockComponent;
        externalDock.dismissClicked.emit();
        expect(facade.dismissActiveExternalSession).toHaveBeenCalledTimes(1);
    });

    it('frames the portal pages below the bar and scrolls the redesigned ones under it', async () => {
        const { facade, fixture } = await createShell();
        const shell = (fixture.nativeElement as HTMLElement).querySelector(
            '.workspace-shell'
        ) as HTMLElement;
        const spacer = () =>
            (fixture.nativeElement as HTMLElement).querySelector(
                'main.workspace-content > .workspace-topbar-spacer'
            );

        expect(shell.classList).toContain('is-framed');
        expect(spacer()).not.toBeNull();

        facade.currentUrl.set('/workspace/dashboard');
        fixture.detectChanges();
        expect(shell.classList).not.toContain('is-framed');
        // The page starts below the bar's room, first in the scroller.
        expect(spacer()?.nextElementSibling?.tagName).toBe('ROUTER-OUTLET');
    });

    it('lights the tab a deep page was opened from and hides Back on tab pages', async () => {
        const { facade, fixture, topBar } = await createShell();
        const back = { label: signal(null), escapeShortcut: signal(false) };
        facade.backTarget.set(back);

        facade.currentUrl.set('/workspace/series');
        fixture.detectChanges();
        expect(topBar().activeTab()).toBe('series');
        expect(topBar().back()).toBeNull();

        facade.currentUrl.set('/workspace/xtreams/p1/vod/1/2');
        fixture.detectChanges();
        expect(topBar().activeTab()).toBe('series');
        expect(topBar().back()).toBe(back);

        // A league page has "‹ Deportes" instead of Back.
        facade.currentUrl.set('/workspace/sports/laliga');
        fixture.detectChanges();
        expect(topBar().activeTab()).toBe('sports');
        expect(topBar().back()).toBeNull();
        expect(topBar().page()?.isLeague).toBe(true);
    });

    it('shows Back on a tab page for a detail it opened in place', async () => {
        const { facade, fixture, topBar } = await createShell();
        const history = { label: signal(null), escapeShortcut: signal(false) };
        const detail = { label: signal(null), escapeShortcut: signal(true) };
        facade.backTarget.set(history);
        facade.currentUrl.set('/workspace/global-favorites');
        fixture.detectChanges();
        // Mi lista itself: the bar is the way out, history Back is not shown.
        expect(topBar().back()).toBeNull();

        // A title opened over Mi lista keeps its URL: only its Back leaves.
        facade.pageBackTarget.set(detail);
        facade.backTarget.set(detail);
        fixture.detectChanges();
        expect(topBar().back()).toBe(detail);

        // The lit tab clicked again closes the detail too.
        topBar().activeTabReselected.emit();
        expect(facade.goBack).toHaveBeenCalledTimes(1);

        // Ajustes registers Back for Escape only: the bar shows none.
        facade.currentUrl.set('/workspace/settings/general');
        fixture.detectChanges();
        expect(topBar().back()).toBeNull();
        topBar().activeTabReselected.emit();
        expect(facade.goBack).toHaveBeenCalledTimes(1);
    });

    it('scrolls a tab\'s own page back to its top when its lit tab is clicked again', async () => {
        const { facade, fixture, topBar } = await createShell();
        const content = (fixture.nativeElement as HTMLElement).querySelector(
            'main.workspace-content'
        ) as HTMLElement;
        const scrollTo = jest.fn();
        content.scrollTo = scrollTo;
        facade.currentUrl.set('/workspace/series');
        fixture.detectChanges();

        content.scrollTop = 900;
        topBar().activeTabReselected.emit();

        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        expect(facade.goBack).not.toHaveBeenCalled();

        // Already at its top, or on a deep page, it stays where it is.
        scrollTo.mockClear();
        content.scrollTop = 0;
        topBar().activeTabReselected.emit();
        facade.currentUrl.set('/workspace/xtreams/p1/vod/1/2');
        fixture.detectChanges();
        content.scrollTop = 400;
        topBar().activeTabReselected.emit();
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('makes room for the bar\'s second row when it takes two', async () => {
        const { fixture, topBar } = await createShell();
        const shell = (fixture.nativeElement as HTMLElement).querySelector(
            '.workspace-shell'
        ) as HTMLElement;
        expect(shell.classList).not.toContain('has-stacked-bar');

        topBar().densityChange.emit('stacked');
        fixture.detectChanges();
        expect(shell.classList).toContain('has-stacked-bar');

        topBar().densityChange.emit('compact');
        fixture.detectChanges();
        expect(shell.classList).not.toContain('has-stacked-bar');
    });

    it('goes up to the sports hub from a league page', async () => {
        const { facade, topBar } = await createShell();

        topBar().sportsHubRequested.emit();

        expect(facade.goUpToSportsHub).toHaveBeenCalledTimes(1);
    });

    it('shades the bar while the page scrolls under it, not at its top', async () => {
        const { facade, fixture } = await createShell();
        const host = fixture.nativeElement as HTMLElement;
        facade.currentUrl.set('/workspace/series');
        fixture.detectChanges();
        await fixture.whenStable();
        const scrim = host.querySelector('.workspace-top-scrim') as HTMLElement;
        const content = host.querySelector('main.workspace-content') as HTMLElement;
        expect(scrim.getAttribute('aria-hidden')).toBe('true');
        expect(scrim.classList).not.toContain('is-shown');

        content.scrollTop = 240;
        content.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(scrim.classList).toContain('is-shown');

        content.scrollTop = 0;
        content.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(scrim.classList).not.toContain('is-shown');
    });

    it('shades the bar over a page that scrolls itself, and not once it is gone', async () => {
        const { fixture } = await createShell();
        const host = fixture.nativeElement as HTMLElement;
        await fixture.whenStable();
        const scrim = host.querySelector('.workspace-top-scrim') as HTMLElement;
        const content = host.querySelector('main.workspace-content') as HTMLElement;
        // jsdom lays nothing out: the page's own scroller fills the content.
        const page = document.createElement('div');
        content.appendChild(page);
        Object.defineProperty(page, 'clientHeight', { value: 800 });
        Object.defineProperty(content, 'clientHeight', { value: 800 });
        const rail = document.createElement('div');
        page.appendChild(rail);
        Object.defineProperty(rail, 'clientHeight', { value: 200 });

        page.scrollTop = 300;
        page.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(scrim.classList).toContain('is-shown');

        // A rail scrolling sideways is not the page.
        rail.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(scrim.classList).toContain('is-shown');

        // The page leaves (a navigation): its scroll no longer counts.
        page.remove();
        content.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(scrim.classList).not.toContain('is-shown');
    });

    it('filters a page that searches itself and opens search elsewhere', async () => {
        const { facade, fixture, topBar } = await createShell();
        expect(topBar().searchMode()).toBe('inline');

        facade.searchCapability.set({
            enabled: true,
            behavior: 'advanced-only',
        });
        fixture.detectChanges();
        expect(topBar().searchMode()).toBe('page');

        // The search page has its own field.
        facade.searchCapability.set({
            enabled: true,
            behavior: 'remote-search',
        });
        facade.currentUrl.set('/workspace/search');
        fixture.detectChanges();
        expect(topBar().searchMode()).toBe('page');

        facade.currentUrl.set('/workspace/dashboard');
        fixture.detectChanges();
        topBar().searchPageRequested.emit();
        expect(facade.openGlobalSearch).toHaveBeenCalledTimes(1);
    });

    it('runs the bar\'s actions through the facade', async () => {
        const { facade, topBar } = await createShell();
        const playlist = { _id: 'p1' };

        topBar().backRequested.emit();
        topBar().searchChanged.emit('news');
        topBar().searchSubmitted.emit('news');
        topBar().addPlaylistRequested.emit();
        topBar().accountInfoForPlaylistRequested.emit(playlist);
        topBar().parentalLockToggleRequested.emit();
        topBar().downloadsRequested.emit();

        expect(facade.goBack).toHaveBeenCalledTimes(1);
        expect(facade.onSearchInput).toHaveBeenCalledWith('news');
        expect(facade.onSearchEnter).toHaveBeenCalledWith('news');
        expect(facade.openAddPlaylistDialog).toHaveBeenCalledTimes(1);
        expect(facade.openAccountInfoFor).toHaveBeenCalledWith(playlist);
        expect(facade.toggleParentalLock).toHaveBeenCalledTimes(1);
        expect(facade.openDownloadsShortcut).toHaveBeenCalledTimes(1);
    });

    it('renders the xtream import overlay only while the facade asks', async () => {
        const { facade, fixture } = await createShell();
        const overlay = () =>
            fixture.nativeElement.querySelector(
                'app-workspace-shell-import-overlay'
            );

        expect(overlay()).toBeNull();
        facade.showXtreamImportOverlay.set(true);
        fixture.detectChanges();
        expect(overlay()).not.toBeNull();
    });

    it('sends Ctrl/Cmd+F to the bar\'s search, else to the search page', async () => {
        const { facade, topBar } = await createShell();

        // A page that filters itself keeps find in the bar.
        topBar().focusSearch.mockReturnValueOnce(true);
        const inline = findChord();
        document.dispatchEvent(inline);
        expect(inline.defaultPrevented).toBe(true);
        expect(topBar().focusSearch).toHaveBeenCalledWith({ select: true });
        expect(facade.openGlobalSearch).not.toHaveBeenCalled();

        // Elsewhere it opens the search page.
        const elsewhere = findChord();
        document.dispatchEvent(elsewhere);
        expect(elsewhere.defaultPrevented).toBe(true);
        expect(facade.openGlobalSearch).toHaveBeenCalledTimes(1);

        // Typing in another field, find stays the field's…
        const field = document.createElement('input');
        document.body.appendChild(field);
        const typed = findChord();
        field.dispatchEvent(typed);
        expect(typed.defaultPrevented).toBe(false);
        // …but from the bar's own field it selects the query again.
        topBar().containsSearchInput.mockReturnValueOnce(true);
        topBar().focusSearch.mockReturnValueOnce(true);
        const fromBar = findChord();
        field.dispatchEvent(fromBar);
        field.remove();
        expect(fromBar.defaultPrevented).toBe(true);
        expect(facade.openGlobalSearch).toHaveBeenCalledTimes(1);
    });

    it('opens and closes the context drawer via the toggle, backdrop and Escape', async () => {
        jest.useFakeTimers();
        const { facade, fixture, topBar } = await createShell();
        const host = fixture.nativeElement as HTMLElement;
        const sidebar = () =>
            host.querySelector(
                'app-workspace-shell-context-sidebar'
            ) as HTMLElement;
        const backdrop = () =>
            host.querySelector(
                '[data-test-id="context-drawer-backdrop"]'
            ) as HTMLElement | null;

        // Closed by default: no backdrop, no drawer-open class.
        expect(backdrop()).toBeNull();
        expect(sidebar().classList.contains('drawer-open')).toBe(false);
        expect(topBar().showContextDrawerToggle()).toBe(true);

        topBar().contextDrawerToggleRequested.emit();
        fixture.detectChanges();
        expect(sidebar().classList.contains('drawer-open')).toBe(true);
        expect(topBar().isContextDrawerOpen()).toBe(true);
        // Assistive technology must hear a named modal surface open —
        // dialog semantics exist only while the drawer is open.
        expect(sidebar().getAttribute('role')).toBe('dialog');
        expect(sidebar().getAttribute('aria-modal')).toBe('true');
        expect(sidebar().getAttribute('aria-label')).toBe(
            'WORKSPACE.SHELL.CONTEXT_DRAWER_CATEGORIES_TOOLTIP'
        );
        // The open drawer is modal: everything behind the backdrop leaves
        // the focus order and the accessibility tree via `inert`.
        expect(
            host.querySelector('.workspace-content')?.hasAttribute('inert')
        ).toBe(true);
        expect(
            host
                .querySelector('app-workspace-shell-top-bar')
                ?.hasAttribute('inert')
        ).toBe(true);

        backdrop()?.click();
        fixture.detectChanges();
        expect(backdrop()).toBeNull();
        expect(sidebar().classList.contains('drawer-open')).toBe(false);
        expect(sidebar().getAttribute('role')).toBeNull();
        expect(sidebar().getAttribute('aria-modal')).toBeNull();
        expect(
            host.querySelector('.workspace-content')?.hasAttribute('inert')
        ).toBe(false);
        // Closing hands focus back to the toggle: the closed drawer is
        // visibility: hidden, so focus left inside it would drop to <body>.
        jest.runOnlyPendingTimers();
        expect(topBar().focusContextDrawerToggle).toHaveBeenCalled();

        topBar().contextDrawerToggleRequested.emit();
        fixture.detectChanges();
        const escapeWhileOpen = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(escapeWhileOpen);
        fixture.detectChanges();
        expect(sidebar().classList.contains('drawer-open')).toBe(false);
        // Consumed, so downstream Escape handlers (inline player close,
        // controls shortcuts) skip it.
        expect(escapeWhileOpen.defaultPrevented).toBe(true);

        // With the drawer closed the shell leaves Escape alone.
        const escapeWhileClosed = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(escapeWhileClosed);
        expect(escapeWhileClosed.defaultPrevented).toBe(false);

        // Ctrl/Cmd+F must not search while the drawer is modal: it would act
        // on the obscured, inert background.
        topBar().contextDrawerToggleRequested.emit();
        fixture.detectChanges();
        document.dispatchEvent(findChord());
        jest.runOnlyPendingTimers();
        expect(facade.openGlobalSearch).not.toHaveBeenCalled();
        expect(topBar().focusSearch).not.toHaveBeenCalled();
    });
});
