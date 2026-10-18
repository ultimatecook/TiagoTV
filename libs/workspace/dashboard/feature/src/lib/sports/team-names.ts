/**
 * TiagoTV sports: the provider's feeds name one club many ways — "FC
 * Séville" on the French feeds, "Sevilla FC" on the Spanish ones;
 * "Groningue" and "Groningen"; "OM" and "Marseille"; "AZ" and "AZ
 * Alkmaar". A team's key drops accents, punctuation, club affixes ("FC",
 * "RC", "SV") and founding years, and maps the known exonyms and
 * nicknames to one name; two keys are one side when one's words hold all
 * of the other's.
 */

/** Club affixes and articles that say nothing of which club it is. */
const AFFIXES = new Set(
    (
        'fc cf sc ac afc cfc cd rc rcd ca sd ud ad sco ssc ss us as sv tsg ' +
        'vfb vfl fsv bv bsc osc ogc aj rb fk sk nk if bk ik sl cp ' +
        'club calcio balompie de del la le les el the and'
    ).split(' ')
);

/**
 * Other languages' names and nicknames, by key, with the club's Spanish
 * or English name (shown when only another language's feed names it).
 */
const ALIASES: readonly (readonly [string, ...string[]])[] = [
    ['Sevilla', 'seville', 'sevilha'],
    ['Barcelona', 'barcelone', 'barca'],
    ['Athletic Club', 'athletic', 'athletic bilbao'],
    ['Atlético de Madrid', 'atletico madrid', 'atletico', 'atleti'],
    ['Celta', 'celta vigo', 'celta'],
    ['Alavés', 'deportivo alaves', 'alaves'],
    ['Real Betis', 'real betis', 'betis'],
    ['Como', 'come'],
    ['Groningen', 'groningue'],
    ['Napoli', 'naples', 'napoles'],
    ['Torino', 'turin'],
    ['Roma', 'rome'],
    ['Genoa', 'genes'],
    ['Bologna', 'bologne', 'bolonia'],
    ['Parma', 'parme'],
    ['Verona', 'hellas verona', 'hellas verone', 'verone', 'verona'],
    ['Inter', 'internazionale', 'inter milan', 'inter milano', 'inter'],
    ['Marseille', 'om', 'olympique marseille', 'marsella'],
    ['Lyon', 'ol', 'olympique lyonnais', 'lyon'],
    ['Paris Saint-Germain', 'paris saint germain', 'paris sg', 'psg'],
    ['Rennes', 'stade rennais', 'rennes'],
    ['Bayern Munich', 'bayern munich', 'bayern munchen', 'bayern'],
    ['Köln', 'cologne', 'koln', 'colonia'],
    ['Mainz', 'mayence', 'mainz'],
    ['Freiburg', 'fribourg', 'friburgo', 'freiburg'],
    ['Eintracht Frankfurt', 'eintracht francfort', 'eintracht frankfurt'],
    [
        'Mönchengladbach',
        'm gladbach',
        'gladbach',
        'monchengladbach',
        'borussia m gladbach',
        'borussia monchengladbach',
    ],
    ['Werder Bremen', 'werder breme', 'werder bremen'],
    ['Manchester United', 'man utd', 'man united', 'manchester united'],
    ['Manchester City', 'man city', 'manchester city'],
    ['Tottenham', 'tottenham hotspur', 'spurs', 'tottenham'],
    ['Wolves', 'wolverhampton wanderers', 'wolverhampton', 'wolves'],
    ['Nottingham Forest', 'nott m forest', 'nottm forest', 'nottingham'],
    ['Brighton', 'brighton hove albion', 'brighton'],
];

/** Each alias key → [the canonical key, the display name]. */
const ALIAS_KEYS = new Map<string, readonly [string, string]>();
for (const [display, ...keys] of ALIASES) {
    for (const key of keys) {
        ALIAS_KEYS.set(key, [plainWords(display), display]);
    }
}

function plainWords(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((word) => word && !AFFIXES.has(word) && !/^\d+$/.test(word))
        .join(' ');
}

/** "FC Séville" → "sevilla", "SC Cambuur" → "cambuur", "Como 1907" → "como". */
export function teamKey(name: string): string {
    const words = plainWords(name);
    return ALIAS_KEYS.get(words)?.[0] ?? words;
}

/** Whether two team keys name one side ("az" and "az alkmaar"). */
export function isSameTeam(a: string, b: string): boolean {
    if (!a || !b) {
        return false;
    }
    if (a === b) {
        return true;
    }
    const wordsA = a.split(' ');
    const wordsB = b.split(' ');
    const [few, many] =
        wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
    return few.every((word) => many.includes(word));
}

/**
 * The club's Spanish or English name for one another language spells its
 * own way ("FC Séville" → "Sevilla", "OM" → "Marseille"); any other name
 * as written.
 */
export function teamDisplayName(name: string): string {
    const alias = ALIAS_KEYS.get(plainWords(name));
    const plain = name.trim();
    return alias && plainWords(alias[1]) !== plainWords(plain)
        ? alias[1]
        : plain;
}
