import {
    computed,
    effect,
    inject,
    Injectable,
    signal,
    untracked,
} from '@angular/core';

/** A movie or series on screen, as its title page knows it. */
export interface TitlePlatformRef {
    readonly playlistId: string;
    readonly kind: 'movie' | 'series';
    /** The provider's stream id (movie) or series id. */
    readonly itemId: string | number;
    /** The category it was opened in, when the page knows it. */
    readonly categoryId?: string | number | null;
}

/** The streaming platform a title belongs to, as its pages dress it. */
export interface TitlePlatformBrand {
    readonly id: string;
    readonly name: string;
    /** The bundled logo, or null where the platform's name is written. */
    readonly logo: string | null;
    /** White on the brand colour, or the logo's own colours. */
    readonly logoTone: 'white' | 'brand';
    /** The platform's colour: the glass tint and the player's accent. */
    readonly ambient: string;
}

/**
 * Reads a title's platform; it may read signals (the platforms' lists, the
 * catalog's membership), so the brand follows them as they load.
 */
export type TitlePlatformResolver = (
    ref: TitlePlatformRef
) => TitlePlatformBrand | null;

interface ShownTitle {
    readonly ref: TitlePlatformRef;
}

/**
 * TiagoTV: which streaming platform the title on screen belongs to, so its
 * page and its player wear that platform's look wherever the page was
 * opened from (a platform page, Series/Películas, Buscar, Mi lista or the
 * Home's "Continue watching"). Title pages say what they show (`show`);
 * the workspace's platform catalog says whose it is (`useResolver`), the
 * pages read `brand`.
 */
@Injectable({ providedIn: 'root' })
export class TitlePlatformStore {
    private readonly shown = signal<readonly ShownTitle[]>([]);
    private readonly resolver = signal<TitlePlatformResolver | null>(null);

    /** The title on screen: the latest page that says so. */
    readonly title = computed<TitlePlatformRef | null>(() => {
        const shown = this.shown();
        return shown.length ? shown[shown.length - 1].ref : null;
    });

    /** The platform of the title on screen, once known. */
    readonly brand = computed<TitlePlatformBrand | null>(() => {
        const title = this.title();
        const resolve = this.resolver();
        return title && resolve ? resolve(title) : null;
    });

    /** A page shows `ref` until the returned function is called. */
    show(ref: TitlePlatformRef): () => void {
        const entry: ShownTitle = { ref };
        this.shown.update((list) => [...list, entry]);
        return () =>
            this.shown.update((list) => list.filter((item) => item !== entry));
    }

    useResolver(resolver: TitlePlatformResolver | null): void {
        this.resolver.set(resolver);
    }
}

/**
 * A title page's side: while the page lives, the store knows the title it
 * shows (null: none yet). Call in an injection context.
 */
export function publishTitlePlatform(
    ref: () => TitlePlatformRef | null
): void {
    const store = inject(TitlePlatformStore);
    effect((onCleanup) => {
        const current = ref();
        if (!current) {
            return;
        }
        const release = untracked(() => store.show(current));
        onCleanup(release);
    });
}
