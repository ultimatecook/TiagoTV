import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    ActivatedRoute,
    NavigationEnd,
    NavigationStart,
    Router,
} from '@angular/router';
import {
    WorkspaceBackNavigationService,
    type WorkspaceBackParent,
} from '@iptvnator/portal/shared/data-access';
import type { WorkspaceBackTarget } from '@iptvnator/portal/shared/util';
import { Subject } from 'rxjs';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { PlatformThemeService } from '../platform-theme.service';
import { PlatformPageComponent } from './platform-page.component';

describe('PlatformPageComponent — a row shown whole', () => {
    const events = new Subject<unknown>();
    const router = { events, navigate: jest.fn() };
    const route = {};
    const targets: WorkspaceBackTarget[] = [];
    const backNavigation = {
        back: jest.fn<void, [() => WorkspaceBackParent]>(),
        register: jest.fn((target: WorkspaceBackTarget) => {
            targets.push(target);
            return () => targets.splice(targets.indexOf(target), 1);
        }),
    };

    function create() {
        TestBed.configureTestingModule({
            providers: [
                { provide: Router, useValue: router },
                { provide: ActivatedRoute, useValue: route },
                {
                    provide: WorkspaceBackNavigationService,
                    useValue: backNavigation,
                },
                {
                    provide: PlatformsCatalogService,
                    useValue: {
                        titlesOf: () => [],
                        loadTitles: jest.fn().mockResolvedValue(undefined),
                        failed: signal(false),
                    },
                },
                { provide: PlatformThemeService, useValue: { start: jest.fn() } },
            ],
        }).overrideComponent(PlatformPageComponent, {
            set: { template: '', imports: [] },
        });
        const fixture = TestBed.createComponent(PlatformPageComponent);
        fixture.componentRef.setInput('platformId', 'prime-video');
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        targets.length = 0;
        jest.clearAllMocks();
    });

    it('opens the row as a history entry of its own (?row=)', () => {
        const page = create().componentInstance;

        page.openAll('new');

        expect(router.navigate).toHaveBeenCalledWith([], {
            relativeTo: route,
            queryParams: { row: 'new' },
        });
        expect(router.navigate.mock.calls[0][1].replaceUrl).toBeUndefined();
    });

    it('shows the row the URL names, and offers Back while it is open', () => {
        const fixture = create();
        expect(fixture.componentInstance.openRowId()).toBeNull();
        expect(targets).toHaveLength(0);

        fixture.componentRef.setInput('row', 'new');
        fixture.detectChanges();

        expect(fixture.componentInstance.openRowId()).toBe('new');
        expect(targets).toHaveLength(1);
        // Back: history Back, or the rows when the row opened the session.
        targets[0].run();
        expect(backNavigation.back).toHaveBeenCalledTimes(1);
        expect(backNavigation.back.mock.calls[0][0]()).toEqual([
            '/workspace',
            'platforms',
            'prime-video',
        ]);

        fixture.componentRef.setInput('row', undefined);
        fixture.detectChanges();
        expect(targets).toHaveLength(0);
    });

    it('returns each view to its scroll on Back and Forward', async () => {
        const fixture = create();
        const main = document.createElement('main');
        document.body.append(main);
        main.append(fixture.nativeElement);
        const settle = () => new Promise((done) => setTimeout(done, 60));

        // The rows, scrolled; "See more" pushes the row (navigation 2).
        events.next(new NavigationEnd(1, '/p', '/p'));
        main.scrollTop = 420;
        events.next(new NavigationStart(2, '/p?row=new'));
        events.next(new NavigationEnd(2, '/p?row=new', '/p?row=new'));
        main.scrollTop = 650;

        // Back to the rows (the entry navigation 1 wrote).
        events.next(
            new NavigationStart(3, '/p', 'popstate', { navigationId: 1 })
        );
        events.next(new NavigationEnd(3, '/p', '/p'));
        await settle();
        expect(main.scrollTop).toBe(420);

        // Forward to the row again.
        events.next(
            new NavigationStart(4, '/p?row=new', 'popstate', {
                navigationId: 2,
            })
        );
        events.next(new NavigationEnd(4, '/p?row=new', '/p?row=new'));
        await settle();
        expect(main.scrollTop).toBe(650);

        fixture.destroy();
        main.remove();
    });
});
