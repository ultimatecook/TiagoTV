/**
 * TiagoTV sports sections: the Home's "Deportes" cards and what each one
 * gathers from the active source's live channels.
 *
 * A channel belongs to a section through its category ("|ES| ✪ DAZN LA
 * LIGA"), its own name ("|UK| SKY SPORTS PREMIER LEAGUE"), or, for event
 * channels, the competition of the match it carries ("Live | … | Premier
 * League | ES"). Competition rules are anchored so lookalikes stay out:
 * "Premier League - Lebanon", "Ligue 1 - Burkina Faso", "Frauen-Bundesliga".
 */
export type SportSectionId =
    | 'premier-league'
    | 'laliga'
    | 'tennis'
    | 'motor'
    | 'serie-a'
    | 'ligue-1'
    | 'bundesliga'
    | 'champions-league';

export interface SportSection {
    readonly id: SportSectionId;
    readonly title: string;
    /** Remote artwork: a player cut-out (PNG/WebP) or a photo. */
    readonly image: string;
    /** Cut-outs stand on the card's floor; photos fill it. */
    readonly imageFit: 'cutout' | 'photo';
    /** The card's backdrop colour behind the artwork. */
    readonly tint: string;
    readonly category: RegExp | null;
    readonly channel: RegExp | null;
    readonly competition: RegExp;
}

/**
 * Event slots named in another shape ("EC-DAZN 5: ABN AMRO Open | … | Sat
 * 08 Feb") keep the name of an old event: their name says nothing now.
 */
const STALE_EVENT_SLOT = /^\s*EC-DAZN\s*\d+\s*:/i;

/** Women's, youth and lower divisions share names with the top flights. */
const NOT_TOP_FLIGHT =
    /\b(women|femen\w*|femmin\w*|f[ée]minin\w*|frauen|liga f|u-?\d{2}|youth|qualif\w*|basket\w*|a2\b)/i;

export const SPORT_SECTIONS: readonly SportSection[] = [
    {
        id: 'premier-league',
        title: 'Premier League',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250103758.webp',
        imageFit: 'cutout',
        tint: '#3d185a',
        category: /premier league/i,
        channel: /premier league\b(?!\s*-)/i,
        competition: /^premier league$/i,
    },
    {
        id: 'laliga',
        title: 'La Liga',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250076574.webp',
        imageFit: 'cutout',
        tint: '#5c1420',
        category: /la ?liga/i,
        channel: /la ?liga|dazn liga|hypermotion/i,
        competition: /^(spanish )?la ?liga( ea sports| hypermotion)?$/i,
    },
    {
        id: 'tennis',
        title: 'Tenis',
        image: 'https://media.cnn.com/api/v1/images/stellar/prod/gettyimages-2292036131.jpg?q=w_1110,c_fill',
        imageFit: 'photo',
        tint: '#2f4a1c',
        category: /tennis|tenis|roland/i,
        channel: /tennis|tenis|\batp\b|\bwta\b/i,
        competition:
            /\b(atp|wta|itf|tennis|tenis|roland|wimbledon|us open|australian open|davis cup|billie jean)\b/i,
    },
    {
        id: 'motor',
        title: 'Motor',
        image: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
        imageFit: 'cutout',
        tint: '#123a5c',
        category: /formula ?1|moto ?gp/i,
        channel: /formula ?1|\bf1\b|moto ?gp/i,
        competition:
            /formula ?[1e]|\bf1\b|moto ?(gp|2|3)|nascar|indycar|world endurance|\bwec\b|superbike|\bwsbk\b|\bdtm\b|\brally|\btcr\b/i,
    },
    {
        id: 'serie-a',
        title: 'Serie A',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250118281.webp',
        imageFit: 'cutout',
        tint: '#0e2f5a',
        category: /serie a\b/i,
        channel: /serie a\b/i,
        competition: /^serie a( enilive)?$/i,
    },
    {
        id: 'ligue-1',
        title: 'Ligue 1',
        image: 'https://media.psg.fr/image/upload/v1782835005/Dembele-Motion-2627_muowar.png',
        imageFit: 'cutout',
        tint: '#16244f',
        category: null,
        channel: /ligue ?1\b(?!\s*-)/i,
        competition: /^ligue ?1\+?$/i,
    },
    {
        id: 'bundesliga',
        title: 'Bundesliga',
        image: 'https://talksport.com/wp-content/uploads/2026/01/harry-kane-fc-bayern-munich-1050872301.jpg?strip=all&quality=50&w=1080&h=1080&crop=1',
        imageFit: 'photo',
        tint: '#5a1414',
        category: /bundesliga/i,
        channel: /bundesliga/i,
        competition: /^bundesliga$/i,
    },
    {
        id: 'champions-league',
        title: 'Champions League',
        image: 'https://www.bitbol.co/files/image/70/70083/64d27b3fe3f36.png',
        imageFit: 'cutout',
        tint: '#0b1d4d',
        category: /champions|lcampeon/i,
        channel: /champions league|lcampeon|liga de campeones/i,
        competition: /champions league|liga de campeones/i,
    },
];

export function findSportSection(id: string): SportSection | null {
    return SPORT_SECTIONS.find((section) => section.id === id) ?? null;
}

/** The section of an event's competition, if it is one the Home follows. */
export function sectionForCompetition(
    competition: string
): SportSection | null {
    if (NOT_TOP_FLIGHT.test(competition)) {
        return null;
    }
    return (
        SPORT_SECTIONS.find((section) =>
            section.competition.test(competition.trim())
        ) ?? null
    );
}

/** Whether a 24/7 channel or an event slot belongs to the section. */
export function channelInSection(
    section: SportSection,
    channelName: string,
    categoryName: string
): boolean {
    if (
        NOT_TOP_FLIGHT.test(channelName) ||
        STALE_EVENT_SLOT.test(channelName)
    ) {
        return false;
    }
    return (
        (section.category?.test(categoryName) ?? false) ||
        (section.channel?.test(channelName) ?? false)
    );
}
