import {
    followedTeamOf,
    isFollowedTeam,
    MY_TEAMS,
    teamFixtures,
} from './my-teams';
import type { SportSectionId } from './sport-sections';
import type { SportMatch } from './sports-catalog';

function match(
    home: string,
    away: string,
    sectionId: SportSectionId,
    streamId = 1
): SportMatch {
    return {
        streamId,
        categoryId: '1',
        title: `${home} - ${away}`,
        icon: null,
        key: `${sectionId}|${home}|${away}`,
        keys: [],
        event: {
            status: 'next',
            title: `${home} - ${away}`,
            home,
            away,
            competition: '',
            start: null,
            country: 'ES',
        },
        sectionId,
        via: [],
    };
}

describe('my teams', () => {
    it('follows Real Madrid, Newell’s and West Ham', () => {
        expect(MY_TEAMS.map((team) => team.name)).toEqual([
            'Real Madrid',
            "Newell's Old Boys",
            'West Ham United',
        ]);
    });

    it('knows them however a feed spells them', () => {
        expect(followedTeamOf('Real Madrid CF')?.name).toBe('Real Madrid');
        expect(followedTeamOf("Newell's")?.name).toBe("Newell's Old Boys");
        expect(followedTeamOf('Newells Old Boys')?.name).toBe(
            "Newell's Old Boys"
        );
        expect(followedTeamOf('West Ham')?.name).toBe('West Ham United');
        expect(isFollowedTeam('Getafe CF')).toBe(false);
        expect(isFollowedTeam('Real Sociedad')).toBe(false);
        expect(isFollowedTeam(null)).toBe(false);
    });

    it('gives each team its first football match', () => {
        const fixtures = teamFixtures([
            match('Real Madrid', 'Barça', 'basketball', 1),
            match('Arsenal', 'West Ham', 'premier-league', 2),
            match('Getafe', 'Real Madrid', 'laliga', 3),
            match('Real Madrid', 'Juventus', 'champions-league', 4),
        ]);

        expect(
            fixtures.map((fixture) => fixture.match?.streamId ?? null)
        ).toEqual([3, null, 2]);
        expect(fixtures[1].team.sectionId).toBe('liga-argentina');
    });
});
