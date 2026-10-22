import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { buildCountriesTv } from '../countries-catalog';
import type { CountryChannelGroup } from '../country-channels';
import { countryCards, type TvCard } from '../country-tv-categories';
import { CountryTvFavorites } from '../country-tv-favorites';
import { CountryTvListings, type TvNow } from '../country-tv-listings';
import { OVERSCAN } from '../country-tv-window';
import { CountryTvCardsComponent, hueOf } from './country-tv-cards.component';

const [US] = buildCountriesTv(
    [{ category_id: 1, category_name: '|US| ✪ ENTERTAINMENT' }],
    Array.from({ length: 300 }, (_, index) => ({
        stream_id: 1000 + index,
        category_id: 1,
        name: `|US| Station ${index}`,
        stream_icon: index === 1 ? 'station-1.png' : null,
    })),
    new Date('2026-10-18T18:00:00Z')
);
const CARDS = countryCards(US, 'all');

describe('CountryTvCardsComponent', () => {
    let fixture: ComponentFixture<CountryTvCardsComponent>;
    const listings = {
        nowOn: (channel: CountryChannelGroup): TvNow | null =>
            channel.title === 'Station 2'
                ? {
                      title: 'Premier League · Leeds – Arsenal',
                      progress: 40,
                      football: true,
                  }
                : null,
    };

    async function render(playing: number | null = null, on = true) {
        TestBed.configureTestingModule({
            imports: [CountryTvCardsComponent, TranslateModule.forRoot()],
            providers: [
                { provide: CountryTvListings, useValue: listings },
                {
                    provide: CountryTvFavorites,
                    useValue: {
                        isSaved: (channel: CountryChannelGroup) =>
                            channel.title === 'Station 5',
                    },
                },
            ],
        });
        fixture = TestBed.createComponent(CountryTvCardsComponent);
        fixture.componentRef.setInput('cards', CARDS);
        fixture.componentRef.setInput('playingStreamId', playing);
        fixture.componentRef.setInput('playing', on);
        fixture.componentRef.setInput('label', 'Channels');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    const element = () => fixture.nativeElement as HTMLElement;
    const rendered = () =>
        Array.from(element().querySelectorAll<HTMLElement>('[data-card]'));
    const card = (index: number) =>
        element().querySelector<HTMLElement>(`[data-card="${index}"]`);
    const press = (target: HTMLElement, key: string) =>
        target.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true })
        );
    const settle = async () => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };

    it('renders the cards near its view only, holding the others’ room', async () => {
        await render();
        expect(CARDS.length).toBe(300);
        expect(rendered().length).toBe(9 + OVERSCAN);
        const track = element().querySelector<HTMLElement>('.cards__track');
        expect(track?.style.getPropertyValue('--after')).toBe(
            `${(300 - 9 - OVERSCAN) * 212}px`
        );
    });

    it('shows a logo or the name, what plays now and the football tag', async () => {
        await render(1000);
        expect(card(0)?.getAttribute('aria-current')).toBe('true');
        expect(card(0)?.textContent).toContain('WORKSPACE.COUNTRIES.PLAYING');
        expect(card(1)?.querySelector('img')?.getAttribute('src')).toBe(
            'station-1.png'
        );
        expect(card(0)?.querySelector('.card__word')?.textContent).toBe(
            'Station 0'
        );
        expect(card(2)?.textContent).toContain(
            'Premier League · Leeds – Arsenal'
        );
        expect(
            card(2)?.querySelector('[data-test-id="countries-football"]')
        ).not.toBeNull();
        expect(card(3)?.querySelector('.card__tag')).toBeNull();
        // No programme known: the row's name, and no progress bar.
        expect(card(3)?.querySelector('.card__bar--unknown')).not.toBeNull();
    });

    it('marks the picked card as playing only while it plays', async () => {
        await render(1000, false);
        expect(card(0)?.getAttribute('aria-current')).not.toBe('true');
        expect(card(0)?.textContent).not.toContain(
            'WORKSPACE.COUNTRIES.PLAYING'
        );
        // The row's tab stop still rests on the picked card.
        expect(card(0)?.getAttribute('tabindex')).toBe('0');
    });

    it('plays a card on a click', async () => {
        await render();
        const picked: TvCard[] = [];
        fixture.componentInstance.picked.subscribe((entry) =>
            picked.push(entry)
        );
        card(4)?.click();
        expect(picked[0]?.channel.title).toBe('Station 4');
    });

    it('puts a card’s channel on Mi lista from its heart, or with L', async () => {
        await render();
        const toggled: TvCard[] = [];
        fixture.componentInstance.favoriteToggled.subscribe((entry) =>
            toggled.push(entry)
        );
        const heart = (streamId: number) =>
            element().querySelector<HTMLButtonElement>(
                `[data-test-id="country-tv-card-fav-${streamId}"]`
            );
        expect(heart(1005)?.getAttribute('aria-pressed')).toBe('true');
        expect(heart(1005)?.closest('.slot')?.classList).toContain(
            'slot--saved'
        );
        expect(heart(1004)?.getAttribute('aria-pressed')).toBe('false');
        expect(heart(1004)?.getAttribute('aria-label')).toBe(
            'WORKSPACE.MY_LIST.ADD_NAMED'
        );
        // Out of the row's one tab stop.
        expect(heart(1004)?.tabIndex).toBe(-1);

        heart(1004)?.click();
        expect(toggled.map((entry) => entry.channel.title)).toEqual([
            'Station 4',
        ]);

        const key = new KeyboardEvent('keydown', {
            key: 'l',
            bubbles: true,
            cancelable: true,
        });
        card(6)?.dispatchEvent(key);
        expect(key.defaultPrevented).toBe(true);
        expect(toggled.map((entry) => entry.channel.title)).toEqual([
            'Station 4',
            'Station 6',
        ]);
    });

    it('is one tab stop the arrows, Home and End move along', async () => {
        await render(1003);
        expect(
            rendered()
                .filter((entry) => entry.tabIndex === 0)
                .map((entry) => entry.dataset['card'])
        ).toEqual(['3']);

        card(3)?.focus();
        press(card(3) as HTMLElement, 'ArrowRight');
        await settle();
        expect(document.activeElement).toBe(card(4));

        press(card(4) as HTMLElement, 'End');
        await settle();
        // The last card is rendered for it, and takes focus.
        expect(card(299)).not.toBeNull();
        expect(document.activeElement).toBe(card(299));
    });

    it('gives each channel a steady hue', () => {
        expect(hueOf('La 1')).toBe(hueOf('La 1'));
        expect(hueOf('La 1')).toBeGreaterThanOrEqual(0);
        expect(hueOf('La 1')).toBeLessThan(360);
    });
});
