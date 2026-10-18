import {
    computed,
    DestroyRef,
    DOCUMENT,
    effect,
    inject,
    Injectable,
    signal,
    untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { PlatformsCatalogService } from './platforms-catalog.service';
import { platformOfRoute, readPlatformRoute } from './platform-theme';
import type { StreamingPlatform } from './streaming-platforms';

/**
 * Dresses the app as the open platform: its page, and the page of a movie
 * or series filed in its catalog, so a Netflix title opens like Netflix.
 *
 * The root element carries `data-platform-theme="<platform id>"`, which
 * the global platform stylesheet keys the detail pages on, and the
 * `platform-ambient` class with `--platform-ambient`, the colour the shell
 * tints the glass with (Netflix red, Prime blue…). Leaving the platform
 * takes both off; the colour stays so the glass fades out in it.
 */
@Injectable({ providedIn: 'root' })
export class PlatformThemeService {
    private readonly router = inject(Router);
    private readonly catalog = inject(PlatformsCatalogService);
    private readonly root = inject(DOCUMENT).documentElement;
    private readonly destroyRef = inject(DestroyRef);
    private readonly url = signal<string | null>(null);
    /** Prime Video's "Included with Prime", for its title pages. */
    private readonly includedLabel = toSignal(
        inject(TranslateService).stream('WORKSPACE.PLATFORMS.INCLUDED', {
            platform: 'Prime',
        }),
        { initialValue: '' }
    );

    private readonly route = computed(() => {
        const url = this.url();
        return url === null ? null : readPlatformRoute(url);
    });
    /** The platform the current page belongs to, if any. */
    readonly platform = computed(() =>
        platformOfRoute(
            this.route(),
            this.catalog.source()?._id ?? null,
            this.catalog.shelves()
        )
    );

    constructor() {
        // A title page opened straight (a reload, a link) still needs the
        // platforms' categories to know whose title it is, once the source
        // is known: on a reload the playlists arrive later.
        effect(() => {
            if (
                this.route()?.page === 'detail' &&
                this.catalog.source() &&
                this.catalog.shelves() === null
            ) {
                untracked(() => void this.catalog.loadShelves());
            }
        });
        effect(() => this.paint(this.platform(), this.includedLabel()));
    }

    /** Follows the router from now on; calling it again does nothing. */
    start(): void {
        if (this.url() !== null) {
            return;
        }
        this.url.set(this.router.url);
        this.router.events
            .pipe(
                filter(
                    (event): event is NavigationEnd =>
                        event instanceof NavigationEnd
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((event) => this.url.set(event.urlAfterRedirects));
    }

    private paint(platform: StreamingPlatform | null, included: string): void {
        const root = this.root;
        root.classList.toggle('platform-ambient', !!platform);
        if (!platform) {
            root.removeAttribute('data-platform-theme');
            root.style.removeProperty('--platform-included');
            return;
        }
        root.setAttribute('data-platform-theme', platform.id);
        root.style.setProperty('--platform-ambient', platform.ambient);
        if (platform.id === 'prime-video' && included) {
            root.style.setProperty('--platform-included', cssString(included));
        } else {
            root.style.removeProperty('--platform-included');
        }
    }
}

/** A quoted CSS string, for a `content` that reads a custom property. */
export function cssString(text: string): string {
    return `"${text.replace(/["\\\n]/g, (char) =>
        char === '\n' ? '\\a ' : `\\${char}`
    )}"`;
}
