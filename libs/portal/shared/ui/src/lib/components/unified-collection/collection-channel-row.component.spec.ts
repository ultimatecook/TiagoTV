import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
    LIVE_CHANNEL_PLAY_STATE_KEY,
    UnifiedCollectionItem,
} from '@iptvnator/portal/shared/util';
import { CollectionChannelRowComponent } from './collection-channel-row.component';

function channel(
    overrides: Partial<UnifiedCollectionItem>
): UnifiedCollectionItem {
    return {
        uid: 'xtream::source-1::live::14',
        name: '|ES| 24h',
        contentType: 'live',
        sourceType: 'xtream',
        playlistId: 'source-1',
        playlistName: 'TiagoTV',
        logo: 'http://logo.test/24h.png',
        xtreamId: 14,
        categoryId: '4',
        ...overrides,
    };
}

const XTREAM = channel({});
const M3U = channel({
    uid: 'm3u::list-1::http://stream.test/c5n',
    name: 'C5N',
    sourceType: 'm3u',
    playlistId: 'list-1',
    playlistName: 'Lista',
    logo: null,
    xtreamId: undefined,
    streamUrl: 'http://stream.test/c5n',
});

describe('CollectionChannelRowComponent', () => {
    let fixture: ComponentFixture<CollectionChannelRowComponent>;
    const router = {
        url: '/workspace/global-favorites',
        navigate: jest.fn(async () => true),
    };

    async function render(
        items: UnifiedCollectionItem[],
        searchTerm = '',
        mode: 'favorites' | 'recent' = 'favorites'
    ) {
        TestBed.configureTestingModule({
            imports: [CollectionChannelRowComponent, TranslateModule.forRoot()],
            providers: [{ provide: Router, useValue: router }],
        });
        fixture = TestBed.createComponent(CollectionChannelRowComponent);
        fixture.componentRef.setInput('items', items);
        fixture.componentRef.setInput('searchTerm', searchTerm);
        fixture.componentRef.setInput('mode', mode);
        fixture.detectChanges();
        await fixture.whenStable();
    }

    const element = () => fixture.nativeElement as HTMLElement;
    const cards = () =>
        Array.from(
            element().querySelectorAll<HTMLButtonElement>(
                '[data-test-id="my-list-channel"]'
            )
        );

    beforeEach(() => jest.clearAllMocks());

    it('shows the channels as cards: logo or name, flag, tidy name', async () => {
        await render([XTREAM, M3U]);

        expect(
            element().querySelector('.channels__title')?.textContent
        ).toContain('WORKSPACE.MY_LIST.CHANNELS');
        expect(element().querySelector('.channels__count')?.textContent).toBe(
            '2'
        );
        const [first, second] = cards();
        expect(first.querySelector('.channel__name')?.textContent).toBe('24h');
        expect(first.querySelector('.channel__logo')?.getAttribute('src')).toBe(
            'http://logo.test/24h.png'
        );
        expect(first.querySelector('.channel__flag')?.getAttribute('src')).toBe(
            './assets/flags/es.svg'
        );
        // No logo: the name on the plate.
        expect(second.querySelector('.channel__word')?.textContent).toBe('C5N');
        // Two sources: each card names its own.
        expect(second.querySelector('.channel__meta')?.textContent).toContain(
            'Lista'
        );
    });

    it('plays an Xtream channel on "En vivo"', async () => {
        await render([XTREAM]);

        cards()[0].click();

        expect(router.navigate).toHaveBeenCalledWith(
            ['/workspace', 'countries'],
            {
                state: {
                    [LIVE_CHANNEL_PLAY_STATE_KEY]: {
                        playlistId: 'source-1',
                        streamId: 14,
                        categoryId: '4',
                        title: '|ES| 24h',
                        icon: 'http://logo.test/24h.png',
                    },
                },
            }
        );
    });

    it('plays an M3U channel in its source’s own favourites', async () => {
        await render([M3U]);

        cards()[0].click();

        expect(router.navigate).toHaveBeenCalledWith(
            ['/workspace', 'playlists', 'list-1', 'favorites'],
            {
                state: {
                    openLiveCollectionItem: expect.objectContaining({
                        sourceType: 'm3u',
                        playlistId: 'list-1',
                        itemId: 'http://stream.test/c5n',
                    }),
                },
            }
        );
    });

    it('takes a channel off the list from its heart', async () => {
        await render([XTREAM, M3U]);
        const removed: UnifiedCollectionItem[] = [];
        fixture.componentInstance.removeItem.subscribe((item) =>
            removed.push(item)
        );

        const hearts = element().querySelectorAll<HTMLButtonElement>(
            '[data-test-id="my-list-channel-remove"]'
        );
        expect(hearts[1].getAttribute('aria-label')).toBe(
            'WORKSPACE.MY_LIST.REMOVE_NAMED'
        );
        hearts[1].click();

        expect(removed).toEqual([M3U]);
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('filters by the search, and hides without a match', async () => {
        await render([XTREAM, M3U], 'c5n');
        expect(cards().length).toBe(1);

        TestBed.resetTestingModule();
        await render([XTREAM, M3U], 'telefe');
        expect(
            element().querySelector('[data-test-id="my-list-channels"]')
        ).toBeNull();
        expect(cards().length).toBe(0);
    });

    it('does not play a channel its source no longer lists', async () => {
        await render([channel({ catalogStatus: 'missing' })]);

        expect(cards()[0].disabled).toBe(true);
        expect(
            cards()[0].querySelector('.channel__meta')?.textContent
        ).toContain('WORKSPACE.GLOBAL_FAVORITES.CATALOG_MISSING');
    });

    it("never names a source by the provider's address", async () => {
        await render([
            channel({ playlistName: 'http://provider.test:8080' }),
            M3U,
        ]);

        const meta = cards()[0].querySelector('.channel__meta')?.textContent;
        expect(meta).toContain('Xtream');
        expect(meta).not.toContain('provider.test');
    });

    it('has no bin on Mi lista', async () => {
        await render([XTREAM]);

        expect(
            element().querySelector('[data-test-id="channels-clear"]')
        ).toBeNull();
    });

    describe('on Recently viewed', () => {
        it('plays an Xtream channel on "En vivo" too', async () => {
            await render([XTREAM], '', 'recent');

            cards()[0].click();

            expect(router.navigate).toHaveBeenCalledWith(
                ['/workspace', 'countries'],
                expect.objectContaining({
                    state: {
                        [LIVE_CHANNEL_PLAY_STATE_KEY]: expect.objectContaining(
                            { playlistId: 'source-1', streamId: 14 }
                        ),
                    },
                })
            );
        });

        it('plays an M3U channel in its source’s recent items', async () => {
            await render([M3U], '', 'recent');

            cards()[0].click();

            expect(router.navigate).toHaveBeenCalledWith(
                ['/workspace', 'playlists', 'list-1', 'recent'],
                {
                    state: {
                        openLiveCollectionItem: expect.objectContaining({
                            sourceType: 'm3u',
                            itemId: 'http://stream.test/c5n',
                        }),
                    },
                }
            );
        });

        it('takes a channel out of the history from its ×', async () => {
            await render([XTREAM], '', 'recent');
            const removed: UnifiedCollectionItem[] = [];
            fixture.componentInstance.removeItem.subscribe((item) =>
                removed.push(item)
            );

            const remove = element().querySelector<HTMLButtonElement>(
                '[data-test-id="my-list-channel-remove"]'
            );
            expect(remove?.getAttribute('aria-label')).toBe(
                'WORKSPACE.GLOBAL_RECENT.REMOVE_NAMED'
            );
            expect(remove?.textContent?.trim()).toBe('close');
            remove?.click();

            expect(removed).toEqual([XTREAM]);
            expect(router.navigate).not.toHaveBeenCalled();
        });

        it('asks to clear every channel from its bin', async () => {
            await render([XTREAM, M3U], '', 'recent');
            let cleared = 0;
            fixture.componentInstance.clearAll.subscribe(() => cleared++);

            element()
                .querySelector<HTMLButtonElement>(
                    '[data-test-id="channels-clear"]'
                )
                ?.click();

            expect(cleared).toBe(1);
        });
    });
});
