import {
    SPORT_SECTIONS,
    SPORTS_ROW_ORDER,
    type SportSection,
    type SportSectionId,
} from './sport-section-list';

/**
 * TiagoTV sports sections: which of the Home's "Deportes" cards (listed
 * in sport-section-list.ts) a match or a channel belongs to.
 */
export { SPORT_SECTIONS, type SportSection, type SportSectionId };

/** The league cards, in their order (see SPORTS_ROW_ORDER). */
export const SPORTS_ROW: readonly SportSection[] = SPORTS_ROW_ORDER.map((id) =>
    SPORT_SECTIONS.find((section) => section.id === id)
).filter((section): section is SportSection => !!section);

/**
 * Event slots named in another shape ("EC-DAZN 5: ABN AMRO Open | … | Sat
 * 08 Feb") keep the name of an old event: their name says nothing now.
 */
const STALE_EVENT_SLOT = /^\s*EC-DAZN\s*\d+\s*:/i;

/** Women's, youth and lower divisions share names with the top flights. */
const NOT_TOP_FLIGHT =
    /\b(women|femen\w*|femmin\w*|f[ée]minin\w*|frauen|femra\w*|liga f\b|copa de la reina|u-?\d{2}|sub-?\d{2}|youth|qualif\w*|a2\b)/i;

/**
 * Basketball shares competition names with football too ("Basketball
 * Champions League", "Basketball Bundesliga"): only its own card takes it.
 */
const BASKETBALL = /basket\w*|baloncesto/i;

/**
 * The other sports whose events also have two sides ("Chicago Grizzlies
 * vs. Lake Erie Beacons | National Squash League"), by their competition:
 * "Resto del mundo" is football only.
 */
const NOT_FOOTBALL = new RegExp(
    [
        'basket\\w*|baloncesto|\\bnba\\b|wnba|euro(league|liga|cup)|\\bacb\\b|\\bbbl\\b|\\blnb\\b|betclic [eé]lite',
        'hockey|\\bnhl\\b|\\bkhl\\b|eishockey',
        '\\bnfl\\b|\\bncaa\\w*|college football|american football|f[uú]tbol americano|\\b[cux]fl\\b',
        'handball|balonmano|\\behf\\b|asobal|volley\\w*|voleibol|pallavolo|superlega|\\blvf\\b|credem',
        'rugby|investec|six nations|top 14|cricket|\\bipl\\b|\\bt20\\b',
        'darts?\\b|\\bpdc\\b|snooker|tennis|tenis|\\batp\\b|\\bwta\\b|padel|p[aá]del|squash|badminton',
        'golf|\\bpga\\b|cycling|ciclismo|\\buci\\b|formula|nascar|indycar|rally|superbike|\\bfi[am]\\b|grand prix',
        'boxing|boxeo|\\bpbc\\b|bkfc|\\bufc\\b|\\bmma\\b|kickboxing|fight|wrestling|\\bwwe\\b|ring magazine',
        'curling|\\bski|biathlon|athletics|atletismo|swimming|nataci[oó]n|e-?sports?|baseball|b[eé]isbol|\\bmlb\\b',
        'futsal|f[uú]tbol sala|beach soccer|f[uú]tbol playa|horse|h[ií]pica|lacrosse|netball|\\bafl\\b|chess|ajedrez',
    ].join('|'),
    'i'
);
/** Team names that say their sport: "Valencia Basket", "HC Davos". */
const NOT_FOOTBALL_SIDE =
    /basket|baloncesto|hockey|volley|voleibol|handball|balonmano|rugby|futsal/i;
/** Names that say nothing of the sport: "LA Galaxy vs. San Diego FC | all". */
const UNKNOWN_COMPETITION = /^(all|tb[ac]|general|various|varios)?$/i;

const CATCH_ALL = SPORT_SECTIONS.find((section) => section.catchAll) ?? null;

export function findSportSection(id: string): SportSection | null {
    return SPORT_SECTIONS.find((section) => section.id === id) ?? null;
}

/**
 * The section of an event's competition, if it is one the Home follows:
 * its own card, or "Resto del mundo" for any other men's senior football
 * (`title`, the match's, tells a few other sports apart).
 */
export function sectionForCompetition(
    competition: string,
    title = ''
): SportSection | null {
    const name = competition.trim();
    if (NOT_TOP_FLIGHT.test(name)) {
        return null;
    }
    const own = SPORT_SECTIONS.find(
        (section) =>
            !section.catchAll &&
            isSectionSport(section, name) &&
            section.competition.test(name)
    );
    if (own) {
        return own;
    }
    return isFootball(name, title) ? CATCH_ALL : null;
}

/** Whether a two-sided event of a competition no card follows is football. */
export function isFootball(competition: string, title = ''): boolean {
    return (
        !UNKNOWN_COMPETITION.test(competition.trim()) &&
        !NOT_FOOTBALL.test(competition) &&
        !NOT_FOOTBALL_SIDE.test(title) &&
        !NOT_TOP_FLIGHT.test(title)
    );
}

/**
 * Whether a 24/7 channel or an event slot belongs to the section. The
 * catch-all section's rule says only that it may: it takes the channels
 * no other card claims (see sports-catalog).
 */
export function channelInSection(
    section: SportSection,
    channelName: string,
    categoryName: string
): boolean {
    if (
        NOT_TOP_FLIGHT.test(channelName) ||
        STALE_EVENT_SLOT.test(channelName) ||
        (section.notChannel?.test(channelName) ?? false) ||
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
