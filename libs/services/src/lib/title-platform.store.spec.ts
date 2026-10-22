import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    publishTitlePlatform,
    TitlePlatformStore,
    type TitlePlatformBrand,
    type TitlePlatformRef,
} from './title-platform.store';

const NETFLIX: TitlePlatformBrand = {
    id: 'netflix',
    name: 'Netflix',
    logo: './assets/platforms/netflix.svg',
    logoTone: 'brand',
    ambient: '#e50914',
};

const movie = (itemId: number): TitlePlatformRef => ({
    playlistId: 'p1',
    kind: 'movie',
    itemId,
    categoryId: '7',
});

const pageRef: WritableSignal<TitlePlatformRef | null> = signal(null);

@Component({ selector: 'lib-test-title-page', template: '' })
class TitlePageComponent {
    constructor() {
        publishTitlePlatform(pageRef);
    }
}

describe('TitlePlatformStore', () => {
    let store: TitlePlatformStore;

    beforeEach(() => {
        pageRef.set(null);
        store = TestBed.inject(TitlePlatformStore);
    });

    it('has no brand without a title or a resolver', () => {
        expect(store.brand()).toBeNull();
        const release = store.show(movie(1));
        expect(store.brand()).toBeNull();
        store.useResolver(() => NETFLIX);
        expect(store.brand()).toBe(NETFLIX);
        release();
        expect(store.brand()).toBeNull();
    });

    it('follows the resolver signals as they load', () => {
        const known = signal(false);
        store.useResolver((ref) =>
            known() && ref.itemId === 1 ? NETFLIX : null
        );
        store.show(movie(1));
        expect(store.brand()).toBeNull();
        known.set(true);
        expect(store.brand()).toBe(NETFLIX);
    });

    it('reads the latest page that shows a title', () => {
        store.useResolver((ref) => (ref.itemId === 2 ? NETFLIX : null));
        const first = store.show(movie(1));
        const second = store.show(movie(2));
        expect(store.title()?.itemId).toBe(2);
        expect(store.brand()).toBe(NETFLIX);
        second();
        expect(store.title()?.itemId).toBe(1);
        first();
        expect(store.title()).toBeNull();
    });

    it('publishes a page title while the page lives', () => {
        const fixture = TestBed.createComponent(TitlePageComponent);
        fixture.detectChanges();
        expect(store.title()).toBeNull();

        pageRef.set(movie(5));
        TestBed.tick();
        expect(store.title()?.itemId).toBe(5);

        pageRef.set(movie(6));
        TestBed.tick();
        expect(store.title()?.itemId).toBe(6);

        fixture.destroy();
        expect(store.title()).toBeNull();
    });
});
