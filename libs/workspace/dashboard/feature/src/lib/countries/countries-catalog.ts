import {
    categoryLanguageCode,
    isSpanishOrEnglishCategory,
} from '@iptvnator/shared/interfaces';
import { isIdleEventChannel, isStaleSlot } from '../sports/sport-events';
import { cleanChannelTitle } from '../sports/sports-catalog';
import {
    COUNTRIES,
    COUNTRY_REGIONS,
    countryOfCategory,
    normalizeName,
    type CountryDefinition,
    type CountryRegionDefinition,
} from './countries';
import {
    groupCountryChannels,
    type CountryChannelGroup,
    type CountryChannelInput,
} from './country-channels';

/**
 * The source's live catalog by country (see countries): each country with
 * its categories, each category with its channels (copies together).
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

export interface CountryCategory {
    readonly id: string;
    /** A readable name; null for the country's general group. */
    readonly label: string | null;
    readonly channels: readonly CountryChannelGroup[];
}

export interface Country {
    readonly definition: CountryDefinition;
    /**
     * The group its page opens on first (see defaultCategory), then the
     * general group, then the provider's order.
     */
    readonly categories: readonly CountryCategory[];
    readonly channelCount: number;
}

export interface CountryRegion {
    readonly definition: CountryRegionDefinition;
    readonly countries: readonly Country[];
}

export function buildCountriesCatalog(
    categories: readonly CountriesCatalogCategory[],
    streams: readonly CountriesCatalogStream[],
    now = new Date()
): CountryRegion[] {
    const filed = new Map<
        string,
        {
            country: CountryDefinition;
            name: string;
            inputs: CountryChannelInput[];
        }
    >();
    for (const category of categories) {
        const name = category.category_name;
        if (!isSpanishOrEnglishCategory(name, 'live')) {
            continue;
        }
        const country = countryOfCategory(categoryLanguageCode(name), name);
        if (country) {
            filed.set(String(category.category_id), {
                country,
                name,
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
            isIdleEventChannel(stream.name) ||
            isStaleSlot(cleanChannelTitle(stream.name), now)
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

    const byCountry = new Map<string, CountryCategory[]>();
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
            label: categoryLabel(category.name, category.country),
            channels,
        });
        byCountry.set(category.country.id, list);
    });

    return COUNTRY_REGIONS.map((region) => ({
        definition: region,
        countries: COUNTRIES.filter(
            (country) =>
                country.region === region.id && byCountry.has(country.id)
        ).map((country) => {
            const list = byCountry.get(country.id) as CountryCategory[];
            return {
                definition: country,
                categories: openingFirst([
                    ...list.filter((category) => category.label === null),
                    ...list.filter((category) => category.label !== null),
                ]),
                channelCount: list.reduce(
                    (sum, category) => sum + category.channels.length,
                    0
                ),
            };
        }),
    })).filter((region) => region.countries.length > 0);
}

export function findCountry(
    regions: readonly CountryRegion[],
    id: string
): Country | null {
    for (const region of regions) {
        const found = region.countries.find(
            (country) => country.definition.id === id
        );
        if (found) {
            return found;
        }
    }
    return null;
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
 * ("|LAT| ✪ CHILE", "|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ", "|LAT| ✪ GENERAL") → null.
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

/** A general group this small is a leftover, not the country's channels. */
const MIN_GENERAL = 8;
const MAIN_CHANNELS = /\b(entertainment|entretenimiento|english)\b/i;

/**
 * The group a country's page opens on: its general group, else its main
 * channels ("Entertainment", "English Channels"), else its largest.
 */
export function defaultCategory(
    categories: readonly CountryCategory[]
): CountryCategory | null {
    const general = categories.find((category) => category.label === null);
    if (general && general.channels.length >= MIN_GENERAL) {
        return general;
    }
    return (
        categories.find((category) =>
            MAIN_CHANNELS.test(category.label ?? '')
        ) ??
        [...categories].sort(
            (a, b) => b.channels.length - a.channels.length
        )[0] ??
        null
    );
}

/** The group a page opens on first, the rest in the provider's order. */
function openingFirst(categories: CountryCategory[]): CountryCategory[] {
    const opening = defaultCategory(categories);
    return opening
        ? [opening, ...categories.filter((category) => category !== opening)]
        : categories;
}
