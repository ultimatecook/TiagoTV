/**
 * TiagoTV sports: the language (or country) of a match's feed, from its
 * category's code ("|ES|", "|UK|", "FR|"; on these panels |AR| is Arabic,
 * Argentina sits in |LAT|), with its Spanish label, its bundled flag and
 * its place in the owner's order (see match-feeds): Argentina's and
 * Spain's first, the rest of Latin America's, the English ones, then the
 * others.
 */
export interface FeedLanguage {
    readonly code: string;
    readonly label: string;
    readonly flag: string | null;
}

const lang = (
    code: string,
    label: string,
    flag: string | null = null
): FeedLanguage => ({ code, label, flag });

/** The owner's order: the groups in turn, each in its own order. */
const LANGUAGE_GROUPS: readonly (readonly FeedLanguage[])[] = [
    [lang('ARG', 'Argentina', 'ar'), lang('ES', 'España', 'es')],
    [
        lang('LAT', 'Latinoamérica'),
        lang('MX', 'México', 'mx'),
        lang('CL', 'Chile', 'cl'),
        lang('CO', 'Colombia', 'co'),
        lang('PE', 'Perú', 'pe'),
        lang('UY', 'Uruguay', 'uy'),
        lang('PY', 'Paraguay', 'py'),
        lang('EC', 'Ecuador', 'ec'),
        lang('VE', 'Venezuela', 've'),
        lang('PA', 'Panamá', 'pa'),
        lang('SV', 'El Salvador', 'sv'),
        lang('CU', 'Cuba', 'cu'),
        lang('PR', 'Puerto Rico', 'pr'),
        lang('US-ES', 'Español (EE. UU.)', 'us'),
    ],
    [
        lang('UK', 'Inglés (UK)', 'gb'),
        lang('US', 'Inglés (EE. UU.)', 'us'),
        lang('EN', 'Inglés'),
        lang('CA', 'Inglés (Canadá)', 'ca'),
        lang('AU', 'Inglés (Australia)'),
        lang('NZ', 'Inglés (Nueva Zelanda)'),
    ],
    [
        lang('PT', 'Portugués'),
        lang('BR', 'Portugués (Brasil)'),
        lang('IT', 'Italiano'),
        lang('FR', 'Francés'),
        lang('CA-FR', 'Francés (Canadá)', 'ca'),
        lang('BE', 'Bélgica'),
        lang('DE', 'Alemán'),
        lang('AT', 'Alemán (Austria)'),
        lang('SW', 'Suiza'),
        lang('NL', 'Neerlandés'),
        lang('AR', 'Árabe'),
        lang('TR', 'Turco'),
        lang('PL', 'Polaco'),
        lang('SE', 'Sueco'),
        lang('NO', 'Noruego'),
        lang('DK', 'Danés'),
        lang('FI', 'Finés'),
        lang('GR', 'Griego'),
        lang('RO', 'Rumano'),
        lang('BG', 'Búlgaro'),
        lang('CZ', 'Checo'),
        lang('HU', 'Húngaro'),
        lang('AL', 'Albanés'),
        lang('EX', 'Balcanes'),
        lang('RU', 'Ruso'),
        lang('AF', 'África'),
        lang('AS', 'Asia'),
    ],
];

export interface RankedLanguage extends FeedLanguage {
    readonly group: number;
    readonly order: number;
}

const LANGUAGES = new Map<string, RankedLanguage>();
LANGUAGE_GROUPS.forEach((group, groupIndex) =>
    group.forEach((entry) =>
        LANGUAGES.set(entry.code, {
            ...entry,
            group: groupIndex,
            order: LANGUAGES.size,
        })
    )
);
const ALIASES: Record<string, string> = { AUS: 'AU', GB: 'UK', USA: 'US' };

/** A category's code, with or without its leading bar: "FR| ✪ DAZN …". */
const CODE = /^\s*\|?\s*([A-Za-z]{2,5})\s*\|/;
/** |LAT|'s countries, by the name its categories give. */
const LATIN_AMERICA: readonly (readonly [RegExp, string])[] = [
    [/argentin/i, 'ARG'],
    [/bra[sz]il|\bbr\b/i, 'BR'],
    [/mexic/i, 'MX'],
    [/chile/i, 'CL'],
    [/colombia/i, 'CO'],
    [/peru/i, 'PE'],
    [/uruguay/i, 'UY'],
    [/paraguay/i, 'PY'],
    [/ecuador|\bec\b/i, 'EC'],
    [/venezuela/i, 'VE'],
    [/panama/i, 'PA'],
    [/salvador/i, 'SV'],
    [/cuba/i, 'CU'],
    [/puerto rico/i, 'PR'],
];

/** A feed's language, from its category's name. */
export function feedLanguage(categoryName: string): RankedLanguage {
    const code = languageCode(categoryName);
    return (
        LANGUAGES.get(code) ?? {
            ...lang(code || '?', code || '?'),
            group: LANGUAGE_GROUPS.length,
            order: LANGUAGES.size,
        }
    );
}

function languageCode(categoryName: string): string {
    const raw = CODE.exec(categoryName)?.[1].toUpperCase() ?? '';
    const code = ALIASES[raw] ?? raw;
    switch (code) {
        case 'LAT':
            return (
                LATIN_AMERICA.find(([name]) => name.test(categoryName))?.[1] ??
                'LAT'
            );
        // Some panels file Arabic and Asian packs under |UK|.
        case 'UK':
            return /arabic/i.test(categoryName)
                ? 'AR'
                : /\basia\b/i.test(categoryName)
                  ? 'AS'
                  : 'UK';
        case 'US':
            return /latino|hispan|espa[nñ]ol/i.test(categoryName)
                ? 'US-ES'
                : 'US';
        case 'CA':
            return /quebec/i.test(categoryName) ? 'CA-FR' : 'CA';
        default:
            return code;
    }
}
