import {
    categoryLanguageCode,
    isSpanishOrEnglishCategory,
} from '@iptvnator/shared/interfaces';
import { genresIn, type PlatformGenre } from './platform-genres';

/**
 * TiagoTV's streaming platforms: the Home's logo cards above "Deportes".
 * The provider files each platform's catalog as categories of its own
 * ("|ES| ✪ ORIGINAL NETFLIX", "|EN| ✪ AMAZON-PRIME"); a platform shows
 * when the source has one in Spanish or English, and its page gathers
 * them all, movies and series.
 */
export type StreamingPlatformId =
    | 'netflix'
    | 'prime-video'
    | 'hbo-max'
    | 'disney-plus'
    | 'apple-tv'
    | 'paramount-plus'
    | 'hulu'
    | 'movistar-plus'
    | 'atresplayer'
    | 'mitele'
    | 'crave';

export interface StreamingPlatform {
    readonly id: StreamingPlatformId;
    readonly name: string;
    /** The bundled logo, or null where the card writes the name. */
    readonly logo: string | null;
    /** White on the brand colour, or the logo's own colours. */
    readonly logoTone: 'white' | 'brand';
    /** The written name's colour, for platforms without a logo file. */
    readonly wordmarkColor: string;
    readonly background: string;
    /** The colour the glass takes on the platform's page. */
    readonly ambient: string;
    readonly category: RegExp;
}

const LOGOS = './assets/platforms/';

export const STREAMING_PLATFORMS: readonly StreamingPlatform[] = [
    {
        id: 'netflix',
        name: 'Netflix',
        logo: `${LOGOS}netflix.svg`,
        logoTone: 'brand',
        wordmarkColor: '#e50914',
        background:
            'radial-gradient(120% 120% at 50% 0%, #2b0a0c 0%, #050505 70%)',
        ambient: '#e50914',
        category: /netflix/i,
    },
    {
        id: 'prime-video',
        name: 'Prime Video',
        logo: `${LOGOS}prime-video.svg`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background: 'linear-gradient(140deg, #071a2b 0%, #0d4f86 100%)',
        ambient: '#1a98ff',
        category: /amazon|prime video/i,
    },
    {
        id: 'hbo-max',
        name: 'HBO Max',
        logo: `${LOGOS}hbo-max.svg`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background: 'linear-gradient(140deg, #13072e 0%, #3a1bbf 100%)',
        ambient: '#6b2bff',
        category: /\bhbo\b/i,
    },
    {
        id: 'disney-plus',
        name: 'Disney+',
        logo: `${LOGOS}disney-plus.svg`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background:
            'radial-gradient(130% 120% at 50% 100%, #0d6e8a 0%, #0b1d4a 55%, #070d24 100%)',
        ambient: '#13a3d6',
        category: /disney/i,
    },
    {
        id: 'apple-tv',
        name: 'Apple TV',
        logo: `${LOGOS}apple-tv.svg`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background: 'linear-gradient(160deg, #2a2a2c 0%, #0b0b0c 100%)',
        ambient: '#9a9aa0',
        category: /apple ?tv/i,
    },
    {
        id: 'paramount-plus',
        name: 'Paramount+',
        logo: `${LOGOS}paramount-plus.svg`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background: 'linear-gradient(140deg, #0a2a9c 0%, #0064ff 100%)',
        ambient: '#0064ff',
        category: /paramount/i,
    },
    {
        id: 'hulu',
        name: 'hulu',
        logo: `${LOGOS}hulu.svg`,
        logoTone: 'brand',
        wordmarkColor: '#1ce783',
        background: 'linear-gradient(160deg, #10161a 0%, #050708 100%)',
        ambient: '#1ce783',
        category: /\bhulu\b/i,
    },
    {
        id: 'movistar-plus',
        name: 'Movistar Plus+',
        logo: `${LOGOS}movistar-plus.png`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background: 'linear-gradient(140deg, #0b4fa0 0%, #019df4 100%)',
        ambient: '#019df4',
        category: /movistar/i,
    },
    {
        id: 'atresplayer',
        name: 'atresplayer',
        logo: `${LOGOS}atresplayer.svg`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background: 'linear-gradient(140deg, #c43c00 0%, #ff7a1a 100%)',
        ambient: '#ff6a00',
        category: /atres ?player/i,
    },
    {
        id: 'mitele',
        name: 'mitele',
        logo: `${LOGOS}mitele.svg`,
        logoTone: 'brand',
        wordmarkColor: '#fff',
        background: 'linear-gradient(140deg, #3b0a63 0%, #b0156e 100%)',
        ambient: '#c2187a',
        category: /mediaset|mitele/i,
    },
    {
        id: 'crave',
        name: 'Crave',
        logo: `${LOGOS}crave.png`,
        logoTone: 'white',
        wordmarkColor: '#fff',
        background: 'linear-gradient(140deg, #0a1f44 0%, #1f5fd1 100%)',
        ambient: '#1f6fff',
        category: /\bcrave\b/i,
    },
];

export type PlatformTitleKind = 'movie' | 'series';
export type PlatformLanguage = 'ES' | 'EN';

export interface PlatformCategory {
    readonly id: string;
    readonly kind: PlatformTitleKind;
    readonly language: PlatformLanguage;
}

export interface PlatformShelf {
    readonly platform: StreamingPlatform;
    readonly categories: readonly PlatformCategory[];
}

export interface PlatformCatalogCategory {
    readonly category_id: string | number;
    readonly category_name: string;
}

export function findStreamingPlatform(id: string): StreamingPlatform | null {
    return STREAMING_PLATFORMS.find((platform) => platform.id === id) ?? null;
}

/** Spanish for |ES| and |LAT|, English for the rest that are kept. */
export function platformLanguage(categoryName: string): PlatformLanguage {
    const code = categoryLanguageCode(categoryName);
    return code === 'ES' || code === 'LAT' ? 'ES' : 'EN';
}

/**
 * A platform category the catalog keeps: Spanish or English, or one with
 * no language code that carries several ("✪ ORIGINAL AMAZON  MULTI", the
 * provider's only Prime Video movies), shown as English.
 */
export function isKeptPlatformCategory(
    name: string,
    kind: PlatformTitleKind
): boolean {
    if (isSpanishOrEnglishCategory(name, kind === 'movie' ? 'vod' : 'series')) {
        return true;
    }
    const code = categoryLanguageCode(name);
    return (
        (code === null || code === 'MULTI') &&
        /\bmulti\b/i.test(name) &&
        STREAMING_PLATFORMS.some((platform) => platform.category.test(name))
    );
}

/** The platforms the source carries, each with its ES/EN categories. */
export function buildPlatformShelves(
    vod: readonly PlatformCatalogCategory[],
    series: readonly PlatformCatalogCategory[]
): PlatformShelf[] {
    const found = new Map<StreamingPlatformId, PlatformCategory[]>();
    const sort = (
        categories: readonly PlatformCatalogCategory[],
        kind: PlatformTitleKind
    ) => {
        for (const category of categories) {
            const name = category.category_name ?? '';
            if (!isKeptPlatformCategory(name, kind)) {
                continue;
            }
            const platform = STREAMING_PLATFORMS.find((candidate) =>
                candidate.category.test(name)
            );
            if (!platform) {
                continue;
            }
            const list = found.get(platform.id) ?? [];
            list.push({
                id: String(category.category_id),
                kind,
                language: platformLanguage(name),
            });
            found.set(platform.id, list);
        }
    };
    sort(vod, 'movie');
    sort(series, 'series');
    return STREAMING_PLATFORMS.filter((platform) => found.has(platform.id)).map(
        (platform) => ({
            platform,
            categories: found.get(platform.id) ?? [],
        })
    );
}

/**
 * The genre categories of the source ("|EN| ✪ HORROR", "|ES| ✪ COMEDIA"):
 * a title filed in one of them belongs to that genre too.
 */
export function buildGenreCategories(
    categories: readonly PlatformCatalogCategory[]
): ReadonlyMap<string, readonly PlatformGenre[]> {
    const genres = new Map<string, readonly PlatformGenre[]>();
    for (const category of categories) {
        const name = category.category_name ?? '';
        const named = genresIn(name);
        if (
            named.length > 0 &&
            !STREAMING_PLATFORMS.some((platform) =>
                platform.category.test(name)
            )
        ) {
            genres.set(String(category.category_id), named);
        }
    }
    return genres;
}
