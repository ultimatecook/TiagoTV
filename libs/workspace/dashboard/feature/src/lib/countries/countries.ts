/**
 * TiagoTV's "Por países": the countries the source's Spanish and English
 * live categories belong to. Providers file most countries under their
 * code ("|ES| ✪ DAZN LA LIGA", "|UK| ✪ NEWS", "|CA| ✪ SPORT") and Latin
 * America's inside |LAT|, by name ("|LAT|  ✪ ARGENTINA", "|LAT| ✪ MEXICO").
 * The |LAT| groups that name no country ("GENERAL", "CARRIBEAN") make up
 * the "Latinoamérica" card.
 *
 * Careful: on these panels |AR| is Arabic, not Argentina.
 *
 * The flags are flag-icons' (MIT, see assets/flags/LICENSE), bundled.
 */
export type CountryRegionId = 'europe' | 'north-america' | 'latam';

export interface CountryRegionDefinition {
    readonly id: CountryRegionId;
    readonly titleKey: string;
}

export interface CountryDefinition {
    /** The route's id: the ISO code in lower case, "latam" for the rest. */
    readonly id: string;
    readonly region: CountryRegionId;
    readonly nameKey: string;
    /** The bundled flag; null for "Latinoamérica", drawn as a mosaic. */
    readonly flag: string | null;
    /** How a |LAT| category names it (upper case, accents removed). */
    readonly names?: RegExp;
    /** Its own name inside its categories' names, dropped from the label. */
    readonly ownName?: RegExp;
    /** Codes its channel names carry: "CHL Canal 13", "PRI: WAPA". */
    readonly codes: readonly string[];
}

const FLAGS = './assets/flags/';
const NAMES = 'WORKSPACE.COUNTRIES.NAMES';

/** The page's order: Europe and North America side by side, then Latin America. */
export const COUNTRY_REGIONS: readonly CountryRegionDefinition[] = [
    { id: 'europe', titleKey: 'WORKSPACE.COUNTRIES.REGIONS.EUROPE' },
    {
        id: 'north-america',
        titleKey: 'WORKSPACE.COUNTRIES.REGIONS.NORTH_AMERICA',
    },
    { id: 'latam', titleKey: 'WORKSPACE.COUNTRIES.REGIONS.LATAM' },
];

function country(
    id: string,
    region: CountryRegionId,
    codes: readonly string[],
    match: { names?: RegExp; ownName?: RegExp } = {}
): CountryDefinition {
    return {
        id,
        region,
        nameKey: `${NAMES}.${id.toUpperCase()}`,
        flag: id === 'latam' ? null : `${FLAGS}${id}.svg`,
        names: match.names,
        ownName: match.ownName ?? match.names,
        codes,
    };
}

/** Latin America: Argentina first, then by name; its own groups last. */
const LATIN_AMERICA: readonly CountryDefinition[] = [
    country('ar', 'latam', ['ARGENT', 'ARG', 'AR'], {
        names: /\bARGENTINA\b/,
    }),
    country('bo', 'latam', ['BOL', 'BO'], { names: /\bBOLIVIA\b/ }),
    country('cl', 'latam', ['CHL', 'CHI', 'CL'], { names: /\bCHILE\b/ }),
    country('co', 'latam', ['COL', 'CO'], { names: /\bCOLOMBIA\b/ }),
    country('cr', 'latam', ['CRC', 'CR'], { names: /\bCOSTA RICA\b/ }),
    country('cu', 'latam', ['CUB', 'CU'], { names: /\bCUBA\b/ }),
    country('ec', 'latam', ['ECU', 'EC'], { names: /\bECUADOR\b/ }),
    country('sv', 'latam', ['SLV', 'SV'], { names: /\b(EL )?SALVADOR\b/ }),
    country('gt', 'latam', ['GUA', 'GT'], { names: /\bGUATEMALA\b/ }),
    country('hn', 'latam', ['HON', 'HN'], { names: /\bHONDURAS\b/ }),
    country('mx', 'latam', ['MEX', 'MX'], { names: /\bMEXICO\b/ }),
    country('ni', 'latam', ['NIC', 'NI'], { names: /\bNICARAGUA\b/ }),
    country('pa', 'latam', ['PAN', 'PA'], { names: /\bPANAMA\b/ }),
    country('py', 'latam', ['PAR', 'PY'], { names: /\bPARAGUAY\b/ }),
    country('pe', 'latam', ['PER', 'PE'], { names: /\bPERU\b/ }),
    country('pr', 'latam', ['PRI', 'PR'], { names: /\bPUERTO RICO\b/ }),
    country('do', 'latam', ['RDOM', 'DOM', 'RD'], {
        names: /\b(REP(UBLICA)?\.? )?DOMINICANA\b/,
    }),
    country('uy', 'latam', ['URU', 'UY'], { names: /\bURUGUAY\b/ }),
    country('ve', 'latam', ['VEN', 'VE'], { names: /\bVENEZUELA\b/ }),
    country('latam', 'latam', ['LATIN', 'LATAM', 'LAM', 'LAT', 'CAR'], {
        ownName: /\bGENERAL\b/,
    }),
];

export const COUNTRIES: readonly CountryDefinition[] = [
    country('es', 'europe', ['ESP', 'ES'], { ownName: /\bSPAINS?\b/ }),
    country('gb', 'europe', ['UK', 'GB'], { ownName: /\bUK\b/ }),
    country('ie', 'europe', ['IRL', 'IE'], { names: /\bIRELAND\b/ }),
    country('us', 'north-america', ['USA', 'US'], { ownName: /\bUSA?\b/ }),
    country('ca', 'north-america', ['CAN', 'CA'], { ownName: /\bCANADA\b/ }),
    ...LATIN_AMERICA,
];

/** The four flags "Latinoamérica" shows, two by two, in place of its own. */
export const LATAM_MOSAIC: readonly string[] = ['ar', 'mx', 'cl', 'co'].map(
    (id) => `${FLAGS}${id}.svg`
);

/** Upper case without accents, for matching a category's name. */
export function normalizeName(name: string): string {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/**
 * The country a live category belongs to, by its code, and for |LAT| and
 * |UK| by the country its name holds. Null for a category TiagoTV hides
 * or files nowhere (|EN|, the other languages).
 */
export function countryOfCategory(
    code: string | null,
    name: string
): CountryDefinition | null {
    const normalized = normalizeName(name);
    const byName = (region: CountryRegionId) =>
        COUNTRIES.find(
            (country) =>
                country.region === region && !!country.names?.test(normalized)
        );
    switch (code) {
        case 'ES':
            return byId('es');
        case 'US':
            return byId('us');
        case 'CA':
            return byId('ca');
        case 'UK':
            // Ireland's groups are filed under |UK|.
            return byId('ie').names?.test(normalized) ? byId('ie') : byId('gb');
        case 'LAT':
            return byName('latam') ?? byId('latam');
        default:
            return null;
    }
}

export function findCountryDefinition(id: string): CountryDefinition | null {
    return COUNTRIES.find((country) => country.id === id) ?? null;
}

function byId(id: string): CountryDefinition {
    return findCountryDefinition(id) as CountryDefinition;
}
