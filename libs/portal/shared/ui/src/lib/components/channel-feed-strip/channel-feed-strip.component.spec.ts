import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslatePipe } from '@ngx-translate/core';
import { MockPipe } from 'ng-mocks';
import {
    channelFeedGroup,
    feedRegionOfCategory,
    type ChannelFeedGroup,
    type FeedCandidate,
} from '@iptvnator/portal/shared/util';
import { ChannelFeedStripComponent } from './channel-feed-strip.component';

let nextId = 1;
function feed(title: string, category: string): FeedCandidate {
    return {
        id: nextId++,
        title,
        icon: `http://logos.example/${nextId}.png`,
        region: feedRegionOfCategory(category),
    };
}

// The real catalog's names: Argentina's ESPN, the US one after it.
const espn = feed('|ARG| ESPN', '|LAT|  ✪ ARGENTINA');
const espn2 = feed('|ARG| ESPN 2', '|LAT|  ✪ ARGENTINA');
const espnPlus = feed('|ARG| ESPN+', '|LAT|  ✪ ARGENTINA');
const espnUs = feed('|US| ESPN USA', '|US| ✪ SPORTS');
const espnUs2 = feed('|US| ESPN 2 ᴴᴰ', '|US| ✪ SPORTS');
const catalog = [espn, espn2, espnPlus, espnUs, espnUs2];

function groupFor(
    current: FeedCandidate,
    candidates: readonly FeedCandidate[] = catalog
): ChannelFeedGroup {
    const group = channelFeedGroup(current, candidates);
    if (!group) {
        throw new Error(`No feeds for ${current.title}`);
    }
    return group;
}

describe('ChannelFeedStripComponent', () => {
    let fixture: ComponentFixture<ChannelFeedStripComponent>;
    let selected: FeedCandidate[];

    const host = (): HTMLElement => fixture.nativeElement;
    const button = (testId: string) =>
        host().querySelector<HTMLButtonElement>(`[data-test-id="${testId}"]`);
    const options = () =>
        Array.from(
            host().querySelectorAll<HTMLButtonElement>('.feeds__option')
        );
    const labels = () =>
        options().map((option) =>
            option.querySelector('.feeds__option-label')?.textContent?.trim()
        );
    const tabStops = () =>
        Array.from(
            host().querySelectorAll<HTMLElement>('[data-feed-stop]')
        ).filter((stop) => stop.getAttribute('tabindex') === '0');
    const press = (target: HTMLElement, key: string) => {
        const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
        });
        target.dispatchEvent(event);
        fixture.detectChanges();
        return event;
    };

    function render(group: ChannelFeedGroup): void {
        fixture.componentRef.setInput('group', group);
        fixture.detectChanges();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChannelFeedStripComponent],
        })
            .overrideComponent(ChannelFeedStripComponent, {
                remove: { imports: [TranslatePipe] },
                add: {
                    imports: [
                        MockPipe(
                            TranslatePipe,
                            (key: string, params?: Record<string, unknown>) =>
                                params
                                    ? `${key} ${JSON.stringify(params)}`
                                    : key
                        ),
                    ],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(ChannelFeedStripComponent);
        selected = [];
        fixture.componentInstance.feedSelected.subscribe((channel) =>
            selected.push(channel)
        );
    });

    it("names the brand and lists the playing country's feeds", () => {
        render(groupFor(espn2));

        expect(host().querySelector('.feeds__title')?.textContent).toContain(
            '"name":"ESPN"'
        );
        expect(labels()).toEqual(['ESPN', 'ESPN 2', 'ESPN+']);
        expect(
            button(`channel-feed-${espn2.id}`)?.getAttribute('aria-current')
        ).toBe('true');
        expect(
            button(`channel-feed-${espn.id}`)?.hasAttribute('aria-current')
        ).toBe(false);
    });

    it('keeps the other countries closed until asked', () => {
        render(groupFor(espn2));
        const us = button('channel-feeds-region-US');

        expect(
            button('channel-feeds-region-AR')?.getAttribute('aria-expanded')
        ).toBe('true');
        expect(us?.getAttribute('aria-expanded')).toBe('false');
        expect(us?.querySelector('.feeds__region-count')?.textContent).toBe(
            '2'
        );

        us?.click();
        fixture.detectChanges();

        expect(us?.getAttribute('aria-expanded')).toBe('true');
        expect(labels()).toEqual(['ESPN', 'ESPN 2', 'ESPN+', 'ESPN', 'ESPN 2']);
    });

    it('plays the feed chosen, never the one playing', () => {
        render(groupFor(espn2));

        button(`channel-feed-${espnPlus.id}`)?.click();
        button(`channel-feed-${espn2.id}`)?.click();

        expect(selected).toEqual([espnPlus]);
    });

    it('opens the next country when the playing one has nothing else', () => {
        render(groupFor(espnUs, [espnUs, espn, espn2]));

        expect(
            button('channel-feeds-region-AR')?.getAttribute('aria-expanded')
        ).toBe('true');
        expect(labels()).toEqual(['ESPN', 'ESPN', 'ESPN 2']);
    });

    it('names no country when there is only one', () => {
        render(groupFor(espn2, [espn, espn2]));

        expect(host().querySelector('.feeds__region')).toBeNull();
        expect(labels()).toEqual(['ESPN', 'ESPN 2']);
    });

    it('is one tab stop, the playing feed, moved by the arrow keys', () => {
        render(groupFor(espn2));
        const playing = button(`channel-feed-${espn2.id}`) as HTMLElement;

        expect(tabStops()).toEqual([playing]);

        playing.focus();
        const right = press(playing, 'ArrowRight');

        // Handled here, so the player's own arrow shortcuts never see it.
        expect(right.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(
            button(`channel-feed-${espnPlus.id}`)
        );
        expect(tabStops()).toEqual([button(`channel-feed-${espnPlus.id}`)]);

        press(document.activeElement as HTMLElement, 'Home');
        expect(document.activeElement).toBe(button('channel-feeds-region-AR'));

        press(document.activeElement as HTMLElement, 'End');
        expect(document.activeElement).toBe(button('channel-feeds-region-US'));

        press(document.activeElement as HTMLElement, 'ArrowLeft');
        expect(document.activeElement).toBe(
            button(`channel-feed-${espnPlus.id}`)
        );
    });

    it('leaves other keys alone', () => {
        render(groupFor(espn2));
        const playing = button(`channel-feed-${espn2.id}`) as HTMLElement;

        expect(press(playing, 'ArrowUp').defaultPrevented).toBe(false);
        expect(press(playing, 'k').defaultPrevented).toBe(false);
    });

    it('drops a logo that does not load and keeps the name', () => {
        render(groupFor(espn2));
        const option = button(`channel-feed-${espn.id}`);

        option
            ?.querySelector('img')
            ?.dispatchEvent(new Event('error', { bubbles: false }));
        fixture.detectChanges();

        expect(option?.querySelector('img')).toBeNull();
        expect(option?.textContent).toContain('ESPN');
    });
});
