import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { provideRouter, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import {
    WorkspaceBackPhoneSlot,
    WorkspaceBackTarget,
} from '@iptvnator/portal/shared/util';
import { WorkspaceShellTopBarIconComponent } from './workspace-shell-top-bar-icon.component';
import { WorkspaceShellTopBarComponent } from './workspace-shell-top-bar.component';
import { readWorkspaceTopBarPage } from './workspace-top-bar-nav';

@Component({
    selector: 'app-playlist-switcher',
    template: '<button data-test-id="playlist-switcher-trigger"></button>',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPlaylistSwitcherComponent {
    readonly currentTitle = input('');
    readonly subtitle = input('');
    readonly accountInfoForPlaylistRequested = output<unknown>();
    readonly addPlaylistRequested = output<void>();
}

describe('WorkspaceShellTopBarComponent', () => {
    let fixture: ComponentFixture<WorkspaceShellTopBarComponent>;
    let component: WorkspaceShellTopBarComponent;
    const query = <T extends Element = HTMLButtonElement>(selector: string) =>
        fixture.nativeElement.querySelector(selector) as T | null;
    const byTestId = <T extends Element = HTMLButtonElement>(id: string) =>
        query<T>(`[data-test-id="${id}"]`);
    const setPage = (url: string) => {
        fixture.componentRef.setInput('page', readWorkspaceTopBarPage(url));
        fixture.detectChanges();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [WorkspaceShellTopBarComponent],
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
            .overrideComponent(WorkspaceShellTopBarComponent, {
                set: {
                    imports: [
                        MatIcon,
                        MatTooltip,
                        MockPlaylistSwitcherComponent,
                        RouterLink,
                        TranslatePipe,
                        WorkspaceShellTopBarIconComponent,
                    ],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(WorkspaceShellTopBarComponent);
        component = fixture.componentInstance;
        setPage('/workspace/dashboard');
    });

    it('renders the six tabs and marks the lit one as the current page', () => {
        fixture.componentRef.setInput('activeTab', 'series');
        fixture.detectChanges();

        const tabs = Array.from(
            fixture.nativeElement.querySelectorAll('.topbar__tab')
        ) as HTMLAnchorElement[];
        expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
            '/workspace/dashboard',
            '/workspace/sports',
            '/workspace/series',
            '/workspace/movies',
            '/workspace/countries',
            '/workspace/global-favorites',
        ]);
        const current = tabs.filter(
            (tab) => tab.getAttribute('aria-current') === 'page'
        );
        expect(current).toEqual([byTestId('topbar-tab-series')]);
        expect(current[0].classList).toContain('is-active');
    });

    it('keeps Buscar, Ajustes and the source switcher on every page', () => {
        expect(byTestId('topbar-search-button')).not.toBeNull();
        expect(byTestId('topbar-settings')?.getAttribute('href')).toBe(
            '/workspace/settings'
        );
        expect(byTestId('playlist-switcher-trigger')).not.toBeNull();

        setPage('/workspace/settings/general');
        expect(byTestId('topbar-settings')?.getAttribute('aria-current')).toBe(
            'page'
        );
    });

    it('offers "‹ Deportes" back to the hub on a league page only', () => {
        expect(byTestId('topbar-sports-back')).toBeNull();

        setPage('/workspace/sports/laliga');
        expect(byTestId('topbar-sports-back')?.getAttribute('href')).toBe(
            '/workspace/sports'
        );
        expect(byTestId('workspace-header-back')).toBeNull();
    });

    describe('Buscar', () => {
        it('opens the search page where the page does not filter itself', () => {
            const requested = jest.fn();
            component.searchPageRequested.subscribe(requested);

            byTestId('topbar-search-button')?.click();
            fixture.detectChanges();

            expect(requested).toHaveBeenCalledTimes(1);
            expect(byTestId('topbar-search-input')).toBeNull();
            expect(component.focusSearch()).toBe(false);
        });

        it('opens a field that filters the page, Esc clears then closes it', async () => {
            const changed = jest.fn();
            const submitted = jest.fn();
            component.searchChanged.subscribe(changed);
            component.searchSubmitted.subscribe(submitted);
            fixture.componentRef.setInput('searchMode', 'inline');
            fixture.detectChanges();

            byTestId('topbar-search-button')?.click();
            fixture.detectChanges();
            await fixture.whenStable();
            const field = byTestId<HTMLInputElement>('topbar-search-input');
            expect(field).not.toBeNull();
            expect(document.activeElement).toBe(field);
            expect(component.containsSearchInput(field)).toBe(true);

            field!.value = 'dazn';
            field!.dispatchEvent(new Event('input'));
            field!.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter' })
            );
            expect(changed).toHaveBeenLastCalledWith('dazn');
            expect(submitted).toHaveBeenLastCalledWith('dazn');

            // With a query the field stays, so the filter stays visible.
            fixture.componentRef.setInput('searchQuery', 'dazn');
            fixture.detectChanges();
            field!.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
            );
            expect(changed).toHaveBeenLastCalledWith('');
            fixture.componentRef.setInput('searchQuery', '');
            fixture.detectChanges();
            expect(byTestId('topbar-search-input')).not.toBeNull();

            byTestId<HTMLInputElement>('topbar-search-input')!.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
            );
            fixture.detectChanges();
            expect(byTestId('topbar-search-input')).toBeNull();
        });

        it('shows the field while a filter is applied and closes off inline pages', () => {
            fixture.componentRef.setInput('searchMode', 'inline');
            fixture.componentRef.setInput('searchQuery', 'news');
            fixture.detectChanges();
            expect(
                byTestId<HTMLInputElement>('topbar-search-input')?.value
            ).toBe('news');

            fixture.componentRef.setInput('searchMode', 'page');
            fixture.detectChanges();
            expect(byTestId('topbar-search-input')).toBeNull();
        });

        it('stays open as the field replaces the circle, folds when an empty field loses focus', async () => {
            fixture.componentRef.setInput('searchMode', 'inline');
            fixture.detectChanges();
            const button = byTestId('topbar-search-button')!;
            const group = query<HTMLElement>('.topbar__search')!;

            button.click();
            // The circle leaving the DOM blurs it (Chromium fires focusout).
            group.dispatchEvent(
                new FocusEvent('focusout', { bubbles: true })
            );
            fixture.detectChanges();
            await fixture.whenStable();
            const field = byTestId<HTMLInputElement>('topbar-search-input');
            expect(field).not.toBeNull();

            field!.dispatchEvent(
                new FocusEvent('focusout', {
                    bubbles: true,
                    relatedTarget: document.body,
                })
            );
            fixture.detectChanges();
            expect(byTestId('topbar-search-input')).toBeNull();
        });

        it('lights the circle on the search page', () => {
            setPage('/workspace/search');
            expect(
                byTestId('topbar-search-button')?.getAttribute('aria-current')
            ).toBe('page');
        });
    });

    it('emits the page shortcut and the live rail toggle', () => {
        const shortcut = jest.fn();
        const rail = jest.fn();
        component.headerShortcutRequested.subscribe(shortcut);
        component.headerSidebarToggleRequested.subscribe(rail);
        fixture.componentRef.setInput('headerShortcut', {
            id: 'guide',
            icon: 'view_timeline',
            tooltipKey: 'shortcut.tooltip',
            ariaLabelKey: 'shortcut.aria',
            active: () => true,
            run: () => undefined,
        });
        fixture.componentRef.setInput('headerSidebarToggle', {
            expanded: false,
            tooltip: 'LAYOUT.TOGGLE_SIDEBAR_TOOLTIP',
            ariaLabel: 'LAYOUT.SHOW_CHANNELS_LIST',
        });
        fixture.detectChanges();

        const button = byTestId('header-shortcut');
        expect(button?.getAttribute('aria-pressed')).toBe('true');
        button?.click();
        const toggle = byTestId('header-sidebar-toggle');
        expect(toggle?.classList).toContain('is-active');
        toggle?.click();

        expect(shortcut).toHaveBeenCalledTimes(1);
        expect(rail).toHaveBeenCalledTimes(1);
    });

    it('shows the downloads circle and the parental lock only while they apply', () => {
        const lock = jest.fn();
        component.parentalLockToggleRequested.subscribe(lock);
        expect(byTestId('topbar-downloads')).toBeNull();
        expect(byTestId('header-parental-lock')).toBeNull();

        fixture.componentRef.setInput('activeDownloadsCount', 2);
        fixture.componentRef.setInput('parentalLockState', 'locked');
        fixture.detectChanges();

        expect(byTestId('topbar-downloads')?.textContent).toContain('2');
        const lockButton = byTestId('header-parental-lock');
        expect(lockButton?.getAttribute('aria-pressed')).toBe('true');
        lockButton?.click();
        expect(lock).toHaveBeenCalledTimes(1);
    });

    describe('page Back', () => {
        const backButton = () => byTestId('workspace-header-back');
        const drawerToggle = () => byTestId('context-drawer-toggle');

        function setBack(
            label: string | null,
            escapeShortcut: boolean,
            phoneDrawerToggle?: WorkspaceBackPhoneSlot
        ): WorkspaceBackTarget {
            const target: WorkspaceBackTarget = {
                label: signal(label),
                escapeShortcut: signal(escapeShortcut),
                phoneDrawerToggle,
                run: jest.fn(),
            };
            fixture.componentRef.setInput('back', target);
            fixture.detectChanges();
            return target;
        }

        it('emits Back and names it, announcing Escape only while it applies', () => {
            const requested = jest.fn();
            component.backRequested.subscribe(requested);
            setBack('Back to Downloads', true);

            expect(backButton()?.getAttribute('aria-label')).toBe(
                'Back to Downloads'
            );
            expect(backButton()?.getAttribute('aria-keyshortcuts')).toBe(
                'Escape'
            );
            backButton()?.click();
            expect(requested).toHaveBeenCalledTimes(1);

            setBack(null, false);
            expect(backButton()?.getAttribute('aria-label')).toBe('BACK');
            expect(backButton()?.hasAttribute('aria-keyshortcuts')).toBe(false);
        });

        it('runs the advertised Escape from the focused Back only while it applies', () => {
            const requested = jest.fn();
            component.backRequested.subscribe(requested);
            const press = (init: KeyboardEventInit = {}) => {
                const event = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    bubbles: true,
                    cancelable: true,
                    ...init,
                });
                backButton()?.dispatchEvent(event);
                return event;
            };

            setBack(null, true);
            press({ repeat: true });
            press({ shiftKey: true });
            expect(requested).not.toHaveBeenCalled();
            expect(press().defaultPrevented).toBe(true);
            expect(requested).toHaveBeenCalledTimes(1);

            setBack(null, false);
            expect(press().defaultPrevented).toBe(false);
            expect(requested).toHaveBeenCalledTimes(1);
        });

        it('shares the phone slot with the drawer toggle as the page asks', () => {
            const requested = jest.fn();
            component.contextDrawerToggleRequested.subscribe(requested);
            fixture.componentRef.setInput('showContextDrawerToggle', true);
            fixture.componentRef.setInput('isContextDrawerOpen', true);
            fixture.detectChanges();
            expect(drawerToggle()?.getAttribute('aria-expanded')).toBe('true');
            drawerToggle()?.click();
            expect(requested).toHaveBeenCalledTimes(1);
            expect(component.focusContextDrawerToggle()).toBe(true);

            // A detail page's Back replaces the toggle…
            setBack(null, true);
            expect(drawerToggle()).toBeNull();
            expect(component.focusContextDrawerToggle()).toBe(false);

            // …a page whose sections live in the drawer keeps both…
            setBack(null, false, 'beside');
            expect(backButton()?.nextElementSibling).toBe(drawerToggle());
            expect(backButton()?.classList).not.toContain(
                'topbar__back--yields'
            );

            // …and the history fallback yields to the toggle on a phone.
            setBack(null, false, 'yield');
            expect(drawerToggle()).not.toBeNull();
            expect(backButton()?.classList).toContain('topbar__back--yields');
        });
    });
});
