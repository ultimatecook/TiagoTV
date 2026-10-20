import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, DestroyRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import {
    readWorkspaceTopBarPage,
    WorkspaceTopBarPage,
    WorkspaceTopBarTabId,
} from './components/workspace-shell-top-bar/workspace-top-bar-nav';
import { WorkspaceTopBarTabMemory } from './workspace-top-bar-tab-memory';

@Component({ template: '' })
class PageComponent {}

const SERIES_TITLE = '/workspace/xtreams/p1/series/4/9001';

describe('WorkspaceTopBarTabMemory', () => {
    let router: Router;
    let location: Location;
    /** The lit tab, as the shell resolves it after each navigation. */
    let lit: WorkspaceTopBarTabId | null;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideLocationMocks(),
                provideRouter([{ path: '**', component: PageComponent }]),
            ],
        });
        router = TestBed.inject(Router);
        location = TestBed.inject(Location);
        // Listens to the location's popstate, as the app's bootstrap does.
        router.initialNavigation();
        const memory = TestBed.runInInjectionContext(
            () => new WorkspaceTopBarTabMemory(router, inject(DestroyRef))
        );
        // The shell's linkedSignal: the page left and its tab feed the next.
        let page: WorkspaceTopBarPage | null = null;
        lit = null;
        router.events
            .pipe(filter((event) => event instanceof NavigationEnd))
            .subscribe((event) => {
                const next = readWorkspaceTopBarPage(event.urlAfterRedirects);
                lit = memory.resolve(next, page && { page, tab: lit });
                page = next;
                memory.remember(lit);
            });
    });

    afterEach(() => TestBed.resetTestingModule());

    const nextEnd = () =>
        firstValueFrom(
            router.events.pipe(filter((event) => event instanceof NavigationEnd))
        );
    const back = async () => {
        const end = nextEnd();
        location.back();
        await end;
    };
    const forward = async () => {
        const end = nextEnd();
        location.forward();
        await end;
    };

    it('lights on Back and Forward the tab each entry lit, not the one left', async () => {
        await router.navigateByUrl('/workspace/series');
        await router.navigateByUrl(SERIES_TITLE);
        expect(lit).toBe('series');
        await router.navigateByUrl('/workspace/movies');
        expect(lit).toBe('movies');

        // Back to the title Series opened: still Series, not Películas.
        await back();
        expect(location.path()).toBe(SERIES_TITLE);
        expect(lit).toBe('series');

        await back();
        expect(lit).toBe('series');

        await forward();
        expect(lit).toBe('series');
        await forward();
        expect(lit).toBe('movies');
    });

    it('keeps the tab of an entry visited again through history', async () => {
        await router.navigateByUrl('/workspace/dashboard');
        await router.navigateByUrl(SERIES_TITLE);
        expect(lit).toBe('home');
        await router.navigateByUrl('/workspace/countries');
        await back();
        expect(lit).toBe('home');
        await forward();
        await back();
        expect(lit).toBe('home');
    });

    it('resolves a fresh navigation from the page it leaves', async () => {
        await router.navigateByUrl('/workspace/global-favorites');
        await router.navigateByUrl('/workspace/xtreams/p1/live');
        // A channel list lights En vivo, whatever opened it.
        expect(lit).toBe('live');
        await router.navigateByUrl('/workspace/sources');
        expect(lit).toBeNull();
    });
});
