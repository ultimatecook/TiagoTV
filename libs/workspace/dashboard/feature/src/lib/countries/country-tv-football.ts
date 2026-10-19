import type { SportSectionId } from '../sports/sport-sections';
import type { SportMatch } from '../sports/sports-catalog';

/**
 * Which channels of "En vivo" show football now, for the cards' "FÚTBOL"
 * tag: the sports catalog's live matches (an event channel names its
 * match; LaLiga's or the Premier League's own channels carry their
 * competition's), and a programme the guide has on now. Unknown stays
 * unknown: a channel nothing says anything about has no tag.
 */

/** The sections whose matches are not football. */
const NOT_FOOTBALL: ReadonlySet<SportSectionId> = new Set<SportSectionId>([
    'tennis',
    'motor',
    'basketball',
]);

/**
 * The live football matches by the streams that show them, each with
 * what the channel's card says ("LaLiga · Real Madrid – Getafe"). A
 * competition's channel with two matches on names the competition only.
 */
export function liveFootball(
    matches: readonly SportMatch[],
    isLive: (match: SportMatch) => boolean
): ReadonlyMap<number, string> {
    const own = new Map<number, string>();
    const carried = new Map<number, SportMatch[]>();
    for (const match of matches) {
        if (NOT_FOOTBALL.has(match.sectionId) || !isLive(match)) {
            continue;
        }
        if (match.via.length === 0) {
            if (!own.has(match.streamId)) {
                own.set(match.streamId, matchLabel(match));
            }
            continue;
        }
        for (const entry of match.via) {
            const streamId = entry.channel.streamId;
            carried.set(streamId, [...(carried.get(streamId) ?? []), match]);
        }
    }
    carried.forEach((list, streamId) => {
        if (!own.has(streamId)) {
            own.set(
                streamId,
                list.length === 1
                    ? matchLabel(list[0])
                    : list[0].event.competition
            );
        }
    });
    return own;
}

/** "Premier League · Leeds United – Manchester United". */
export function matchLabel(match: SportMatch): string {
    const { competition, home, away, title } = match.event;
    const fixture = home && away ? `${home} – ${away}` : title;
    return competition ? `${competition} · ${fixture}` : fixture;
}

const FOOTBALL_PROGRAMME =
    /\b(f[uú]tbol|football|soccer|laliga|la liga|premier league|champions league|liga de campeones|europa league|conference league|libertadores|sudamericana|serie a|bundesliga|ligue 1|liga profesional|primera divisi[oó]n|copa del rey|copa de la liga|fa cup|carabao cup|eredivisie|hypermotion|mls)\b/i;
/** Football that is not: the American kind, futsal, games and quizzes. */
const OTHER_FOOTBALL =
    /\b(americano|american|nfl|ncaa|college|night football|sala|playa|beach|futsal|fantasy|manager|f[uú]tbol (?:americano|sala))\b/i;

/** Whether a guide's programme is a football broadcast. */
export function isFootballProgramme(title: string): boolean {
    return FOOTBALL_PROGRAMME.test(title) && !OTHER_FOOTBALL.test(title);
}
