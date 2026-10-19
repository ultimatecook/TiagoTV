import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    Injector,
    input,
    model,
    output,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { TvCountry } from '../countries-catalog';

/** The menu's order: Spain, Argentina, the United States, the UK. */
const MENU_ORDER = ['es', 'ar', 'us', 'gb'];

/**
 * "En vivo"'s country, top right: a glass button with the country's flag
 * and name opening a menu of the countries with their channel counts.
 * Choosing one closes it; so do Esc (the page's), a click outside and
 * Tab leaving it. Up and Down move through the menu.
 */
@Component({
    selector: 'lib-country-picker',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './country-picker.component.html',
    styleUrl: './country-picker.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(focusout)': 'onFocusOut($event)',
        '(keydown)': 'onKeydown($event)',
    },
})
export class CountryPickerComponent {
    readonly countries = input.required<readonly TvCountry[]>();
    readonly current = input.required<TvCountry>();
    readonly open = model(false);
    readonly picked = output<string>();

    private readonly host: HTMLElement = inject(ElementRef).nativeElement;
    private readonly injector = inject(Injector);
    private readonly trigger =
        viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
    readonly menuId = 'country-picker-menu';

    readonly options = computed(() =>
        [...this.countries()].sort(
            (a, b) => rank(a.definition.id) - rank(b.definition.id)
        )
    );

    constructor() {
        const outside = (event: PointerEvent) => {
            if (this.open() && !this.host.contains(event.target as Node)) {
                this.open.set(false);
            }
        };
        document.addEventListener('pointerdown', outside, true);
        inject(DestroyRef).onDestroy(() =>
            document.removeEventListener('pointerdown', outside, true)
        );
    }

    toggle(): void {
        const opening = !this.open();
        this.open.set(opening);
        if (opening) {
            this.afterRender(() => this.focusOption(this.currentIndex()));
        }
    }

    pick(country: TvCountry): void {
        this.close(true);
        if (country.definition.id !== this.current().definition.id) {
            this.picked.emit(country.definition.id);
        }
    }

    /** Closes the menu; `refocus` hands focus back to the button. */
    close(refocus: boolean): void {
        this.open.set(false);
        if (refocus) {
            this.trigger().nativeElement.focus();
        }
    }

    onFocusOut(event: FocusEvent): void {
        const next = event.relatedTarget as Node | null;
        if (this.open() && next && !this.host.contains(next)) {
            this.open.set(false);
        }
    }

    onKeydown(event: KeyboardEvent): void {
        if (!this.open() || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const options = this.optionElements();
        const index = options.indexOf(event.target as HTMLElement);
        const last = options.length - 1;
        const moves: Record<string, number> = {
            ArrowDown: index < 0 ? 0 : Math.min(last, index + 1),
            ArrowUp: index < 0 ? last : Math.max(0, index - 1),
            Home: 0,
            End: last,
        };
        if (event.key in moves) {
            event.preventDefault();
            this.focusOption(moves[event.key]);
        }
    }

    private currentIndex(): number {
        const id = this.current().definition.id;
        return Math.max(
            0,
            this.options().findIndex((country) => country.definition.id === id)
        );
    }

    private focusOption(index: number): void {
        this.optionElements()[index]?.focus();
    }

    private optionElements(): HTMLElement[] {
        return Array.from(
            this.host.querySelectorAll<HTMLElement>('[data-country-option]')
        );
    }

    private afterRender(callback: () => void): void {
        afterNextRender(callback, { injector: this.injector });
    }
}

function rank(id: string): number {
    const index = MENU_ORDER.indexOf(id);
    return index < 0 ? MENU_ORDER.length : index;
}
