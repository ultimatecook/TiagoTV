import type { PlatformCatalogItem, PlatformTitleKind } from '@iptvnator/workspace/dashboard/feature/tv-logic';

/**
 * A platform category's entries as the TV keeps them: the newest
 * CATEGORY_LIMIT, only the fields the cards and picks read, the synopsis
 * cut short (a title's page asks for the whole one), and, to keep across
 * launches (catalog-persist.ts), packed under one-letter keys with TMDB's
 * image root shortened.
 */
export const CATEGORY_LIMIT = 250;
/** "Series para ti" shows a few lines of it; the title's page, all. */
export const PLOT_CHARS = 180;

export interface RawItem extends PlatformCatalogItem {
    readonly container_extension?: string;
}

/** Newest first, by the field each kind dates itself with. */
export function newest(items: readonly RawItem[], kind: PlatformTitleKind, limit = CATEGORY_LIMIT): RawItem[] {
    const date = (item: RawItem) => Number(kind === 'movie' ? item.added : item.last_modified) || 0;
    return items
        .slice()
        .sort((a, b) => date(b) - date(a))
        .slice(0, limit);
}

function shortPlot(plot: string | null | undefined): string | null {
    const text = typeof plot === 'string' ? plot.replace(/\s+/g, ' ').trim() : '';
    if (text.length <= PLOT_CHARS) {
        return text || null;
    }
    const cut = text.slice(0, PLOT_CHARS);
    const space = cut.lastIndexOf(' ');
    return `${(space > PLOT_CHARS * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

function firstBackdrop(value: readonly string[] | string | null | undefined): string | null {
    const list = typeof value === 'string' ? [value] : value ?? [];
    for (const url of list) {
        if (typeof url === 'string' && /^https?:\/\//.test(url)) {
            return url;
        }
    }
    return null;
}

/** Only what the cards read: a category can list thousands of titles. */
export function compact(item: RawItem): RawItem {
    const backdrop = firstBackdrop(item.backdrop_path);
    return {
        stream_id: item.stream_id,
        series_id: item.series_id,
        name: item.name,
        stream_icon: item.stream_icon,
        cover: item.cover,
        added: item.added,
        last_modified: item.last_modified,
        genre: item.genre,
        category_ids: item.category_ids,
        rating: item.rating,
        plot: shortPlot(item.plot),
        backdrop_path: backdrop ? [backdrop] : null,
        tmdb: item.tmdb ?? item.tmdb_id,
        year: item.year,
        releaseDate: item.releaseDate ?? item.release_date,
        container_extension: item.container_extension,
    };
}

const TMDB_ROOT = 'https://image.tmdb.org/t/p/';

function shrink(url: string | null | undefined): string | undefined {
    if (!url) {
        return undefined;
    }
    return url.indexOf(TMDB_ROOT) === 0 ? `~${url.slice(TMDB_ROOT.length)}` : url;
}

function grow(url: unknown): string | undefined {
    if (typeof url !== 'string' || !url) {
        return undefined;
    }
    return url.charAt(0) === '~' ? TMDB_ROOT + url.slice(1) : url;
}

type Packed = Record<string, unknown>;

/** A compact item under one-letter keys, empty fields left out. */
export function pack(item: RawItem, kind: PlatformTitleKind): Packed {
    const out: Packed = {
        i: kind === 'movie' ? item.stream_id : item.series_id,
        n: item.name,
        p: shrink(kind === 'movie' ? item.stream_icon : item.cover),
        a: kind === 'movie' ? item.added : item.last_modified,
        g: item.genre || undefined,
        c: item.category_ids && item.category_ids.length ? item.category_ids : undefined,
        r: item.rating || undefined,
        o: item.plot || undefined,
        b: shrink(firstBackdrop(item.backdrop_path)),
        t: item.tmdb || undefined,
        y: item.year || item.releaseDate || undefined,
        x: item.container_extension || undefined,
    };
    Object.keys(out).forEach((key) => {
        if (out[key] === undefined || out[key] === null) {
            delete out[key];
        }
    });
    return out;
}

export function unpack(packed: Packed, kind: PlatformTitleKind): RawItem {
    const image = grow(packed.p);
    const backdrop = grow(packed.b);
    const date = packed.a === undefined ? undefined : String(packed.a);
    const year = packed.y === undefined ? undefined : String(packed.y);
    return {
        stream_id: kind === 'movie' ? (packed.i as number | string) : undefined,
        series_id: kind === 'series' ? (packed.i as number | string) : undefined,
        name: typeof packed.n === 'string' ? packed.n : undefined,
        stream_icon: kind === 'movie' ? image : undefined,
        cover: kind === 'series' ? image : undefined,
        added: kind === 'movie' ? date : undefined,
        last_modified: kind === 'series' ? date : undefined,
        genre: typeof packed.g === 'string' ? packed.g : null,
        category_ids: Array.isArray(packed.c) ? (packed.c as (number | string)[]) : null,
        rating: (packed.r as number | string | undefined) ?? null,
        plot: typeof packed.o === 'string' ? packed.o : null,
        backdrop_path: backdrop ? [backdrop] : null,
        tmdb: (packed.t as number | string | undefined) ?? null,
        year: year && /^\d{4}$/.test(year) ? year : null,
        releaseDate: year && !/^\d{4}$/.test(year) ? year : null,
        container_extension: typeof packed.x === 'string' ? packed.x : undefined,
    };
}
