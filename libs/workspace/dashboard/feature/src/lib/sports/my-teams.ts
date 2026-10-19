import type { SportSectionId } from './sport-sections';
import type { SportMatch } from './sports-catalog';
import { isSameTeam, teamKey } from './team-names';

/**
 * TiagoTV's own teams ("tus equipos"): their pills on the sports hub, and
 * their names in bold wherever a match or a table lists them. The section
 * is the team's league, for its crest and when it has no match listed.
 */
export interface FollowedTeam {
    readonly name: string;
    readonly sectionId: SportSectionId;
    /** Other spellings the provider's feeds use. */
    readonly aliases?: readonly string[];
}

export const MY_TEAMS: readonly FollowedTeam[] = [
    { name: 'Real Madrid', sectionId: 'laliga' },
    {
        name: "Newell's Old Boys",
        sectionId: 'liga-argentina',
        aliases: ['Newells Old Boys', 'Newells'],
    },
    { name: 'West Ham United', sectionId: 'premier-league' },
];

/** Same-named sides of other sports (Real Madrid's basketball team). */
const OTHER_SPORTS = new Set<SportSectionId>(['basketball', 'tennis', 'motor']);

const KEYS = MY_TEAMS.map((team) =>
    [team.name, ...(team.aliases ?? [])].map(teamKey)
);

/** The followed team a side's name ("Newell's", "West Ham") names, if any. */
export function followedTeamOf(
    name: string | null | undefined
): FollowedTeam | null {
    const key = name ? teamKey(name) : '';
    if (!key) {
        return null;
    }
    const index = KEYS.findIndex((keys) =>
        keys.some((known) => isSameTeam(known, key))
    );
    return index < 0 ? null : MY_TEAMS[index];
}

export function isFollowedTeam(name: string | null | undefined): boolean {
    return followedTeamOf(name) !== null;
}

export interface TeamFixture {
    readonly team: FollowedTeam;
    /** Its first match in `matches`' order (on now first), if any. */
    readonly match: SportMatch | null;
}

/** Each followed team with its first football match of `matches`. */
export function teamFixtures(matches: readonly SportMatch[]): TeamFixture[] {
    return MY_TEAMS.map((team) => ({
        team,
        match:
            matches.find(
                (match) =>
                    !OTHER_SPORTS.has(match.sectionId) &&
                    (followedTeamOf(match.event.home) === team ||
                        followedTeamOf(match.event.away) === team)
            ) ?? null,
    }));
}
