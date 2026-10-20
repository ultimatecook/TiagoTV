import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { rememberPageChoice } from './page-memory';
import {
    RememberScrollDirective,
    SCROLL_REST_MS,
} from './remember-scroll.directive';

@Component({
    imports: [RememberScrollDirective],
    template: `<div class="row" [libRememberScroll]="key()"></div>`,
})
class RowHost {
    readonly key = signal('catalog-row-drama');
}

describe('RememberScrollDirective', () => {
    // jsdom lays nothing out: every row scrolls up to 1500px.
    const lefts = new WeakMap<Element, number>();
    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
            configurable: true,
            get(this: Element) {
                return lefts.get(this) ?? 0;
            },
            set(this: Element, value: number) {
                lefts.set(this, Math.max(0, Math.min(value, 1500)));
            },
        });
    });
    afterAll(() => {
        delete (HTMLElement.prototype as { scrollLeft?: number }).scrollLeft;
    });

    afterEach(() => {
        jest.useRealTimers();
        history.replaceState(null, '');
    });

    function render(key = 'catalog-row-drama') {
        TestBed.resetTestingModule();
        const fixture = TestBed.createComponent(RowHost);
        fixture.componentInstance.key.set(key);
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('.row') as HTMLElement;
    }

    it('keeps the row’s scroll on the history entry once it rests', () => {
        jest.useFakeTimers();
        const row = render();

        row.scrollLeft = 800;
        row.dispatchEvent(new Event('scroll'));
        expect(history.state?.tvPageMemory).toBeUndefined();
        jest.advanceTimersByTime(SCROLL_REST_MS);

        expect(history.state.tvPageMemory).toEqual({
            'scroll:catalog-row-drama': 800,
        });
    });

    it('scrolls the row back when the entry comes back', () => {
        rememberPageChoice('scroll:catalog-row-drama', 800);

        expect(render().scrollLeft).toBe(800);
        // Another row, or a new entry, starts at its beginning.
        expect(render('catalog-row-comedy').scrollLeft).toBe(0);
    });

    it('remembers nothing without a key', () => {
        jest.useFakeTimers();
        const row = render('');

        row.scrollLeft = 300;
        row.dispatchEvent(new Event('scroll'));
        jest.advanceTimersByTime(SCROLL_REST_MS);

        expect(history.state?.tvPageMemory).toBeUndefined();
    });
});
