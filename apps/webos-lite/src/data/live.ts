import { categoryLanguageCode, isSpanishOrEnglishCategory } from '@iptvnator/shared/interfaces';
import {
    buildCountriesTv,
    COUNTRIES,
    countryOfCategory,
    type CountriesCatalogStream,
    type CountryChannelGroup,
    type TvCountry,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { XtreamCategory, XtreamClient, XtreamLiveStream } from '../xtream/client';
import { webImage } from './images';
import { countryName } from './labels';
import { mapSettled } from './pool';

/**
 * "En vivo": the desktop app's countries (Argentina, España, Reino Unido,
 * Estados Unidos) with the same kept categories, rows and chips
 * (buildCountriesTv, countryCategories), loaded one category at a time.
 */
export interface LiveChannel {
    readonly key: string;
    /** The best copy, which plays. */
    readonly streamId: number;
    readonly title: string;
    readonly subtitle: string | null;
    readonly logo: string | null;
    readonly quality: string | null;
}

export interface LiveCountry {
    readonly id: string;
    readonly name: string;
    readonly flag: string;
}

export const LIVE_COUNTRIES: readonly LiveCountry[] = COUNTRIES.map((country) => ({
    id: country.id,
    name: countryName(country.id),
    flag: `img/flags/${country.id}.svg`,
}));

/** The kept live categories filed under the country. */
export function countryCategories(
    categories: readonly XtreamCategory[],
    countryId: string
): XtreamCategory[] {
    return categories.filter((category) => {
        const name = category.category_name;
        if (!isSpanishOrEnglishCategory(name, 'live')) {
            return false;
        }
        const place = countryOfCategory(categoryLanguageCode(name), name);
        return place !== null && place.country.id === countryId;
    });
}

/** Only what the rows read: a category can list thousands of channels. */
export function compactStream(stream: XtreamLiveStream): CountriesCatalogStream {
    return {
        stream_id: stream.stream_id,
        name: String(stream.name ?? ''),
        stream_icon: stream.stream_icon ?? null,
        category_id: stream.category_id,
        is_adult: stream.is_adult ?? null,
        added: stream.added ?? null,
    };
}

export function toLiveChannel(group: CountryChannelGroup): LiveChannel {
    return {
        key: group.key,
        streamId: group.copies[0].streamId,
        title: group.title,
        subtitle: group.subtitle,
        logo: webImage(group.icons[0]),
        quality: group.copies[0].quality,
    };
}

export interface LoadedCountry {
    readonly country: TvCountry | null;
    readonly failed: number;
    readonly total: number;
}

export async function loadCountryRows(
    client: XtreamClient,
    categories: readonly XtreamCategory[],
    countryId: string,
    onProgress?: (done: number, total: number) => void
): Promise<LoadedCountry> {
    const wanted = countryCategories(categories, countryId);
    const settled = await mapSettled(
        wanted,
        1,
        (category) => client.streams('live', category.category_id),
        onProgress
    );
    const streams: CountriesCatalogStream[] = [];
    let failed = 0;
    for (const result of settled) {
        if (!result.ok) {
            failed++;
            continue;
        }
        for (const stream of result.value) {
            streams.push(compactStream(stream));
        }
    }
    const country =
        buildCountriesTv(wanted, streams, new Date()).find((entry) => entry.definition.id === countryId) ?? null;
    return { country, failed, total: wanted.length };
}
