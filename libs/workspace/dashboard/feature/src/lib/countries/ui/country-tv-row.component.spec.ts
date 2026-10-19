import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import type { CountryChannelGroup } from '../country-channels';
import type { TvRow } from '../country-rows';
import {
    CountryTvRowComponent,
    ROW_CAP,
    type RowCrossing,
} from './country-tv-row.component';

function channel(index: number, icons: string[] = []): CountryChannelGroup {
    const title = `Channel ${index}`;
    return {
        key: `channel ${index}|`,
        title,
        subtitle: index === 2 ? 'Premier League' : null,
        icons,
        copies: [
            {
                streamId: 100 + index,
                categoryId: '7',
                title,
                icon: icons[0] ?? null,
                quality: null,
            },
        ],
    };
}

function row(count: number): TvRow {
    return {
        id: 'ar:main',
        tier: 'main',
        label: { key: 'WORKSPACE.COUNTRIES.ROWS.MAIN', text: '' },
        channels: Array.from({ length: count }, (_, index) =>
            channel(index + 1, index === 0 ? ['a.png', 'b.png'] : [])
        ),
    };
}

describe('CountryTvRowComponent', () => {
    let fixture: ComponentFixture<CountryTvRowComponent>;
    // jsdom lays nothing out and has no scrollIntoView.
    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    const tiles = () =>
        Array.from(
            (
                fixture.nativeElement as HTMLElement
            ).querySelectorAll<HTMLElement>('[data-stop]')
        );

    async function render(count: number, playing: number | null = null) {
        TestBed.configureTestingModule({
            imports: [CountryTvRowComponent, TranslateModule.forRoot()],
        });
        fixture = TestBed.createComponent(CountryTvRowComponent);
        fixture.componentRef.setInput('row', row(count));
        fixture.componentRef.setInput('playingStreamId', playing);
        fixture.componentRef.setInput('live', true);
        // Without IntersectionObserver (jsdom) the row is near at once.
        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();
    }

    it('renders a tile per channel once near, the playing one marked', async () => {
        await render(4, 103);

        expect(tiles()).toHaveLength(4);
        const playing = tiles()[2];
        expect(playing.getAttribute('aria-current')).toBe('true');
        expect(playing.querySelector('.tile__live')).not.toBeNull();
        expect(playing.getAttribute('tabindex')).toBe('0');
        expect(tiles()[0].getAttribute('tabindex')).toBe('-1');
        expect(tiles()[1].textContent).toContain('Premier League');
    });

    it('plays a tile’s channel on click', async () => {
        await render(4);
        const picked: CountryChannelGroup[] = [];
        fixture.componentInstance.picked.subscribe((entry) =>
            picked.push(entry)
        );

        tiles()[1].click();

        expect(picked.map((entry) => entry.title)).toEqual(['Channel 2']);
        fixture.detectChanges();
        expect(tiles()[1].getAttribute('tabindex')).toBe('0');
    });

    it('moves along the row with the arrows, Home and End', async () => {
        await render(5);
        tiles()[0].focus();

        const press = (key: string) => {
            const event = new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
            });
            document.activeElement?.dispatchEvent(event);
            fixture.detectChanges();
            return event;
        };

        expect(press('ArrowRight').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(tiles()[1]);
        press('End');
        expect(document.activeElement).toBe(tiles()[4]);
        press('ArrowRight');
        expect(document.activeElement).toBe(tiles()[4]);
        press('Home');
        expect(document.activeElement).toBe(tiles()[0]);
        expect(tiles()[0].getAttribute('tabindex')).toBe('0');
        expect(press('a').defaultPrevented).toBe(false);
    });

    it('hands up and down to the page, from where the tile is', async () => {
        await render(3);
        const crossings: RowCrossing[] = [];
        fixture.componentInstance.crossed.subscribe((crossing) =>
            crossings.push(crossing)
        );
        tiles()[1].focus();

        tiles()[1].dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        );
        tiles()[1].dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
        );

        expect(crossings.map((crossing) => crossing.direction)).toEqual([
            1, -1,
        ]);
    });

    it('ends a long row on "See all", which shows the rest', async () => {
        await render(ROW_CAP + 10);

        expect(tiles()).toHaveLength(ROW_CAP + 1);
        const more = tiles()[ROW_CAP];
        expect(more.textContent).toContain('+10');

        more.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(tiles()).toHaveLength(ROW_CAP + 10);
        expect(document.activeElement).toBe(tiles()[ROW_CAP]);
    });

    it('shows a short-enough row whole', async () => {
        await render(ROW_CAP + 6);
        expect(tiles()).toHaveLength(ROW_CAP + 6);
    });

    it('tries the next logo, then the name, when one fails', async () => {
        await render(1);
        const image = () =>
            tiles()[0].querySelector<HTMLImageElement>('.tile__logo');

        expect(image()?.getAttribute('src')).toBe('a.png');
        image()?.dispatchEvent(new Event('error'));
        fixture.detectChanges();
        expect(image()?.getAttribute('src')).toBe('b.png');
        image()?.dispatchEvent(new Event('error'));
        fixture.detectChanges();
        expect(image()).toBeNull();
        expect(tiles()[0].querySelector('.tile__wordmark')?.textContent).toBe(
            'Channel 1'
        );
    });
});
