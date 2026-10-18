import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    Injector,
    input,
    linkedSignal,
    output,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type {
    ChannelFeedGroup,
    ChannelFeedOption,
    FeedCandidate,
    FeedRegion,
} from '@iptvnator/portal/shared/util';

/** A country of the strip, as it renders. */
export interface ChannelFeedRegionView {
    /** "AR", or "other" for the channels no country claims. */
    readonly key: string;
    readonly nameKey: string;
    readonly flag: string | null;
    readonly options: readonly ChannelFeedOption[];
    readonly open: boolean;
}

const FLAGS = './assets/flags/';
const OTHER_REGION = 'other';

let nextId = 0;

/**
 * TiagoTV: the feeds a live channel can switch to, under the player
 * ("Otras señales de ESPN"). The playing channel's country lists its feeds
 * (the playing feed with all its copies); the other countries open on
 * demand. One tab stop: the arrow keys, Home and End move between the
 * countries and the feeds, Enter or Space plays the focused one.
 */
@Component({
    selector: 'app-channel-feed-strip',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './channel-feed-strip.component.html',
    styleUrl: './channel-feed-strip.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelFeedStripComponent {
    readonly group = input.required<ChannelFeedGroup>();
    /** A feed to play; never the one playing. */
    readonly feedSelected = output<FeedCandidate>();

    private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
    private readonly injector = inject(Injector);
    readonly titleId = `channel-feeds-title-${nextId++}`;

    /** Logos that did not load: the option shows its name alone. */
    private readonly failedLogos = signal<ReadonlySet<string>>(new Set());
    /**
     * The open countries: the playing one, and the next one when it has
     * nothing else to offer. Kept while the same brand plays in the same
     * country, so switching ESPN for ESPN 2 leaves the strip as it was.
     */
    private readonly openRegions = linkedSignal<string, ReadonlySet<string>>({
        source: () => {
            const group = this.group();
            return `${group.key}|${regionKey(group.regions[0]?.region)}`;
        },
        computation: () => defaultOpenRegions(this.group()),
    });
    /** The stop the keyboard last rested on. */
    private readonly focusedStop = signal<string | null>(null);

    /** Countries are named only when there are several. */
    readonly labelled = computed(() => this.group().regions.length > 1);
    readonly regions = computed<ChannelFeedRegionView[]>(() => {
        const open = this.openRegions();
        const labelled = this.labelled();
        return this.group().regions.map((region) => {
            const key = regionKey(region.region);
            return {
                key,
                nameKey: region.region
                    ? `WORKSPACE.COUNTRIES.NAMES.${region.region}`
                    : 'CHANNELS.FEEDS.OTHER_REGION',
                flag: region.region
                    ? `${FLAGS}${region.region.toLowerCase()}.svg`
                    : null,
                options: region.options,
                open: !labelled || open.has(key),
            };
        });
    });
    /** Every focusable stop, in order. */
    private readonly stops = computed(() => {
        const stops: string[] = [];
        for (const region of this.regions()) {
            if (this.labelled()) {
                stops.push(regionStop(region.key));
            }
            if (region.open) {
                stops.push(...region.options.map(optionStop));
            }
        }
        return stops;
    });
    /** The one stop Tab lands on: the last focused, else the playing feed. */
    readonly tabStop = computed(() => {
        const stops = this.stops();
        const focused = this.focusedStop();
        if (focused && stops.includes(focused)) {
            return focused;
        }
        const playing = this.group()
            .regions.reduce<ChannelFeedOption[]>(
                (all, region) => all.concat(region.options),
                []
            )
            .find((option) => option.current);
        const current = playing ? optionStop(playing) : null;
        return current && stops.includes(current)
            ? current
            : (stops[0] ?? null);
    });

    readonly regionStop = regionStop;
    readonly optionStop = optionStop;

    tabIndexOf(stop: string): number {
        return stop === this.tabStop() ? 0 : -1;
    }

    logoOf(option: ChannelFeedOption): string | null {
        const icon = option.channel.icon;
        return icon && !this.failedLogos().has(icon) ? icon : null;
    }

    logoFailed(icon: string): void {
        this.failedLogos.update((failed) => new Set(failed).add(icon));
    }

    toggle(region: ChannelFeedRegionView): void {
        this.openRegions.update((open) => {
            const next = new Set(open);
            if (!next.delete(region.key)) {
                next.add(region.key);
            }
            return next;
        });
        if (!region.open) {
            // Its feeds open to the right: bring the country to the start.
            afterNextRender(
                () =>
                    this.stopElement(regionStop(region.key))?.scrollIntoView?.({
                        block: 'nearest',
                        inline: 'start',
                    }),
                { injector: this.injector }
            );
        }
    }

    select(option: ChannelFeedOption): void {
        if (!option.current) {
            this.feedSelected.emit(option.channel);
        }
    }

    onFocusIn(event: FocusEvent): void {
        const stop = (event.target as HTMLElement | null)?.dataset?.[
            'feedStop'
        ];
        if (stop) {
            this.focusedStop.set(stop);
        }
    }

    onKeydown(event: KeyboardEvent): void {
        const stops = this.stops();
        const from = stops.indexOf(
            (event.target as HTMLElement | null)?.dataset?.['feedStop'] ?? ''
        );
        if (from === -1 || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const forward = this.isRtl() ? 'ArrowLeft' : 'ArrowRight';
        const back = this.isRtl() ? 'ArrowRight' : 'ArrowLeft';
        const to =
            event.key === forward
                ? Math.min(from + 1, stops.length - 1)
                : event.key === back
                  ? Math.max(from - 1, 0)
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? stops.length - 1
                      : null;
        if (to === null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.focusStop(stops[to]);
    }

    private focusStop(stop: string): void {
        this.focusedStop.set(stop);
        this.stopElement(stop)?.focus();
    }

    private stopElement(stop: string): HTMLElement | null {
        return this.host.nativeElement.querySelector<HTMLElement>(
            `[data-feed-stop="${stop}"]`
        );
    }

    private isRtl(): boolean {
        return getComputedStyle(this.host.nativeElement).direction === 'rtl';
    }
}

function regionKey(region: FeedRegion | null | undefined): string {
    return region ?? OTHER_REGION;
}

function regionStop(key: string): string {
    return `region-${key}`;
}

function optionStop(option: ChannelFeedOption): string {
    return `feed-${option.channel.id}`;
}

function defaultOpenRegions(group: ChannelFeedGroup): ReadonlySet<string> {
    const [first, second] = group.regions;
    const open = new Set<string>();
    if (first) {
        open.add(regionKey(first.region));
    }
    // Nothing else in the playing country: show the next one too.
    if (first && second && first.options.length < 2) {
        open.add(regionKey(second.region));
    }
    return open;
}
