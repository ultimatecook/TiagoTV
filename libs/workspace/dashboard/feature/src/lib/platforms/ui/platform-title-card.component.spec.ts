import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { platformDesign, tileDress, type TileDress } from '../platform-design';
import type { PlatformTitle } from '../platform-titles';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { PlatformTitleCardComponent } from './platform-title-card.component';

const SHOW: PlatformTitle = {
    id: 7,
    kind: 'series',
    categoryId: '1',
    title: 'DARK',
    poster: 'http://img/dark-poster.jpg',
    language: 'ES',
    added: 1000,
    genres: ['drama'],
    rating: 8.4,
    plot: 'Un niño desaparece en Winden.',
    backdrop: 'http://img/dark-backdrop.jpg',
    tmdb: 70523,
    year: 2017,
    versions: [{ id: 7, categoryId: '1', language: 'ES', title: 'DARK' }],
};

describe('PlatformTitleCardComponent', () => {
    const catalog = { extrasOf: jest.fn(() => null), open: jest.fn() };

    const render = (look: string, dress?: TileDress) => {
        TestBed.configureTestingModule({
            imports: [PlatformTitleCardComponent, TranslateModule.forRoot()],
            providers: [
                { provide: PlatformsCatalogService, useValue: catalog },
            ],
        });
        const fixture = TestBed.createComponent(PlatformTitleCardComponent);
        fixture.componentRef.setInput('title', SHOW);
        fixture.componentRef.setInput('look', look);
        if (dress) {
            fixture.componentRef.setInput('dress', dress);
        }
        fixture.detectChanges();
        const host = fixture.nativeElement as HTMLElement;
        const text = (selector: string) =>
            host.querySelector(selector)?.textContent?.trim() ?? null;
        return { host, text };
    };

    afterEach(() => {
        TestBed.resetTestingModule();
        jest.clearAllMocks();
    });

    it('draws a poster with its name under it by default', () => {
        const { host, text } = render('default');

        expect(host.querySelector('img')?.getAttribute('src')).toBe(
            SHOW.poster
        );
        expect(host.querySelector('img')?.getAttribute('loading')).toBe('lazy');
        expect(text('.card__name')).toBe('DARK');
        expect(host.querySelector('.card__caption')).toBeNull();
        expect(host.querySelector('.card__info')).toBeNull();
    });

    it("opens Netflix's facts on a 16:9 tile, its name on the art", () => {
        const { host, text } = render(
            'netflix',
            tileDress(platformDesign('netflix'), 'series')
        );

        expect(host.dataset['tile']).toBe('landscape');
        expect(host.querySelector('img')?.getAttribute('src')).toBe(
            SHOW.backdrop
        );
        expect(text('.card__caption-name')).toBe('DARK');
        expect(host.querySelector('.card__name')).toBeNull();
        // The facts are drawn for the eye; the button's label reads the name.
        const info = host.querySelector('.card__info');
        expect(info?.getAttribute('aria-hidden')).toBe('true');
        expect(text('.card__match')).toBe('WORKSPACE.DASHBOARD.MATCH');
        expect(text('.card__facts')).toContain('2017');
        expect(text('.card__plot')).toBe(SHOW.plot);
        expect(host.querySelector('button')?.getAttribute('aria-label')).toBe(
            'DARK'
        );
    });

    it("rates the title with a star outside Netflix's look", () => {
        const { text } = render(
            'prime',
            tileDress(platformDesign('prime-video'), 'movies')
        );

        expect(text('.card__rating')).toBe('★ 8.4');
    });

    it("writes Hulu's large tiles' name and kind on the artwork", () => {
        const { host, text } = render(
            'hulu',
            tileDress(platformDesign('hulu'), 'series')
        );

        expect(host.dataset['size']).toBe('large');
        expect(text('.card__caption-name')).toBe('DARK');
        expect(text('.card__caption .card__sub')).toContain(
            'WORKSPACE.DASHBOARD.TYPE_SERIES'
        );
        expect(host.querySelector('.card__name')).toBeNull();
        expect(host.querySelector('.card__info')).toBeNull();
    });

    // The catalog stub has no loaders: a tile that fetched would throw.
    it('opens the title, fetching nothing', () => {
        const { host } = render(
            'hbo',
            tileDress(platformDesign('hbo-max'), 'movies')
        );

        host.querySelector('button')?.click();

        expect(catalog.open).toHaveBeenCalledWith(SHOW);
    });
});
