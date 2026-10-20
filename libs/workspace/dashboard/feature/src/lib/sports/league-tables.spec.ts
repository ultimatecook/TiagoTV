import {
    hasLeagueTable,
    LeagueTableResolver,
    parseEspnTable,
    parseLeagueTable,
    seasonOf,
    zoneOf,
} from './league-tables';

/** ESPN's `esp.1/standings`, three entries of it. */
const espnEntry = (
    rank: number,
    team: string,
    played: number,
    points: number,
    note: string | null
) => ({
    team: {
        displayName: team,
        logos: [
            {
                href: `https://a.espncdn.com/i/teamlogos/soccer/500/${rank}.png`,
            },
        ],
    },
    note: note ? { description: note } : undefined,
    stats: [
        { name: 'gamesPlayed', value: played },
        { name: 'points', value: points },
        { name: 'rank', value: rank },
    ],
});
const ESPN_LALIGA = {
    name: 'Spanish LALIGA',
    children: [
        {
            name: '2026-27 LALIGA',
            standings: {
                entries: [
                    espnEntry(3, 'Real Madrid', 9, 21, 'Champions League'),
                    espnEntry(1, 'Barcelona', 9, 27, 'Champions League'),
                    espnEntry(20, 'Málaga', 9, 4, 'Relegation'),
                    espnEntry(8, 'Celta Vigo', 9, 11, null),
                ],
            },
        },
    ],
};

const LALIGA = {
    table: [
        {
            intRank: '2',
            strTeam: 'Atlético Madrid',
            strBadge: 'https://badges.test/atm.png',
            intPlayed: '9',
            intPoints: '22',
            strForm: 'WWWWW',
            strDescription: 'Promotion - Champions League (League phase)',
            strGroup: 'Primera División',
        },
        {
            intRank: '1',
            strTeam: 'Barcelona',
            strBadge: 'https://badges.test/fcb.png',
            intPlayed: '9',
            intPoints: '27',
            strForm: 'wwdlw',
            strDescription: 'Promotion - Champions League (League phase)',
            strGroup: 'Primera División',
        },
        {
            intRank: '5',
            strTeam: 'Real Sociedad',
            strBadge: null,
            intPlayed: '8',
            intPoints: '16',
            strForm: '',
            strDescription: 'Promotion - Europa League (League phase)',
            strGroup: 'Primera División',
        },
    ],
};

describe('league tables', () => {
    it('knows which competitions have a table', () => {
        expect(hasLeagueTable('laliga')).toBe(true);
        expect(hasLeagueTable('premier-league')).toBe(true);
        expect(hasLeagueTable('rest-of-world')).toBe(false);
        expect(hasLeagueTable('tennis')).toBe(false);
        expect(hasLeagueTable('basketball')).toBe(false);
    });

    it('names the season under way', () => {
        expect(seasonOf('laliga', new Date(2026, 9, 19))).toBe('2026-2027');
        expect(seasonOf('laliga', new Date(2027, 2, 1))).toBe('2026-2027');
        expect(seasonOf('liga-argentina', new Date(2026, 9, 19))).toBe('2026');
        expect(seasonOf('mls', new Date(2026, 1, 1))).toBe('2026');
        expect(seasonOf('tennis', new Date())).toBeNull();
    });

    it('reads the zone from the row description', () => {
        const zones = (...notes: string[]) => notes.map(zoneOf);
        expect(
            zones(
                'Promotion - Champions League (League phase)',
                'Champions League',
                'Champions League qualifying'
            )
        ).toEqual(['champions', 'champions', 'champions']);
        expect(
            zones(
                'Promotion - Europa League (League phase)',
                'Conference League qualifying',
                'Qualifies for Sudamericana KO Playoffs'
            )
        ).toEqual(['europe', 'europe', 'europe']);
        expect(
            zones(
                'Promotion',
                'Promotion - La Liga',
                'Qualifies for round of 16',
                'Qualifies for MLS Cup Playoffs - Round One Best-of-3 series'
            )
        ).toEqual(['promotion', 'promotion', 'promotion', 'promotion']);
        expect(
            zones(
                'Promotion playoffs',
                'Promotion - La Liga (Play Offs)',
                'Knockout phase playoffs - seeded',
                'Qualifies for MLS Cup Playoffs - Wild Card Matches'
            )
        ).toEqual(['playoff', 'playoff', 'playoff', 'playoff']);
        expect(zones('Relegation', 'Relegated', 'Relegation playoff')).toEqual([
            'relegation',
            'relegation',
            'relegation',
        ]);
        expect(zones('Eliminated', '', '-')).toEqual([null, null, null]);
        expect(zoneOf(null)).toBeNull();
    });

    it('parses ESPN’s whole table, its zones and smaller badges', () => {
        const table = parseEspnTable(ESPN_LALIGA);

        expect(table?.round).toBe(9);
        expect(table?.group).toBeNull();
        expect(
            table?.rows.map((row) => [row.rank, row.team, row.zone])
        ).toEqual([
            [1, 'Barcelona', 'champions'],
            [3, 'Real Madrid', 'champions'],
            [8, 'Celta Vigo', null],
            [20, 'Málaga', 'relegation'],
        ]);
        expect(table?.rows[0]).toEqual(
            expect.objectContaining({
                played: 9,
                points: 27,
                form: [],
                badge: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/1.png&w=48&h=48',
            })
        );
    });

    it('shows the ESPN group holding a followed team', () => {
        const groups = {
            children: [
                {
                    name: 'Group A',
                    standings: {
                        entries: [espnEntry(1, 'Estudiantes', 16, 30, null)],
                    },
                },
                {
                    name: 'Group B',
                    standings: {
                        entries: [
                            espnEntry(1, 'River Plate', 16, 31, null),
                            espnEntry(2, "Newell's Old Boys", 16, 28, null),
                        ],
                    },
                },
            ],
        };

        expect(
            parseEspnTable(groups, (team) => team.startsWith('Newell'))?.group
        ).toBe('Group B');
        expect(parseEspnTable(groups)?.group).toBe('Group A');
        // Every group stays, for the page to switch to.
        expect(
            parseEspnTable(groups)?.groups?.map((group) => [
                group.name,
                group.rows.map((row) => row.team),
            ])
        ).toEqual([
            ['Group A', ['Estudiantes']],
            ['Group B', ['River Plate', "Newell's Old Boys"]],
        ]);
        expect(parseEspnTable(groups.children[0])?.groups).toBeUndefined();
        expect(parseEspnTable({ children: [] })).toBeNull();
        expect(parseEspnTable(null)).toBeNull();
    });

    it('parses rows by rank, with form, zone and matchday', () => {
        const table = parseLeagueTable(LALIGA);

        expect(table?.round).toBe(9);
        expect(table?.group).toBeNull();
        expect(table?.rows.map((row) => row.team)).toEqual([
            'Barcelona',
            'Atlético Madrid',
            'Real Sociedad',
        ]);
        expect(table?.rows[0]).toEqual({
            rank: 1,
            team: 'Barcelona',
            badge: 'https://badges.test/fcb.png',
            played: 9,
            points: 27,
            form: ['W', 'W', 'D', 'L', 'W'],
            zone: 'champions',
        });
        expect(table?.rows[2].badge).toBeNull();
        expect(table?.rows[2].form).toEqual([]);
        expect(table?.rows[2].zone).toBe('europe');
    });

    it('answers nothing for an empty table', () => {
        expect(parseLeagueTable(null)).toBeNull();
        expect(parseLeagueTable({ table: null })).toBeNull();
        expect(parseLeagueTable({ table: [] })).toBeNull();
    });

    it('shows the group holding a followed team', () => {
        const body = {
            table: [
                { intRank: '1', strTeam: 'Estudiantes', strGroup: 'Zona A' },
                { intRank: '1', strTeam: 'River Plate', strGroup: 'Zona B' },
                {
                    intRank: '2',
                    strTeam: "Newell's Old Boys",
                    strGroup: 'Zona B',
                },
            ],
        };

        expect(
            parseLeagueTable(body, (team) => team.startsWith('Newell'))
        ).toEqual(
            expect.objectContaining({
                group: 'Zona B',
                rows: [
                    expect.objectContaining({ team: 'River Plate' }),
                    expect.objectContaining({ team: "Newell's Old Boys" }),
                ],
            })
        );
        expect(parseLeagueTable(body)?.group).toBe('Zona A');
    });

    describe('LeagueTableResolver', () => {
        const NOW = new Date(2026, 9, 19, 12).getTime();
        let storage: Map<string, string>;
        let espn: jest.Mock;
        let sportsDb: jest.Mock;

        const resolver = (now = NOW) =>
            new LeagueTableResolver({
                espn: { get: espn },
                sportsDb: { get: sportsDb },
                storage: {
                    getItem: (key) => storage.get(key) ?? null,
                    setItem: (key, value) => void storage.set(key, value),
                },
                now: () => now,
            });

        beforeEach(() => {
            storage = new Map();
            espn = jest.fn(async () => ESPN_LALIGA);
            sportsDb = jest.fn(async () => LALIGA);
        });

        it('asks ESPN once, then reads the stored answer', async () => {
            const first = await resolver().table('laliga');

            expect(espn).toHaveBeenCalledWith('esp.1/standings');
            expect(sportsDb).not.toHaveBeenCalled();
            expect(first?.rows).toHaveLength(4);

            // Another visit an hour later: no request.
            await resolver(NOW + 3600_000).table('laliga');
            expect(espn).toHaveBeenCalledTimes(1);

            // Hours later, the table is asked for again.
            await resolver(NOW + 4 * 3600_000).table('laliga');
            expect(espn).toHaveBeenCalledTimes(2);
        });

        it('maps each competition to its ESPN league', async () => {
            await resolver().table('premier-league');
            await resolver().table('liga-argentina');
            await resolver().table('libertadores');
            await resolver().table('hypermotion');
            expect(espn.mock.calls.map(([path]) => path)).toEqual([
                'eng.1/standings',
                'arg.1/standings',
                'conmebol.libertadores/standings',
                'esp.2/standings',
            ]);
        });

        it('falls back to TheSportsDB without an ESPN table, and keeps it', async () => {
            espn.mockResolvedValue({ children: [] });

            const table = await resolver().table('laliga');
            expect(sportsDb).toHaveBeenCalledWith(
                'lookuptable.php?l=4335&s=2026-2027'
            );
            expect(table?.rows[0].form).toEqual(['W', 'W', 'D', 'L', 'W']);
            await resolver(NOW + 3600_000).table('laliga');
            expect(sportsDb).toHaveBeenCalledTimes(1);
        });

        it('keeps a fallback given while ESPN failed for this session only', async () => {
            espn.mockRejectedValueOnce(new Error('503'));
            const first = resolver();

            expect((await first.table('serie-a'))?.rows).toHaveLength(3);
            await first.table('serie-a');
            expect(sportsDb).toHaveBeenCalledTimes(1);
            expect(storage.size).toBe(0);

            // The next start asks ESPN again.
            await expect(resolver().table('serie-a')).resolves.toEqual(
                expect.objectContaining({ group: null })
            );
            expect(espn).toHaveBeenCalledTimes(2);
        });

        it('keeps an empty answer, but not a failed request', async () => {
            espn.mockResolvedValue(null);
            sportsDb.mockResolvedValueOnce(null);
            await expect(
                resolver().table('champions-league')
            ).resolves.toBeNull();
            await resolver(NOW + 3600_000).table('champions-league');
            expect(espn).toHaveBeenCalledTimes(1);

            espn.mockRejectedValue(new Error('503'));
            sportsDb.mockRejectedValueOnce(new Error('429'));
            await expect(resolver().table('ligue-1')).resolves.toBeNull();
            espn.mockResolvedValue(ESPN_LALIGA);
            await expect(resolver().table('ligue-1')).resolves.not.toBeNull();
        });

        it('asks nothing for a competition without a table', async () => {
            await expect(resolver().table('tennis')).resolves.toBeNull();
            await expect(resolver().table('rest-of-world')).resolves.toBeNull();
            expect(espn).not.toHaveBeenCalled();
            expect(sportsDb).not.toHaveBeenCalled();
        });
    });
});
