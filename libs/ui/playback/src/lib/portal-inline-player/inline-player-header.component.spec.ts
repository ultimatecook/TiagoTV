import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { InlinePlayerHeaderComponent } from './inline-player-header.component';

describe('InlinePlayerHeaderComponent', () => {
    let fixture: ComponentFixture<InlinePlayerHeaderComponent>;
    let copied: string[];

    beforeEach(async () => {
        copied = [];
        await TestBed.configureTestingModule({
            imports: [InlinePlayerHeaderComponent, TranslateModule.forRoot()],
            providers: [
                {
                    provide: Clipboard,
                    useValue: {
                        copy: (text: string) => {
                            copied.push(text);
                            return true;
                        },
                    },
                },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(InlinePlayerHeaderComponent);
        fixture.componentRef.setInput('heading', {
            primary: 'Our Great National Parks',
            secondary: 'S1:E2 · Chilean Patagonia',
        });
        fixture.componentRef.setInput(
            'streamUrl',
            'https://media.example.test/series/u/p/1002.mkv'
        );
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    const query = <T extends HTMLElement>(selector: string): T | null =>
        (fixture.nativeElement as HTMLElement).querySelector<T>(selector);

    it('shows the title and the episode, never the stream address', () => {
        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(query('.head__title')?.textContent?.trim()).toBe(
            'Our Great National Parks'
        );
        expect(query('.head__episode')?.textContent?.trim()).toBe(
            'S1:E2 · Chilean Patagonia'
        );
        expect(text).not.toContain('media.example.test');
        expect(text).not.toContain('Now playing');
    });

    it('closes from the round close button', () => {
        const closed = jest.fn();
        fixture.componentInstance.closed.subscribe(closed);
        query<HTMLButtonElement>('[data-test-id="inline-player-close"]')?.click();
        expect(closed).toHaveBeenCalledTimes(1);
    });

    it('copies the stream address from the "…" menu', async () => {
        const copiedEvents = jest.fn();
        fixture.componentInstance.streamUrlCopied.subscribe(copiedEvents);
        const more = query<HTMLButtonElement>(
            '[data-test-id="inline-player-more"]'
        );
        expect(more?.getAttribute('aria-label')).toBe(
            'PORTALS.PLAYER_MORE_OPTIONS'
        );
        // The address is not on the page until the menu is open.
        expect(
            document.querySelector('[data-test-id="inline-player-copy-url"]')
        ).toBeNull();

        more?.click();
        fixture.detectChanges();
        await fixture.whenStable();
        const copy = document.querySelector<HTMLButtonElement>(
            '[data-test-id="inline-player-copy-url"]'
        );
        expect(copy).not.toBeNull();
        copy?.click();

        expect(copied).toEqual([
            'https://media.example.test/series/u/p/1002.mkv',
        ]);
        expect(copiedEvents).toHaveBeenCalledTimes(1);
    });

    it('writes the platform name when its logo cannot load', () => {
        fixture.componentRef.setInput('brand', {
            id: 'prime-video',
            name: 'Prime Video',
            logo: './assets/platforms/prime-video.svg',
            logoTone: 'white',
            ambient: '#1a98ff',
        });
        fixture.detectChanges();
        const logo = query<HTMLImageElement>(
            '[data-test-id="inline-player-brand"]'
        );
        expect(logo?.tagName).toBe('IMG');
        expect(logo?.classList).toContain('head__brand--white');

        logo?.dispatchEvent(new Event('error'));
        fixture.detectChanges();
        expect(
            query('[data-test-id="inline-player-brand"]')?.textContent?.trim()
        ).toBe('Prime Video');
    });
});
