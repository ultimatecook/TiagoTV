import { DestroyRef } from '@angular/core';
import {
    Event as RouterEvent,
    NavigationEnd,
    NavigationStart,
    Router,
} from '@angular/router';
import { Subject } from 'rxjs';
import { followWorkspaceScroll } from './workspace-scroll-memory';

describe('followWorkspaceScroll', () => {
    let events: Subject<RouterEvent>;
    let scroller: HTMLElement;
    let destroy: () => void;
    let nextId = 1;

    /** One navigation: a push, or a traversal back to `restoredId`. */
    const navigate = (url: string, restoredId?: number) => {
        const id = nextId++;
        events.next(
            new NavigationStart(
                id,
                url,
                restoredId === undefined ? 'imperative' : 'popstate',
                restoredId === undefined
                    ? null
                    : { navigationId: restoredId }
            )
        );
        events.next(new NavigationEnd(id, url, url));
        return id;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        events = new Subject<RouterEvent>();
        scroller = document.createElement('main');
        // jsdom lays nothing out: let every position stick.
        let top = 0;
        Object.defineProperty(scroller, 'scrollTop', {
            configurable: true,
            get: () => top,
            set: (value: number) => (top = value),
        });
        document.body.appendChild(scroller);
        const callbacks: (() => void)[] = [];
        destroy = () => callbacks.forEach((callback) => callback());
        followWorkspaceScroll(
            { url: '/workspace/dashboard', events } as unknown as Router,
            () => scroller,
            { onDestroy: (callback: () => void) => callbacks.push(callback) } as
                unknown as DestroyRef
        );
    });

    afterEach(() => {
        destroy();
        scroller.remove();
        jest.useRealTimers();
    });

    it('starts every new page at the top', () => {
        scroller.scrollTop = 640;
        navigate('/workspace/series');
        expect(scroller.scrollTop).toBe(0);
    });

    it('keeps the position when only the query changes', () => {
        navigate('/workspace/settings/general');
        scroller.scrollTop = 300;
        navigate('/workspace/settings/general?q=epg');
        expect(scroller.scrollTop).toBe(300);
    });

    it('returns to where a page was left on history Back', () => {
        navigate('/workspace/sports');
        const dashboard = navigate('/workspace/dashboard');
        scroller.scrollTop = 900;
        navigate('/workspace/xtreams/p1/vod/1/2');
        expect(scroller.scrollTop).toBe(0);

        navigate('/workspace/dashboard', dashboard);
        expect(scroller.scrollTop).toBe(0);
        jest.advanceTimersByTime(50);
        expect(scroller.scrollTop).toBe(900);
    });
});
