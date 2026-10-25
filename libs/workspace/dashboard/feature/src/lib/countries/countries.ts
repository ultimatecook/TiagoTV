import { isLatamSportsCategory } from '@iptvnator/shared/interfaces';

/**
 * TiagoTV's "En vivo": the countries whose live channels the language
 * filter keeps (`isSpanishOrEnglishCategory`), in the page's order:
 * Argentina, Spain, the United Kingdom (Ireland folded in) and the United
 * States. Providers file most countries under their code ("|ES| ✪ DAZN LA
 * LIGA", "|UK| ✪ NEWS") and Argentina inside |LAT|, by name ("|LAT|  ✪
 * ARGENTINA").
 *
 * Careful: on these panels |AR| is Arabic, not Argentina.
 *
 * The flags are flag-icons' (MIT, see assets/flags/LICENSE), bundled.
 */
export interface CountryDefinition {
    /** The route's id: the ISO code in lower case. */
    readonly id: string;
    readonly nameKey: string;
    /** The bundled flag. */
    readonly flag: string;
    /** Its own name inside its categories' names, dropped from the label. */
    readonly ownName?: RegExp;
    /** Codes its channel names carry: "|ARG| C5N", "ES BBC Drama". */
    readonly codes: readonly string[];
    /**
     * Its flagship channels, first in its main row in this order (whole
     * names, in lower case without accents).
     */
    readonly leading?: readonly RegExp[];
}

const FLAGS = './assets/flags/';
const NAMES = 'WORKSPACE.COUNTRIES.NAMES';

function country(
    id: string,
    codes: readonly string[],
    ownName: RegExp,
    leading: readonly RegExp[] = []
): CountryDefinition {
    return {
        id,
        nameKey: `${NAMES}.${id.toUpperCase()}`,
        flag: `${FLAGS}${id}.svg`,
        ownName,
        codes,
        leading,
    };
}

/** The page's order. */
export const COUNTRIES: readonly CountryDefinition[] = [
    country('ar', ['ARGENT', 'ARG', 'AR'], /\bARGENTINA\b/, [
        /^telefe$/,
        /^(el ?trece|canal 13)$/,
        /^america( tv)?$/,
        /^tv publica$/,
        /^(el ?nueve|canal 9)$/,
        /^net tv$/,
    ]),
    country('es', ['ESP', 'ES'], /\bSPAINS?\b/, [
        /^la 1$/,
        /^la 2$/,
        /^antena 3$/,
        /^cuatro$/,
        /^telecinco$/,
        /^la ?sexta$/,
    ]),
    country('gb', ['UK', 'GB', 'IRL', 'IE'], /\bUK\b/, [
        /^bbc (one|1)$/,
        /^bbc (two|2)$/,
        /^itv ?1$/,
        /^channel 4$/,
        /^channel 5$/,
    ]),
    country('us', ['USA', 'US'], /\bUSA?\b/, [
        /^abc$/,
        /^cbs$/,
        /^nbc$/,
        /^fox$/,
        /^pbs$/,
        /^(the )?cw$/,
    ]),
];

/** Ireland's groups, filed under |UK|: they join the United Kingdom. */
const IRELAND = /\bIRELAND\b/;

/** Old routes (`/workspace/countries/ie`) that now open another country. */
const ALIASES: Record<string, string> = { ie: 'gb' };

/** Upper case without accents, for matching a category's name. */
export function normalizeName(name: string): string {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/** Where a live category is filed, and whether it is one of Ireland's. */
export interface CategoryCountry {
    readonly country: CountryDefinition;
    readonly irish: boolean;
    /** A |LAT| sports group: its channels of other countries stay out. */
    readonly regional?: boolean;
}

/**
 * The country a kept live category belongs to, by its code, and for |LAT|
 * by the country its name holds (its sports groups named after no country
 * go to Argentina). Null for a category filed nowhere (|EN|, the rest of
 * Latin America).
 */
export function countryOfCategory(
    code: string | null,
    name: string
): CategoryCountry | null {
    const normalized = normalizeName(name);
    switch (code) {
        case 'LAT':
            if (/\bARGENTIN/.test(normalized)) {
                return { country: byId('ar'), irish: false };
            }
            // The region's sports groups named after no country.
            return isLatamSportsCategory(name)
                ? { country: byId('ar'), irish: false, regional: true }
                : null;
        case 'ES':
            return { country: byId('es'), irish: false };
        case 'UK':
            return { country: byId('gb'), irish: IRELAND.test(normalized) };
        case 'US':
            return { country: byId('us'), irish: false };
        default:
            return null;
    }
}

/** A route's country (`ar`, `es`, `gb`, `us`; `ie` opens `gb`). */
export function findCountryDefinition(id: string): CountryDefinition | null {
    const key = ALIASES[id] ?? id;
    return COUNTRIES.find((country) => country.id === key) ?? null;
}

function byId(id: string): CountryDefinition {
    return findCountryDefinition(id) as CountryDefinition;
}
