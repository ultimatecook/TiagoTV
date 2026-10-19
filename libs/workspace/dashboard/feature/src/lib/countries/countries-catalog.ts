import {
    categoryLanguageCode,
    isSpanishOrEnglishCategory,
} from '@iptvnator/shared/interfaces';
import {
    COUNTRIES,
    countryOfCategory,
    normalizeName,
    type CountryDefinition,
} from './countries';
import {
    groupCountryChannels,
    type CountryChannelInput,
} from './country-channels';
import {
    buildCountryRows,
    type FiledCategory,
    type TvRow,
} from './country-rows';
import { isEmptySlot } from './country-slots';

/**
 * The source's live catalog as "En vivo" shows it: Argentina, Spain,
 * the United Kingdom and the United States, each with its rows (see
 * country-rows), each row with its channels (copies together).
 */
export interface CountriesCatalogCategory {
    readonly category_id: string | number;
    readonly category_name: string;
}

export interface CountriesCatalogStream {
    readonly stream_id: number | string;
    readonly name: string;
    readonly stream_icon?: string | null;
    readonly category_id: string | number | null;
    readonly is_adult?: number | string | null;
}

export interface TvCountry {
    readonly definition: CountryDefinition;
    readonly rows: readonly TvRow[];
    readonly channelCount: number;
}

interface FilingCategory {
    readonly country: CountryDefinition;
    readonly irish: boolean;
    readonly label: string | null;
    readonly inputs: CountryChannelInput[];
}

export function buildCountriesTv(
    categories: readonly CountriesCatalogCategory[],
    streams: readonly CountriesCatalogStream[],
    now = new Date()
): TvCountry[] {
    const filed = new Map<string, FilingCategory>();
    for (const category of categories) {
        const name = category.category_name;
        if (!isSpanishOrEnglishCategory(name, 'live')) {
            continue;
        }
        const place = countryOfCategory(categoryLanguageCode(name), name);
        if (place) {
            filed.set(String(category.category_id), {
                ...place,
                label: categoryLabel(name, place.country),
                inputs: [],
            });
        }
    }

    for (const stream of streams) {
        const categoryId = String(stream.category_id ?? '');
        const category = filed.get(categoryId);
        const streamId = Number(stream.stream_id);
        if (
            !category ||
            !Number.isFinite(streamId) ||
            Number(stream.is_adult) === 1 ||
            isEmptySlot(stream.name, category.label, now)
        ) {
            continue;
        }
        category.inputs.push({
            streamId,
            categoryId,
            name: stream.name,
            icon: stream.stream_icon || null,
        });
    }

    const byCountry = new Map<string, FiledCategory[]>();
    filed.forEach((category, id) => {
        const channels = groupCountryChannels(
            category.inputs,
            category.country.codes
        );
        if (channels.length === 0) {
            return;
        }
        const list = byCountry.get(category.country.id) ?? [];
        list.push({
            id,
            label: category.label,
            irish: category.irish,
            channels,
        });
        byCountry.set(category.country.id, list);
    });

    const countries: TvCountry[] = [];
    for (const definition of COUNTRIES) {
        const rows = buildCountryRows(
            definition,
            byCountry.get(definition.id) ?? []
        );
        if (rows.length > 0) {
            countries.push({
                definition,
                rows,
                channelCount: rows.reduce(
                    (sum, row) => sum + row.channels.length,
                    0
                ),
            });
        }
    }
    return countries;
}

/** "ᵁᴴᴰ/ᴴᴰ": quality badges, alone or paired. */
const SUPERSCRIPT_BADGES = /[ʰ-˿ᴬ-ᶿ⁰-₟]+(?:\/[ʰ-˿ᴬ-ᶿ⁰-₟]+)*/g;
/** Provider spellings, fixed (on the upper-case name, without accents). */
const FIXES: readonly [RegExp, string][] = [
    [/\bLIGA PROFESIONAL FOT\b/, 'LIGA PROFESIONAL'],
    [/\bMOTO GP\b/, 'MOTOGP'],
    [/\bAUTONOMICOS\b/, 'AUTONÓMICOS'],
    [/^M LCAMPEON$/, 'M+ LIGA DE CAMPEONES'],
    [/^OXING\b/, 'BOXING'],
    [/\bCARRIBEAN\b/, 'CARIBBEAN'],
    [/\bENTERTENIMIENTO\b/, 'ENTRETENIMIENTO'],
    [/\bNINOS\b/, 'NIÑOS'],
    [/\bCH$/, 'CHANNELS'],
];

/** Words written their brand's way. */
const WORDS: Record<string, string> = {
    BEIN: 'beIN',
    LALIGA: 'LaLiga',
    'LALIGA+': 'LaLiga+',
    METV: 'MeTV',
    MOTOGP: 'MotoGP',
    VIX: 'ViX',
    'DISCOVERY+': 'Discovery+',
};
/** Words kept in capitals: acronyms and channel names. */
const ACRONYMS =
    /^(DAZN|NBA|WNBA|ACB|BBC|PPV|UFC|WWE|NFL|MLB|NHL|MLS|TNT|UEFA|PDC|RFEF|2RFEF|TUDN|ABC|CBS|NBC|PBS|FOX|TV|EC|UK|US|HD|SD|UHD|FHD|4K|F1|GP|M\+|24\/7)$/;
const SMALL_WORDS = /^(DE|DEL|Y|EN|OF|THE|AND|OR)$/;

/**
 * "|ES| ✪ DAZN LA LIGA" → "DAZN La Liga"; "|LAT|  ✪ ARGENTINA LIGA
 * PROFESIONAL FOT" → "Liga Profesional"; the country's own group
 * ("|LAT|  ✪ ARGENTINA", "|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ", "|UK| ✪ UK ᵁᴴᴰ/ᴴᴰ") → null.
 */
export function categoryLabel(
    name: string,
    country: CountryDefinition
): string | null {
    let label = normalizeName(name)
        .replace(/^\s*\|[^|]*\|\s*/, '')
        .replace(/[✪★•]/g, ' ')
        .replace(SUPERSCRIPT_BADGES, ' ')
        .replace(/\s*\|\s*/g, ' / ');
    if (country.ownName) {
        label = label.replace(country.ownName, ' ');
    }
    label = label.replace(/\s+/g, ' ').replace(/^[\s|:-]+|[\s|:-]+$/g, '');
    for (const [pattern, fixed] of FIXES) {
        label = label.replace(pattern, fixed);
    }
    if (!label) {
        return null;
    }
    return label
        .split(' ')
        .map((word, index) => {
            if (WORDS[word]) {
                return WORDS[word];
            }
            if (ACRONYMS.test(word)) {
                return word;
            }
            const lower = word.toLowerCase();
            return index > 0 && SMALL_WORDS.test(word)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}
