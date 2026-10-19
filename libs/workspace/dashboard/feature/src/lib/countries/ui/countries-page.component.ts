import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    linkedSignal,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { findCountryDefinition } from '../countries';
import type { TvCountry } from '../countries-catalog';
import { CountriesCatalogService } from '../countries-catalog.service';
import {
    countryCards,
    countryCategories,
    hasCategory,
    type TvCard,
    type TvCategoryId,
} from '../country-tv-categories';
import { CountryTvControls } from '../country-tv-controls';
import { CountryTvGuide } from '../country-tv-guide';
import { OverlayIdle } from '../country-tv-idle';
import { liveKeyAction, onLivePage } from '../country-tv-keys';
import { CountryTvListings } from '../country-tv-listings';
import { CountryTvPlayback } from '../country-tv-playback';
import {
    browserStorage,
    countrySelection,
    openingSelection,
    readMemory,
    rememberCountry,
    selectionOf,
} from '../country-tv-start';
import { CountryPickerComponent } from './country-picker.component';
import { CountryTvOverlayComponent } from './country-tv-overlay.component';
import { CountryTvStageComponent } from './country-tv-stage.component';

/**
 * "En vivo" (/workspace/countries), a TV: the live player fills the page,
 * behind the top bar; the country's button sits top right, and at the
 * foot an overlay holds the channel, its controls, the category chips and
 * the channels in cards. A card plays in place; nothing navigates. The
 * overlay goes after a few quiet seconds while a channel plays and comes
 * back on a mouse move or a key (`OverlayIdle`). The page opens on the
 * country chosen last, on its last channel (`openingSelection`); a
 * country's route (`/workspace/countries/es`) opens on that country.
 */
@Component({
    selector: 'lib-countries-page',
    imports: [
        CountryPickerComponent,
        CountryTvOverlayComponent,
        CountryTvStageComponent,
        MatIcon,
        TranslatePipe,
    ],
    providers: [
        CountryTvPlayback,
        CountryTvGuide,
        CountryTvListings,
        CountryTvControls,
    ],
    templateUrl: './countries-page.component.html',
    styleUrl: './countries-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountriesPageComponent {
    readonly catalog = inject(CountriesCatalogService);
    readonly tv = inject(CountryTvPlayback);
    readonly controls = inject(CountryTvControls);
    private readonly live = viewChild<ElementRef<HTMLElement>>('live');
    private readonly overlayElement = viewChild(CountryTvOverlayComponent, {
        read: ElementRef,
    });
    private readonly overlay = viewChild(CountryTvOverlayComponent);
    private readonly picker = viewChild(CountryPickerComponent);

    /** Bound from the route parameter, on a country's route. */
    readonly countryId = input<string>('');
    readonly countries = this.catalog.countries;
    /** The country on the page. */
    private readonly chosen = signal<string | null>(null);
    readonly country = computed<TvCountry | null>(() => {
        const countries = this.countries() ?? [];
        return (
            countries.find((entry) => entry.definition.id === this.chosen()) ??
            countries[0] ??
            null
        );
    });
    readonly categories = computed(() => {
        const country = this.country();
        return country ? countryCategories(country) : [];
    });
    /** The chip picked; "All" again on another country. */
    readonly category = linkedSignal<string | null, TvCategoryId>({
        source: () => this.country()?.definition.id ?? null,
        computation: () => 'all',
    });
    readonly activeCategory = computed<TvCategoryId>(() =>
        hasCategory(this.categories(), this.category())
            ? this.category()
            : 'all'
    );
    readonly cards = computed(() => {
        const country = this.country();
        return country ? countryCards(country, this.activeCategory()) : [];
    });
    readonly pickerOpen = signal(false);
    /** Keyboard focus is on the page's controls: the overlay stays. */
    private readonly pinned = signal(false);
    private readonly hovering = signal(false);
    readonly playing = computed(
        () => !!this.tv.playback() && this.controls.playing()
    );
    readonly idle = new OverlayIdle(
        () =>
            this.playing() &&
            !this.pinned() &&
            !this.hovering() &&
            !this.pickerOpen()
    );
    readonly skeletonCards = [1, 2, 3, 4, 5, 6, 7, 8];
    private opened = false;
    /** Whether the overlay showed when the picture was pressed. */
    private shownOnPress = true;

    constructor() {
        const destroyRef = inject(DestroyRef);
        this.catalog.keepFresh(destroyRef);
        effect(() => {
            const countries = this.countries();
            if (countries && countries.length > 0 && !this.opened) {
                untracked(() => this.open(countries));
            }
        });
        // Another country's route while the page is open.
        effect(() => {
            const id = findCountryDefinition(this.countryId())?.id;
            if (id && this.opened) {
                untracked(() => this.chooseCountry(id));
            }
        });
        effect(() => {
            this.playing();
            this.pinned();
            this.hovering();
            this.pickerOpen();
            untracked(() => this.idle.update());
        });
        effect(() => {
            const live = this.live()?.nativeElement;
            if (live) {
                untracked(() => this.controls.attach(live));
            }
        });
        afterNextRender(() => this.listen(destroyRef));
        destroyRef.onDestroy(() => this.idle.destroy());
    }

    /** A country from its button's menu, or from its route. */
    chooseCountry(id: string): void {
        const country = this.countries()?.find(
            (entry) => entry.definition.id === id
        );
        if (!country || this.country()?.definition.id === id) {
            return;
        }
        this.chosen.set(id);
        rememberCountry(browserStorage(), id);
        const selection = countrySelection(
            country,
            readMemory(browserStorage())
        );
        if (selection) {
            this.tv.open(selection);
        }
    }

    play(card: TvCard): void {
        const country = this.country();
        if (country) {
            this.tv.play(selectionOf(country, card.row, card.channel));
        }
    }

    pickCategory(category: TvCategoryId): void {
        this.category.set(category);
    }

    setHovering(hovering: boolean): void {
        this.hovering.set(hovering);
    }

    openLiveView(): void {
        this.tv.openLiveView();
    }

    /** A press on the picture: the overlay goes if it showed, else comes. */
    onPicturePress(): void {
        this.shownOnPress = this.idle.visible();
    }

    onPictureClick(): void {
        if (this.shownOnPress) {
            this.idle.hide();
        } else {
            this.idle.wake();
        }
    }

    /** Keyboard focus on the page pins the overlay; a pointer's does not. */
    onFocusIn(event: FocusEvent): void {
        const target = event.target as HTMLElement;
        this.pinned.set(
            target !== this.live()?.nativeElement && keyboard(target)
        );
        this.idle.wake();
    }

    onFocusOut(event: FocusEvent): void {
        const next = event.relatedTarget as Node | null;
        if (!next || !this.live()?.nativeElement.contains(next)) {
            this.pinned.set(false);
        }
    }

    retry(): void {
        this.catalog.retry();
    }

    private open(countries: readonly TvCountry[]): void {
        this.opened = true;
        const routeId = findCountryDefinition(this.countryId())?.id ?? null;
        const selection = openingSelection(
            countries,
            readMemory(browserStorage()),
            routeId
        );
        this.chosen.set(
            selection?.country.definition.id ?? countries[0].definition.id
        );
        if (selection) {
            this.tv.open(selection);
        }
    }

    /**
     * The page's own listeners, outside Angular's: a mouse move must not
     * run change detection, only restart the overlay's quiet time.
     */
    private listen(destroyRef: DestroyRef): void {
        const nudge = () => this.idle.nudge();
        const key = (event: KeyboardEvent) => this.onKeydown(event);
        // Bubbling, after the picture's own press (`onPicturePress`).
        const press = (event: PointerEvent) => {
            const overlay = this.overlayElement()?.nativeElement;
            if (overlay?.contains(event.target as Node)) {
                // A click in the overlay is not keyboard focus.
                this.pinned.set(false);
            }
            this.idle.wake();
        };
        document.addEventListener('mousemove', nudge, { passive: true });
        document.addEventListener('wheel', nudge, { passive: true });
        document.addEventListener('pointerdown', press);
        document.addEventListener('keydown', key);
        destroyRef.onDestroy(() => {
            document.removeEventListener('mousemove', nudge);
            document.removeEventListener('wheel', nudge);
            document.removeEventListener('pointerdown', press);
            document.removeEventListener('keydown', key);
        });
    }

    private onKeydown(event: KeyboardEvent): void {
        const live = this.live()?.nativeElement;
        // The player's own keys, forwarded by `CountryTvControls`, and
        // keys meant for a dialog or a field elsewhere.
        if (
            !live ||
            this.controls.isForwarded(event) ||
            !onLivePage(event, live)
        ) {
            return;
        }
        this.idle.wake();
        if (live.contains(event.target as Node) && event.target !== live) {
            this.pinned.set(true);
        }
        const action = liveKeyAction(event);
        if (!action) {
            return;
        }
        event.preventDefault();
        switch (action) {
            case 'collapse':
                this.collapse(live);
                break;
            case 'play':
                this.overlay()?.playPause();
                break;
            case 'mute':
                this.controls.toggleMute();
                break;
            case 'fullscreen':
                this.controls.toggleFullscreen();
                break;
            case 'cards':
                this.overlay()?.focusCards();
                break;
        }
    }

    /** Esc: the country menu closes; else the overlay goes. */
    private collapse(live: HTMLElement): void {
        if (this.pickerOpen()) {
            this.picker()?.close(true);
            return;
        }
        if (live.contains(document.activeElement)) {
            live.focus({ preventScroll: true });
        }
        this.pinned.set(false);
        this.idle.hide();
    }
}

/** Focus a key moved, or a script after a key (`:focus-visible`). */
function keyboard(element: HTMLElement): boolean {
    try {
        return element.matches(':focus-visible');
    } catch {
        return true;
    }
}
