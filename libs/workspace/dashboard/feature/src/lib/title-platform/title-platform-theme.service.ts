import {
    afterEveryRender,
    computed,
    DOCUMENT,
    effect,
    inject,
    Injectable,
    Injector,
    untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { TitlePlatformStore } from '@iptvnator/services';
import { CatalogMembership } from '../catalog/catalog-membership';
import {
    cssString,
    PlatformThemeService,
} from '../platforms/platform-theme.service';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import type { StreamingPlatform } from '../platforms/streaming-platforms';
import {
    titlePlatform,
    titlePlatformBrand,
    type TitlePlatformSources,
} from './title-platform-resolver';

const THEME_ATTRIBUTE = 'data-platform-theme';
const AMBIENT_CLASS = 'platform-ambient';

/**
 * Dresses the title on screen as its streaming platform wherever its page
 * was opened from. `PlatformThemeService` dresses a platform's page and a
 * title opened in one of its categories (it reads the URL); a title opened
 * from Buscar, Mi lista or "Continue watching" sits in a genre's category
 * or on no title route at all, so the title page says what it shows
 * (`TitlePlatformStore`) and this reads its platform from the platforms'
 * own lists. It paints the same marks on <html> as the platform theme,
 * only while that one paints none, and re-checks them after every render
 * so the two never undo each other.
 */
@Injectable({ providedIn: 'root' })
export class TitlePlatformThemeService {
    private readonly store = inject(TitlePlatformStore);
    private readonly catalog = inject(PlatformsCatalogService);
    private readonly membership = inject(CatalogMembership);
    private readonly routeTheme = inject(PlatformThemeService);
    private readonly root = inject(DOCUMENT).documentElement;
    private readonly injector = inject(Injector);
    private readonly includedLabel = toSignal(
        inject(TranslateService).stream('WORKSPACE.PLATFORMS.INCLUDED', {
            platform: 'Prime',
        }),
        { initialValue: '' }
    );
    private started = false;
    /** The platform this service painted last, to take its marks off. */
    private painted: string | null = null;

    /** The platform of the title on screen. */
    readonly platform = computed<StreamingPlatform | null>(() => {
        const title = this.store.title();
        return title ? titlePlatform(title, this.sources()) : null;
    });

    /** Starts resolving and painting; calling it again does nothing. */
    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        this.store.useResolver((ref) => {
            const platform = titlePlatform(ref, this.sources());
            return platform ? titlePlatformBrand(platform) : null;
        });
        // A title opened outside a platform page (Mi lista, a reload) still
        // needs the platforms' categories to know whose it is.
        effect(
            () => {
                if (
                    this.store.title() &&
                    this.catalog.source() &&
                    this.catalog.shelves() === null
                ) {
                    untracked(() => void this.catalog.loadShelves());
                }
            },
            { injector: this.injector }
        );
        afterEveryRender({ write: () => this.reconcile() }, {
            injector: this.injector,
        });
    }

    private sources(): TitlePlatformSources {
        return {
            sourceId: this.catalog.source()?._id ?? null,
            shelves: this.catalog.shelves(),
            memberOf: (kind, id) => this.membership.platformOf(kind, id),
        };
    }

    /** Puts the title's marks on <html>, or takes its own off. */
    reconcile(): void {
        const routePlatform = this.routeTheme.platform();
        const platform = routePlatform ? null : this.platform();
        const root = this.root;
        if (platform) {
            if (root.getAttribute(THEME_ATTRIBUTE) !== platform.id) {
                root.setAttribute(THEME_ATTRIBUTE, platform.id);
            }
            root.classList.add(AMBIENT_CLASS);
            root.style.setProperty('--platform-ambient', platform.ambient);
            const included = this.includedLabel();
            if (platform.id === 'prime-video' && included) {
                root.style.setProperty(
                    '--platform-included',
                    cssString(included)
                );
            } else {
                root.style.removeProperty('--platform-included');
            }
            this.painted = platform.id;
            return;
        }
        if (this.painted === null) {
            return;
        }
        if (
            !routePlatform &&
            root.getAttribute(THEME_ATTRIBUTE) === this.painted
        ) {
            root.removeAttribute(THEME_ATTRIBUTE);
            root.classList.remove(AMBIENT_CLASS);
            root.style.removeProperty('--platform-included');
        }
        this.painted = null;
    }
}
