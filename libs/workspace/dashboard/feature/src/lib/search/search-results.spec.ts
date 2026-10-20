import type { TvCountry } from '../countries/countries-catalog';
import type { SportSectionId } from '../sports/sport-sections';
import type { SportMatch } from '../sports/sports-catalog';
import {
    catalogQuery,
    findChannels,
    findTeams,
    foldTerm,
    languageFilter,
    matchRank,
    teamMatchToday,
    toTitleHits,
    type TeamHit,
} from './search-results';

function match(
    home: string,
    away: string,
    sectionId: SportSectionId = 'laliga',
    start: Date | null = null
): SportMatch {
    return {
        streamId: 1,
        categoryId: '10',
        title: `${home} - ${away}`,
        icon: null,
        key: `${sectionId}:${home}:${away}`,
        keys: [],
        sectionId,
        via: [],
        event: {
            status: start ? 'next' : 'live',
            title: `${home} - ${away}`,
            home,
            away,
            competition: 'LaLiga',
            start,
            country: 'ES',
        },
    } as SportMatch;
}

describe('search results', () => {
    describe('foldTerm / matchRank', () => {
        it('ignores case, accents and apostrophes', () => {
            expect(foldTerm('  Atlético  de Madrid ')).toBe(
                'atletico de madrid'
            );
            expect(foldTerm("Newell's")).toBe('newells');
        });

        it('ranks a start over a word start over a contained term', () => {
            expect(matchRank('Madrid FC', 'madrid')).toBe(0);
            expect(matchRank('Real Madrid', 'madrid')).toBe(1);
            expect(matchRank('Telemadrid', 'madrid')).toBe(2);
            expect(matchRank('Sevilla', 'madrid')).toBe(-1);
        });

        it('takes a term of several words word by word', () => {
            // The phrase as typed first, then every word in any order.
            expect(matchRank('Real Madrid TV', foldTerm('real madrid'))).toBe(
                0
            );
            expect(matchRank('Real Madrid TV', foldTerm('madrid real'))).toBe(
                3
            );
            expect(matchRank('Real Madrid TV', foldTerm('real betis'))).toBe(
                -1
            );
            // Spacing aside: "laliga" is "la LIGA".
            expect(matchRank('DAZN la LIGA', foldTerm('dazn laliga'))).toBe(1);
            expect(matchRank('DAZN la LIGA', foldTerm('laliga'))).toBe(2);
            expect(
                matchRank('LaLiga TV Hypermotion', foldTerm('la liga'))
            ).toBe(1);
            expect(matchRank('DAZN la LIGA', foldTerm('DAZN LaLiga 2'))).toBe(
                -1
            );
        });

        it('asks the catalog for the longest word of the term', () => {
            expect(catalogQuery('dazn laliga')).toBe('laliga');
            expect(catalogQuery('  La casa de papel ')).toBe('papel');
            expect(catalogQuery('Narcos')).toBe('Narcos');
        });
    });

    describe('findTeams', () => {
        const live = (m: SportMatch) => m.event.status === 'live';

        it('lists each matching side once, with its opponent', () => {
            const hits = findTeams(
                [
                    match('Real Madrid', 'Barcelona'),
                    match(
                        'Rayo Vallecano',
                        'Real Madrid',
                        'laliga',
                        new Date()
                    ),
                    match('Atlético de Madrid', 'Getafe', 'laliga', new Date()),
                ],
                foldTerm('madrid'),
                live
            );

            expect(hits.map((hit) => hit.name)).toEqual([
                'Real Madrid',
                'Atlético de Madrid',
            ]);
            expect(hits[0]).toEqual(
                expect.objectContaining({
                    opponent: 'Barcelona',
                    live: true,
                    sectionId: 'laliga',
                })
            );
            expect(hits[0].followed?.name).toBe('Real Madrid');
        });

        it('finds a followed team without a match', () => {
            const hits = findTeams([], foldTerm('west ham'), live);

            expect(hits).toEqual([
                expect.objectContaining({
                    name: 'West Ham United',
                    sectionId: 'premier-league',
                    match: null,
                    live: false,
                }),
            ]);
        });

        it('answers nothing without a term and skips sports without sides', () => {
            expect(
                findTeams([match('Real Madrid', 'Barcelona')], '', live)
            ).toEqual([]);
            expect(
                findTeams(
                    [match('Alcaraz', 'Sinner', 'tennis')],
                    'alcaraz',
                    live
                )
            ).toEqual([]);
        });
    });

    describe('findChannels', () => {
        const countries = [
            {
                definition: {
                    id: 'es',
                    nameKey: 'WORKSPACE.COUNTRIES.NAMES.ES',
                    flag: './assets/flags/es.svg',
                    codes: ['ES'],
                },
                channelCount: 2,
                rows: [
                    {
                        id: 'es:1',
                        tier: 'main',
                        label: { key: null, text: 'Generalistas' },
                        channels: [
                            {
                                key: 'telemadrid',
                                title: 'Telemadrid',
                                subtitle: null,
                                icons: ['tm.png'],
                                copies: [
                                    {
                                        streamId: 7,
                                        categoryId: '3',
                                        title: 'Telemadrid',
                                        icon: 'tm.png',
                                        quality: 'HD',
                                    },
                                ],
                            },
                            {
                                key: 'real madrid tv',
                                title: 'Real Madrid TV',
                                subtitle: null,
                                icons: [],
                                copies: [
                                    {
                                        streamId: 8,
                                        categoryId: '3',
                                        title: 'Real Madrid TV',
                                        icon: null,
                                        quality: null,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ] as unknown as TvCountry[];

        it('finds channels by name, the closest first, with their country', () => {
            const { hits, total } = findChannels(countries, 'madrid');

            expect(total).toBe(2);
            expect(hits.map((hit) => hit.title)).toEqual([
                'Real Madrid TV',
                'Telemadrid',
            ]);
            expect(hits[1]).toEqual(
                expect.objectContaining({
                    countryId: 'es',
                    streamId: 7,
                    icon: 'tm.png',
                })
            );
        });

        it('finds a channel whatever the words’ spacing and order', () => {
            const laLiga = [
                {
                    ...countries[0],
                    rows: [
                        {
                            ...countries[0].rows[0],
                            channels: [
                                {
                                    ...countries[0].rows[0].channels[0],
                                    key: 'dazn la liga',
                                    title: 'DAZN la LIGA',
                                },
                            ],
                        },
                    ],
                },
            ] as TvCountry[];

            expect(
                findChannels(laLiga, foldTerm('dazn laliga')).hits.map(
                    (hit) => hit.title
                )
            ).toEqual(['DAZN la LIGA']);
            expect(findChannels(laLiga, foldTerm('liga dazn')).total).toBe(1);
            expect(findChannels(laLiga, foldTerm('dazn tenis')).total).toBe(0);
        });

        it('caps the list but counts every match', () => {
            const { hits, total } = findChannels(countries, 'madrid', 1);
            expect(hits).toHaveLength(1);
            expect(total).toBe(2);
        });
    });

    describe('titles', () => {
        const names = new Map([
            ['1', '|ES| ✪ ORIGINAL NETFLIX'],
            ['2', '|EN| ✪ Netflix MULTI SUB'],
            ['3', '|FR| ✪ NETFLIX'],
        ]);

        it('keeps the Spanish and English categories only', () => {
            const kept = languageFilter(names, 'movie');
            expect(['1', '2', '3', '9'].map(kept)).toEqual([
                true,
                true,
                false,
                false,
            ]);
        });

        it('does not filter a catalog without language codes', () => {
            const kept = languageFilter(new Map([['1', 'Drama']]), 'series');
            expect(kept('1')).toBe(true);
            expect(kept('5')).toBe(true);
        });

        it('lists each title once, with its platform and year', () => {
            const hits = toTitleHits(
                [
                    { category_id: '3', title: 'Narcos', xtream_id: 3 },
                    {
                        category_id: '2',
                        title: 'Narcos (2015)_ENG',
                        xtream_id: 2,
                    },
                    { category_id: 1, title: 'NARCOS', xtream_id: 1 },
                    {
                        category_id: '1',
                        title: 'Narcos: México',
                        xtream_id: 4,
                        poster_url: 'p.jpg',
                    },
                ],
                'series',
                names,
                foldTerm('narcos')
            );

            expect(hits).toEqual([
                expect.objectContaining({
                    title: 'Narcos',
                    year: 2015,
                    platform: 'Netflix',
                    xtreamId: 2,
                    kind: 'series',
                }),
                expect.objectContaining({
                    title: 'Narcos: México',
                    poster: 'p.jpg',
                }),
            ]);
        });

        it('holds the answers of a longer term to every word, best first', () => {
            // The catalog was asked for "papel" alone (see catalogQuery).
            const hits = toTitleHits(
                [
                    { category_id: '1', title: 'Papel', xtream_id: 1 },
                    {
                        category_id: '1',
                        title: 'La Casa de Papel (2017)',
                        xtream_id: 2,
                    },
                    {
                        category_id: '1',
                        title: 'Papel y casa',
                        xtream_id: 3,
                    },
                ],
                'series',
                names,
                foldTerm('casa papel')
            );

            expect(hits.map((hit) => [hit.title, hit.rank])).toEqual([
                ['La Casa de Papel', 3],
                ['Papel y casa', 3],
            ]);
        });

        it('keeps a one-word answer the catalog found its own way, last', () => {
            const hits = toTitleHits(
                [
                    { category_id: '1', title: 'Vis a vis', xtream_id: 1 },
                    { category_id: '1', title: 'Visitors', xtream_id: 2 },
                ],
                'series',
                names,
                foldTerm('vis-a-vis')
            );
            expect(hits.map((hit) => hit.rank)).toEqual([4, 4]);
        });
    });

    describe('teamMatchToday', () => {
        const now = new Date(2026, 9, 18, 17, 30);
        const team = (start: Date | null, live = false): TeamHit => ({
            key: 'laliga:real madrid',
            name: 'Real Madrid',
            sectionId: 'laliga',
            followed: null,
            match: match('Real Madrid', 'Sevilla', 'laliga', start),
            opponent: 'Sevilla',
            live,
            rank: 0,
        });

        it('plays the team’s match on now or later today', () => {
            const tonight = team(new Date(2026, 9, 18, 21, 0));
            expect(teamMatchToday(tonight, now, null)).toBe(tonight.match);
            const onNow = team(null, true);
            expect(teamMatchToday(onNow, now, null)).toBe(onNow.match);
        });

        it('leaves a match another day, or none, to the league page', () => {
            const tomorrow = team(new Date(2026, 9, 19, 21, 0));
            expect(teamMatchToday(tomorrow, now, null)).toBeNull();
            expect(
                teamMatchToday({ ...tomorrow, match: null }, now, null)
            ).toBeNull();
            // The kick-off the app keeps wins over the feed's.
            expect(
                teamMatchToday(tomorrow, now, new Date(2026, 9, 18, 22, 0))
            ).toBe(tomorrow.match);
        });
    });
});
