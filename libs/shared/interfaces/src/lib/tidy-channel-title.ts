/**
 * Channel names as "En vivo"'s tiles and Mi lista's cards show them.
 * Providers write many in capitals ("TELEFE", "AMERICA TV", "LA SEXTA",
 * "FOX SPORTS 1"); those read as written by hand ("Telefe", "America TV",
 * "La Sexta", "FOX Sports 1").
 * Short words stay in capitals (TV, TN, ESPN, HBO, call signs such as
 * KARE), but for the common ones listed here; brands keep their spelling.
 * A name with any lower-case letter is left as the provider wrote it.
 */
const BRANDS: Record<string, string> = {
    BEIN: 'beIN',
    DEPORTV: 'DeporTV',
    LALIGA: 'LaLiga',
    'LALIGA+': 'LaLiga+',
    METV: 'MeTV',
    MOTOGP: 'MotoGP',
    SKY: 'Sky',
    TYC: 'TyC',
    VIX: 'ViX',
};

/** Short words that are words, not acronyms. */
const SHORT_WORDS = new Set([
    'ARTS',
    'BABY',
    'BOX',
    'CASA',
    'CINE',
    'CITY',
    'CLUB',
    'FOOD',
    'GOL',
    'GOLD',
    'HOME',
    'KIDS',
    'LIFE',
    'LIVE',
    'MAS',
    'MAX',
    'MEGA',
    'NEOX',
    'NEWS',
    'NICK',
    'NOVA',
    'ONE',
    'PLAY',
    'PLUS',
    'SAN',
    'SUR',
    'TELE',
    'TIME',
    'TWO',
    'WILD',
    'ZONE',
]);
/** Joining words, lower case inside a name. */
const LOWER_WORDS = new Set([
    'DE',
    'DEL',
    'E',
    'EL',
    'EN',
    'Y',
    'OF',
    'THE',
    'AND',
]);
/** Articles that open a name: "La Sexta", "Los 40", "El Trece". */
const ARTICLES = new Set(['LA', 'LAS', 'LOS', 'EL']);

export function tidyChannelTitle(title: string): string {
    if (/\p{Ll}/u.test(title)) {
        return title;
    }
    return title
        .split(' ')
        .map((word, index) => tidyWord(word, index === 0))
        .join(' ');
}

function tidyWord(word: string, first: boolean): string {
    const brand = BRANDS[word];
    if (brand) {
        return brand;
    }
    const letters = word.replace(/[^\p{L}]/gu, '');
    if (!letters || /\d/.test(word)) {
        return word;
    }
    if (ARTICLES.has(letters) || LOWER_WORDS.has(letters)) {
        return first ? capitalize(word) : word.toLowerCase();
    }
    if (letters.length <= 4 && !SHORT_WORDS.has(letters)) {
        return word;
    }
    return capitalize(word);
}

/** "[SAN" → "[San", "SCI-FI" → "Sci-fi". */
function capitalize(word: string): string {
    return word
        .toLowerCase()
        .replace(/\p{L}/u, (letter) => letter.toUpperCase());
}
