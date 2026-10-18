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
    | 'champions-league'
    | 'basketball';

export interface SportSection {
    readonly id: SportSectionId;
    readonly title: string;
    /** A player cut-out (transparent PNG/WebP), remote or bundled. */
    readonly image: string;
    /**
     * The cut-out's height in card heights, chosen so every head looks
     * the same size (the files frame their players from the waist or
     * whole); the card shows its top, the rest is cut at the floor.
     */
    readonly artHeight: number;
    /** The transparent share of the file above the head. */
    readonly artHeadroom: number;
    /** Where the cut-out's centre sits across the card, in %. */
    readonly artX: number;
    /** The competition's logo in white, shown instead of its name. */
    readonly logo: string | null;
    /** The logo's size against the others, so they look even. */
    readonly logoSize: number;
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
    /\b(women|femen\w*|femmin\w*|f[ée]minin\w*|frauen|liga f|u-?\d{2}|youth|qualif\w*|a2\b)/i;

/**
 * Basketball shares competition names with football too ("Basketball
 * Champions League", "Basketball Bundesliga"): only its own card takes it.
 */
const BASKETBALL = /basket\w*|baloncesto/i;

export const SPORT_SECTIONS: readonly SportSection[] = [
    {
        id: 'premier-league',
        title: 'Premier League',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250103758.webp',
        artHeight: 1.38,
        artHeadroom: 0.094,
        artX: 50,
        logo: './assets/sports/logos/premier-league.svg',
        logoSize: 1.1,
        tint: '#3d185a',
        category: /premier league/i,
        channel: /premier league\b(?!\s*-)/i,
        competition: /^premier league$/i,
    },
    {
        id: 'laliga',
        title: 'La Liga',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250076574.webp',
        artHeight: 1.23,
        artHeadroom: 0.094,
        artX: 50,
        logo: './assets/sports/logos/laliga.png',
        logoSize: 0.95,
        tint: '#5c1420',
        category: /la ?liga/i,
        channel: /la ?liga|dazn liga|hypermotion/i,
        competition: /^(spanish )?la ?liga( ea sports| hypermotion)?$/i,
    },
    {
        id: 'tennis',
        title: 'Tenis',
        image: './assets/sports/tennis.webp',
        artHeight: 1.17,
        artHeadroom: 0,
        artX: 50,
        logo: './assets/sports/logos/tennis.png',
        logoSize: 0.82,
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
        artHeight: 2.84,
        artHeadroom: 0.01,
        artX: 49,
        logo: './assets/sports/logos/motor.png',
        logoSize: 0.55,
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
        artHeight: 1.23,
        artHeadroom: 0.089,
        artX: 50,
        logo: './assets/sports/logos/serie-a.png',
        logoSize: 1.05,
        tint: '#0e2f5a',
        category: /serie a\b/i,
        channel: /serie a\b/i,
        competition: /^serie a( enilive)?$/i,
    },
    {
        id: 'ligue-1',
        title: 'Ligue 1',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250066886.webp',
        artHeight: 1.45,
        artHeadroom: 0.036,
        artX: 49,
        logo: './assets/sports/logos/ligue-1.png',
        logoSize: 1.1,
        tint: '#16244f',
        category: null,
        channel: /ligue ?1\b(?!\s*-)/i,
        competition: /^ligue ?1\+?$/i,
    },
    {
        id: 'bundesliga',
        title: 'Bundesliga',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250016833.webp',
        artHeight: 1.16,
        artHeadroom: 0.049,
        artX: 48,
        logo: './assets/sports/logos/bundesliga.png',
        logoSize: 1.25,
        tint: '#5a1414',
        category: /bundesliga/i,
        channel: /bundesliga/i,
        competition: /^bundesliga$/i,
    },
    {
        id: 'champions-league',
        title: 'Champions League',
        image: './assets/sports/champions-league.webp',
        artHeight: 1.1,
        artHeadroom: 0,
        artX: 44,
        logo: './assets/sports/logos/champions-league.png',
        logoSize: 1.2,
        tint: '#0b1d4d',
        category: /champions|lcampeon/i,
        channel: /champions league|lcampeon|liga de campeones/i,
        competition: /champions league|liga de campeones/i,
    },
    {
        id: 'basketball',
        title: 'Básquet',
        image: './assets/sports/basketball.webp',
        artHeight: 1.1,
        artHeadroom: 0,
        artX: 50,
        logo: './assets/sports/logos/basketball.png',
        logoSize: 0.8,
        tint: '#5a3412',
        category: /\bnba\b|\bacb\b|baloncesto|basket/i,
        channel: /\bnba\b|\bacb\b|baloncesto|euroleague|euroliga/i,
        competition:
            /\bnba\b|liga endesa|\bacb\b|euroleague|euroliga|eurocup|basket\w*|baloncesto/i,
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
        SPORT_SECTIONS.find(
            (section) =>
                isSectionSport(section, competition) &&
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
        STALE_EVENT_SLOT.test(channelName) ||
        !isSectionSport(section, channelName)
    ) {
        return false;
    }
    return (
        (section.category?.test(categoryName) ?? false) ||
        (section.channel?.test(channelName) ?? false)
    );
}

function isSectionSport(section: SportSection, name: string): boolean {
    return section.id === 'basketball' || !BASKETBALL.test(name);
}
