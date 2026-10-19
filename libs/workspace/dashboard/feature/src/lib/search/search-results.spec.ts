import type { TvCountry } from '../countries/countries-catalog';
import type { SportSectionId } from '../sports/sport-sections';
import type { SportMatch } from '../sports/sports-catalog';
import {
    findChannels,
    findTeams,
    foldTerm,
    languageFilter,
    matchRank,
    toTitleHits,
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
    });
});
