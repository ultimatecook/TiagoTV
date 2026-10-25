/**
 * TiagoTV keeps the content its owner watches: live channels from Spain,
 * the USA, the UK and Argentina, and movies and series in Spanish or
 * English. Providers tag each category with a country or language code:
 * "|ES| ✪ DAZN LA LIGA", "|LAT|  ✪ ARGENTINA", "|EN| ✪ ACTION".
 *
 * Careful: on these panels |AR| is Arabic, not Argentina (which sits in
 * |LAT|, next to the rest of Latin America).
 */
export type ContentKind = 'live' | 'vod' | 'series';

const KEPT_CODES: Record<ContentKind, ReadonlySet<string>> = {
    live: new Set(['ES', 'UK', 'US', 'EN']),
    vod: new Set(['ES', 'EN']),
    series: new Set(['ES', 'EN']),
};

/**
 * From Latin America, Argentina's live channels, and the region's sports
 * groups named after no country ("|LAT| ✪ DEPORTES", "|LAT| ✪ ESPN": the
 * ESPN, DSports and FOX Sports feeds Argentina watches).
 */
const ARGENTINA = /\bargentin/i;
const LATAM_SPORTS =
    /\b(deport\w*|sports?|espn\w*|direct ?tv|dsports?|futbol|f[uú]tbol|soccer|tyc|tnt)\b/i;
const OTHER_LATAM_COUNTRY =
    /\b(m[eé]xic\w*|colombia\w*|chile\w*|per[uú]\w*|uruguay\w*|paraguay\w*|bolivia\w*|ecuador\w*|venezuel\w*|brasil\w*|brazil\w*|centro ?am[eé]rica\w*|caribe\w*|dominican\w*|puerto rico|costa rica|guatemala|honduras|panam[aá]|cuba|salvador|nicaragua|mx|mex|co|col|cl|chl|pe|uy|py|bo|ec|ve|br|cr|gt|hn|pa|pr)\b/i;
/** A channel's leading tag naming another country: "|MX| ESPN", "CHI FOX SPORTS". */
const OTHER_COUNTRY_TAG =
    /^\W*(mx|mex|co|col|cl|chl|chi|pe|per|uy|uru|py|par|bo|bol|ec|ecu|ve|ven|br|bra|cr|gt|hn|pa|do|pr|us|usa)\b/i;

/** A |LAT| sports group named after no country: Argentina keeps it. */
export function isLatamSportsCategory(name: string): boolean {
    return (
        categoryLanguageCode(name) === 'LAT' &&
        !ARGENTINA.test(name) &&
        LATAM_SPORTS.test(name) &&
        !OTHER_LATAM_COUNTRY.test(name)
    );
}

/** In a regional sports group, a channel of another country's ("|MX| ESPN"). */
export function isOtherLatamCountryChannel(name: string): boolean {
    return OTHER_COUNTRY_TAG.test(name) || OTHER_LATAM_COUNTRY.test(name);
}

/**
 * Groups in another language inside otherwise kept codes: Portuguese,
 * French, and the Arabic and Asian packs some panels file under |UK|.
 */
const OTHER_LANGUAGE =
    /\b(brazil|brasil|quebec\w*|portug\w*|arabic|asia)\b|\bbr\s/i;

/** The leading "|XX|" code of a category name, upper-cased. */
export function categoryLanguageCode(name: string): string | null {
    const match = /^\s*\|\s*([A-Za-z]{2,5})\s*\|/.exec(name);
    return match ? match[1].toUpperCase() : null;
}

export function isSpanishOrEnglishCategory(
    name: string,
    kind: ContentKind
): boolean {
    const code = categoryLanguageCode(name);
    if (code === 'LAT') {
        return (
            kind === 'live' &&
            (ARGENTINA.test(name) || isLatamSportsCategory(name))
        );
    }
    return (
        code !== null &&
        KEPT_CODES[kind].has(code) &&
        !OTHER_LANGUAGE.test(name)
    );
}

/** The provider's code in front of a name: "|ES| ", "|LAT|  ". */
const LEADING_CODE = /^\s*\|[^|]{1,12}\|\s*/;
/** The decoration after it: "✪ ", "★ ". */
const LEADING_MARKS = /^[\s✪★☆•●◆✦]+/;

/**
 * A category's own name, without the provider's code and decoration:
 * "|ES| ✪ DAZN LA LIGA" → "DAZN LA LIGA", "|LAT|  ✪ ARGENTINA" →
 * "ARGENTINA". A name that is nothing else is returned as it came.
 */
export function cleanCategoryName(name: string): string {
    const clean = name
        .replace(LEADING_CODE, '')
        .replace(LEADING_MARKS, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    return clean || name.trim();
}

/**
 * The labels of a category list, in order: each clean name, with the code
 * after it where two categories would otherwise read the same
 * ("|UK| ✪ MUSIC", "|US| ✪ MUSIC" → "MUSIC · UK", "MUSIC · US").
 */
export function categoryDisplayLabels(names: readonly string[]): string[] {
    const labels = names.map(cleanCategoryName);
    const namesByLabel = new Map<string, Set<string>>();
    labels.forEach((label, index) => {
        const key = label.toLowerCase();
        const same = namesByLabel.get(key) ?? new Set<string>();
        same.add(names[index]);
        namesByLabel.set(key, same);
    });
    return labels.map((label, index) => {
        const code = categoryLanguageCode(names[index]);
        const clashes = (namesByLabel.get(label.toLowerCase())?.size ?? 0) > 1;
        return code && clashes ? `${label} · ${code}` : label;
    });
}

/** One category's label among `names`, as {@link categoryDisplayLabels}. */
export function categoryDisplayLabel(
    name: string,
    names: readonly string[]
): string {
    const index = names.indexOf(name);
    return index === -1
        ? cleanCategoryName(name)
        : categoryDisplayLabels(names)[index];
}
