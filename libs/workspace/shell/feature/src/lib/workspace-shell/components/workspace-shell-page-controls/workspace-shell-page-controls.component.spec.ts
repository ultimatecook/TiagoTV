import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import {
    WorkspaceBackPhoneSlot,
    WorkspaceBackTarget,
} from '@iptvnator/portal/shared/util';
import { WorkspaceNavSidebarService } from '../../services/workspace-nav-sidebar.service';
import { WorkspaceShellPageControlsComponent } from './workspace-shell-page-controls.component';

describe('WorkspaceShellPageControlsComponent', () => {
    let fixture: ComponentFixture<WorkspaceShellPageControlsComponent>;
    let component: WorkspaceShellPageControlsComponent;
    const query = <T extends Element = HTMLButtonElement>(selector: string) =>
        fixture.nativeElement.querySelector(selector) as T | null;

    beforeEach(async () => {
        localStorage.clear();
        await TestBed.configureTestingModule({
            imports: [
                WorkspaceShellPageControlsComponent,
                NoopAnimationsModule,
            ],
            providers: [
                {
                    provide: TranslateService,
                    useValue: {
                        instant: (key: string) => key,
                        get: (key: string) => of(key),
                        stream: (key: string) => of(key),
                        onLangChange: of(null),
                        onTranslationChange: of(null),
                        onDefaultLangChange: of(null),
                        currentLang: 'en',
                        defaultLang: 'en',
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(WorkspaceShellPageControlsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => localStorage.clear());

    it('renders no control while the page offers none', () => {
        expect(query('button')).toBeNull();
    });

    it('emits the page shortcut and reflects its pressed state', () => {
        const requested = jest.fn();
        component.headerShortcutRequested.subscribe(requested);
        fixture.componentRef.setInput('headerShortcut', {
            id: 'guide',
            icon: 'view_timeline',
            tooltipKey: 'shortcut.tooltip',
            ariaLabelKey: 'shortcut.aria',
            active: () => true,
            run: () => undefined,
        });
        fixture.detectChanges();

        const button = query('button[aria-label="shortcut.aria"]');
        expect(button?.getAttribute('aria-pressed')).toBe('true');
        button?.click();

        expect(requested).toHaveBeenCalledTimes(1);
    });

    it('keeps the live rail toggle in both rail states', () => {
        const requested = jest.fn();
        component.headerSidebarToggleRequested.subscribe(requested);
        fixture.componentRef.setInput('headerSidebarToggle', {
            expanded: true,
            tooltip: 'LAYOUT.TOGGLE_SIDEBAR_TOOLTIP',
            ariaLabel: 'LAYOUT.HIDE_CHANNELS_LIST',
        });
        fixture.detectChanges();

        const button = query('[data-test-id="header-sidebar-toggle"]');
        expect(button?.getAttribute('aria-pressed')).toBe('true');
        button?.click();
        expect(requested).toHaveBeenCalledTimes(1);

        fixture.componentRef.setInput('headerSidebarToggle', {
            expanded: false,
            tooltip: 'LAYOUT.TOGGLE_SIDEBAR_TOOLTIP',
            ariaLabel: 'LAYOUT.SHOW_CHANNELS_LIST',
        });
        fixture.detectChanges();

        expect(query('[data-test-id="header-sidebar-toggle"]')).toBe(button);
        expect(button?.getAttribute('aria-label')).toBe(
            'LAYOUT.SHOW_CHANNELS_LIST'
        );
        expect(button?.classList).toContain('is-active');
    });

    it('leaves the hidden sidebar to the pull tab', () => {
        TestBed.inject(WorkspaceNavSidebarService).hide();
        fixture.detectChanges();

        expect(query('[data-test-id="nav-sidebar-show"]')).toBeNull();
        expect(query('button')).toBeNull();
    });

    describe('phone drawer toggle', () => {
        const toggle = () => query('[data-test-id="context-drawer-toggle"]');

        it('emits requests, carries the drawer state and its variant label', () => {
            const requested = jest.fn();
            component.contextDrawerToggleRequested.subscribe(requested);
            fixture.componentRef.setInput('showContextDrawerToggle', true);
            fixture.componentRef.setInput('isContextDrawerOpen', true);
            fixture.componentRef.setInput(
                'contextDrawerToggleAriaKey',
                'WORKSPACE.SHELL.CONTEXT_DRAWER_SETTINGS_TOGGLE'
            );
            fixture.detectChanges();

            expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
            expect(toggle()?.getAttribute('aria-label')).toBe(
                'WORKSPACE.SHELL.CONTEXT_DRAWER_SETTINGS_TOGGLE'
            );
            toggle()?.click();
            expect(requested).toHaveBeenCalledTimes(1);
        });

        it('takes focus back after the drawer closes', () => {
            expect(component.focusContextDrawerToggle()).toBe(false);

            fixture.componentRef.setInput('showContextDrawerToggle', true);
            fixture.detectChanges();

            expect(component.focusContextDrawerToggle()).toBe(true);
            expect(document.activeElement).toBe(toggle());
        });
    });

    describe('page Back', () => {
        const backButton = () =>
            query('[data-test-id="workspace-header-back"]');
        const drawerToggle = () =>
            query('[data-test-id="context-drawer-toggle"]');

        function setBackTarget(
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
            fixture.componentRef.setInput('backTarget', target);
            fixture.detectChanges();
            return target;
        }

        it('emits Back requests, and stays off the Home', () => {
            const requested = jest.fn();
            component.backRequested.subscribe(requested);
            setBackTarget('Back to Downloads', true);

            backButton()?.click();
            expect(requested).toHaveBeenCalledTimes(1);

            fixture.componentRef.setInput('hideBack', true);
            fixture.detectChanges();
            expect(backButton()).toBeNull();
        });

        it('names the page Back and announces Escape only while it applies', () => {
            setBackTarget('Back to Downloads', true);
            expect(backButton()?.getAttribute('aria-label')).toBe(
                'Back to Downloads'
            );
            expect(backButton()?.getAttribute('aria-keyshortcuts')).toBe(
                'Escape'
            );

            setBackTarget(null, false);
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

            setBackTarget(null, true);
            press({ repeat: true });
            press({ shiftKey: true });
            expect(requested).not.toHaveBeenCalled();
            expect(press().defaultPrevented).toBe(true);
            expect(requested).toHaveBeenCalledTimes(1);

            setBackTarget(null, false);
            expect(press().defaultPrevented).toBe(false);
            expect(requested).toHaveBeenCalledTimes(1);
        });

        it('takes the drawer toggle slot while the page offers Back', () => {
            fixture.componentRef.setInput('showContextDrawerToggle', true);
            setBackTarget(null, true);
            expect(drawerToggle()).toBeNull();

            fixture.componentRef.setInput('backTarget', null);
            fixture.detectChanges();
            expect(backButton()).toBeNull();
            expect(drawerToggle()).not.toBeNull();
        });

        it('keeps the drawer toggle after Back for a page whose sections live in the drawer', () => {
            fixture.componentRef.setInput('showContextDrawerToggle', true);
            setBackTarget(null, false, 'beside');

            expect(backButton()?.nextElementSibling).toBe(drawerToggle());
            expect(backButton()?.classList).not.toContain(
                'header-back--yields'
            );
        });

        it('lets the history fallback yield to the drawer toggle at phone width', () => {
            fixture.componentRef.setInput('showContextDrawerToggle', true);
            setBackTarget(null, false, 'yield');
            expect(drawerToggle()).not.toBeNull();
            expect(backButton()?.classList).toContain('header-back--yields');

            fixture.componentRef.setInput('showContextDrawerToggle', false);
            fixture.detectChanges();
            expect(backButton()?.classList).not.toContain(
                'header-back--yields'
            );
        });
    });

    it('hides a yielding Back only in the phone layout', () => {
        const styleSource = readFileSync(
            join(__dirname, 'workspace-shell-page-controls.component.scss'),
            'utf8'
        );
        const phoneStart = styleSource.indexOf('@media (max-width: 640px)');

        expect(styleSource.indexOf('.header-back--yields')).toBeGreaterThan(
            phoneStart
        );
        expect(styleSource.slice(phoneStart)).toMatch(
            /\.header-back--yields\s*\{\s*display:\s*none;/
        );
    });
});
