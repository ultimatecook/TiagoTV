import { Location } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { NEVER, of } from 'rxjs';
import {
    WORKSPACE_HISTORY_NAVIGATION,
    WorkspaceBackNavigationService,
    WorkspaceHistoryNavigation,
} from '@iptvnator/portal/shared/data-access';
import { WorkspaceStartupPreferencesService } from '@iptvnator/workspace/shell/util';
import { SettingsContextService } from '@iptvnator/workspace/shell/util/settings-context';
import { SettingsRailComponent } from './settings-rail.component';
import { SettingsSection } from './settings.models';

/** Navigation API state of a session that opened on the settings page. */
const firstPageHistory = {
    currentEntry: { index: 0 },
    entries: () => [{ index: 0, sameDocument: true }],
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
} as unknown as WorkspaceHistoryNavigation;

const SECTIONS: SettingsSection[] = [
    {
        id: 'sources',
        label: 'SETTINGS.NAV_SOURCES',
        icon: 'account_circle',
        group: 'account',
        visible: true,
    },
    {
        id: 'general',
        label: 'SETTINGS.NAV_GENERAL',
        icon: 'tune',
        group: 'app',
        visible: true,
    },
    {
        id: 'playback',
        label: 'SETTINGS.NAV_PLAYBACK',
        icon: 'play_circle',
        group: 'app',
        visible: true,
    },
    {
        id: 'backup',
        label: 'SETTINGS.NAV_BACKUP',
        icon: 'backup',
        group: 'data',
        visible: true,
    },
    { id: 'about', label: 'SETTINGS.NAV_ABOUT', icon: 'info', visible: true },
];

@Component({
    imports: [SettingsRailComponent],
    template: `<app-settings-rail
        [sections]="sections"
        [activeSection]="active()"
    />`,
})
class RailHostComponent {
    readonly sections = SECTIONS;
    readonly active = signal('general');
}

describe('SettingsRailComponent', () => {
    const resolveDashboardPath = jest.fn();

    // Without a Navigation API (jsdom's default) history is unknown, so
    // Back stays the browser's.
    function setup(history: WorkspaceHistoryNavigation | null = null) {
        resolveDashboardPath
            .mockReset()
            .mockResolvedValue('/workspace/dashboard');
        TestBed.configureTestingModule({
            imports: [RailHostComponent],
            providers: [
                provideRouter([]),
                { provide: WORKSPACE_HISTORY_NAVIGATION, useValue: history },
                {
                    provide: WorkspaceStartupPreferencesService,
                    useValue: { resolveDashboardPath },
                },
                {
                    provide: TranslateService,
                    useValue: {
                        instant: (key: string) => key,
                        get: (key: string) => of(key),
                        stream: (key: string) => of(key),
                        onLangChange: NEVER,
                        onTranslationChange: NEVER,
                        onDefaultLangChange: NEVER,
                        currentLang: 'en',
                        defaultLang: 'en',
                    },
                },
            ],
        });
        const ctx = TestBed.inject(SettingsContextService);
        const router = TestBed.inject(Router);
        const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
        const fixture = TestBed.createComponent(RailHostComponent);
        fixture.detectChanges();
        const element = fixture.nativeElement as HTMLElement;
        const link = (id: string) =>
            element.querySelector(
                `[data-test-id="settings-section-${id}"]`
            ) as HTMLAnchorElement;
        return { ctx, fixture, element, link, navigate };
    }

    afterEach(() => {
        TestBed.inject(SettingsContextService).reset();
    });

    it('titles the page and groups the sections, About after a separator', () => {
        const { element, link } = setup();

        expect(
            element
                .querySelector('[data-test-id="settings-page-header"]')
                ?.textContent?.trim()
        ).toBe('SETTINGS.TITLE');
        const groups = Array.from(
            element.querySelectorAll('.settings-nav__group')
        ).map((group) => group.getAttribute('data-group'));
        // Empty groups (library, devices) are left out.
        expect(groups).toEqual(['account', 'app', 'data']);
        expect(
            element
                .querySelector('.settings-nav__footer')
                ?.contains(link('about'))
        ).toBe(true);
        expect(
            element
                .querySelector('[data-group="app"]')
                ?.contains(link('playback'))
        ).toBe(true);
    });

    it('links every section page and marks the open one', () => {
        const { fixture, link } = setup();

        expect(link('playback').getAttribute('href')).toBe(
            '/workspace/settings/playback'
        );
        expect(link('general').classList).toContain('active');
        expect(link('general').getAttribute('aria-current')).toBe('page');
        expect(link('playback').getAttribute('aria-current')).toBeNull();

        fixture.componentInstance.active.set('playback');
        fixture.detectChanges();
        expect(link('playback').classList).toContain('active');
        expect(link('general').classList).not.toContain('active');
    });

    it('switches section in place, keeping one history entry', () => {
        const { link, navigate } = setup();

        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
        });
        link('backup').dispatchEvent(click);

        expect(click.defaultPrevented).toBe(true);
        expect(navigate).toHaveBeenCalledWith(
            ['/workspace/settings', 'backup'],
            { replaceUrl: true }
        );
    });

    it('leaves a modified click to the browser', () => {
        const { link, navigate } = setup();

        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
            metaKey: true,
        });
        link('backup').dispatchEvent(click);
        // jsdom does not navigate; the rail just must not take the click.
        expect(navigate).not.toHaveBeenCalled();
    });

    it('shows the version beside About, replaced by a badge once an update waits', () => {
        const { ctx, fixture, link } = setup();

        ctx.setVersion('0.25.0');
        fixture.detectChanges();
        const version = link('about').querySelector(
            '[data-test-id="settings-nav-version"]'
        );
        expect(version?.textContent).toBe('0.25.0');
        // A long nightly string is truncated; the tooltip keeps all of it.
        expect(version?.getAttribute('title')).toBe('0.25.0');
        expect(link('general').querySelector('.nav-item-version')).toBeNull();

        ctx.setUpdateAvailable(true);
        fixture.detectChanges();
        expect(
            link('about').querySelector(
                '[data-test-id="settings-nav-update-badge"]'
            )
        ).not.toBeNull();
        expect(
            link('about').querySelector('[data-test-id="settings-nav-version"]')
        ).toBeNull();
    });

    it('marks pages holding staged edits', () => {
        const { ctx, fixture, link } = setup();

        ctx.setDirtySections(new Set(['playback']));
        fixture.detectChanges();

        expect(
            link('playback').querySelector(
                '[data-test-id="settings-section-dirty-playback"]'
            )
        ).not.toBeNull();
        expect(link('general').querySelector('.nav-item-dot')).toBeNull();
    });

    it('shows per-section match counts and mutes sections without matches', () => {
        const { ctx, fixture, link } = setup();

        expect(link('general').querySelector('.nav-item-meta')).toBeNull();
        expect(link('general').classList).not.toContain('has-no-matches');

        ctx.setMatchCounts({ general: 2 });
        fixture.detectChanges();

        expect(
            link('general').querySelector('.nav-item-meta')?.textContent
        ).toBe('2');
        expect(
            link('playback').querySelector('.nav-item-meta')?.textContent
        ).toBe('0');
        expect(link('general').classList).not.toContain('has-no-matches');
        expect(link('playback').classList).toContain('has-no-matches');
    });

    describe('leaving settings', () => {
        function pressEscape(
            init: KeyboardEventInit = {},
            target?: Element,
            handled = false
        ) {
            const event = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
                cancelable: true,
                ...init,
            });
            // An earlier listener (the shell closing an overlay) consumed it.
            if (handled) event.preventDefault();
            (target ?? document.body).dispatchEvent(event);
            return event;
        }

        it('offers Back, with Esc, while the rail is shown', () => {
            const { fixture } = setup();
            const back = jest
                .spyOn(TestBed.inject(Location), 'back')
                .mockImplementation(() => undefined);
            const backNavigation = TestBed.inject(
                WorkspaceBackNavigationService
            );

            const target = backNavigation.target();
            expect(target?.escapeShortcut()).toBe(true);
            backNavigation.goBack();
            expect(back).toHaveBeenCalledTimes(1);
            expect(resolveDashboardPath).not.toHaveBeenCalled();

            fixture.destroy();
            expect(backNavigation.target()).toBeNull();
        });

        it('leads to the first workspace view when settings opened the session', async () => {
            setup(firstPageHistory);
            const back = jest
                .spyOn(TestBed.inject(Location), 'back')
                .mockImplementation(() => undefined);
            const navigateByUrl = jest
                .spyOn(TestBed.inject(Router), 'navigateByUrl')
                .mockResolvedValue(true);
            resolveDashboardPath.mockResolvedValue('/workspace/sources');

            TestBed.inject(WorkspaceBackNavigationService).goBack();
            await Promise.resolve();
            await Promise.resolve();

            expect(back).not.toHaveBeenCalled();
            expect(navigateByUrl).toHaveBeenCalledWith('/workspace/sources', {
                replaceUrl: true,
            });
        });

        it('leaves settings on Escape', () => {
            setup();
            const back = jest
                .spyOn(TestBed.inject(Location), 'back')
                .mockImplementation(() => undefined);

            const event = pressEscape();

            expect(event.defaultPrevented).toBe(true);
            expect(back).toHaveBeenCalledTimes(1);
        });

        it('yields to handled keys, chords, open overlays and text fields', () => {
            setup();
            const back = jest
                .spyOn(TestBed.inject(Location), 'back')
                .mockImplementation(() => undefined);

            pressEscape({}, undefined, true);
            pressEscape({ shiftKey: true });

            const input = document.createElement('input');
            document.body.appendChild(input);
            pressEscape({}, input);
            input.remove();

            const backdrop = document.createElement('div');
            backdrop.className = 'cdk-overlay-backdrop';
            document.body.appendChild(backdrop);
            pressEscape();
            backdrop.remove();

            expect(back).not.toHaveBeenCalled();
        });
    });
});
