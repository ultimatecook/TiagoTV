import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { pickRecommendations } from '../platform-hero';
import type { PlatformTitle } from '../platform-titles';
import type { StreamingPlatform } from '../streaming-platforms';
import { PlatformLogoComponent } from './platform-logo.component';

const ROTATE_MS = 8000;

/**
 * The platform page's first card, as the Home's: recommended titles of
 * the platform in turn, the artwork on the right, the title, its match,
 * genres and synopsis on the left, and the way into its page.
 */
@Component({
    selector: 'lib-platform-hero',
    imports: [MatIcon, PlatformLogoComponent, TranslatePipe],
    templateUrl: './platform-hero.component.html',
    styleUrl: './platform-hero.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformHeroComponent {
    private readonly catalog = inject(PlatformsCatalogService);

    readonly platform = input.required<StreamingPlatform>();
    readonly titles = input.required<readonly PlatformTitle[]>();

    readonly slides = computed(() =>
        pickRecommendations(this.titles()).map((title) => {
            const extras = this.catalog.extrasOf(title);
            return {
                title,
                key: `${title.kind}:${title.id}`,
                backdrop: title.backdrop ?? extras?.backdrop ?? null,
                plot: title.plot ?? extras?.plot ?? null,
                genres: extras?.genres ?? [],
                match:
                    title.rating !== null
                        ? Math.round(title.rating * 10)
                        : null,
            };
        })
    );
    private readonly active = signal(0);
    readonly activeIndex = computed(
        () => this.active() % Math.max(this.slides().length, 1)
    );
    /** The current slide alone, so its text animates in on each turn. */
    readonly current = computed(() => {
        const slide = this.slides()[this.activeIndex()];
        return slide ? [slide] : [];
    });
    private readonly paused = signal(false);

    constructor() {
        const reduceMotion =
            typeof matchMedia === 'function' &&
            matchMedia('(prefers-reduced-motion: reduce)').matches;
        effect((onCleanup) => {
            const count = this.slides().length;
            if (count < 2 || this.paused() || reduceMotion) {
                return;
            }
            const timer = setInterval(
                () => this.active.update((index) => (index + 1) % count),
                ROTATE_MS
            );
            onCleanup(() => clearInterval(timer));
        });
        effect(() =>
            this.catalog.loadExtras(this.slides().map((slide) => slide.title))
        );
    }

    show(index: number): void {
        this.active.set(index);
    }

    setPaused(paused: boolean): void {
        this.paused.set(paused);
    }

    open(title: PlatformTitle): void {
        this.catalog.open(title);
    }

    typeKey(title: PlatformTitle): string {
        return title.kind === 'movie'
            ? 'WORKSPACE.DASHBOARD.TYPE_MOVIE'
            : 'WORKSPACE.DASHBOARD.TYPE_SERIES';
    }
}
