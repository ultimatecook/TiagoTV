import type { SportMatch } from '../sports/sports-catalog';
import {
    findSportSection,
    type SportSectionId,
} from '../sports/sport-sections';
import {
    HOME_EVENTS_LIMIT,
    homeEventRow,
    homeEventsSummary,
    involvesMyTeam,
    selectHomeEvents,
} from './home-events';

const match = (
    key: string,
    home: string | null,
    away: string | null,
    overrides: Partial<SportMatch> & { sectionId?: SportSectionId } = {}
): SportMatch => ({
    streamId: 1,
    categoryId: '77',
    title: home && away ? `${home} - ${away}` : key,
    icon: null,
    key,
    keys: [key],
    sectionId: 'laliga',
    via: [],
    event: {
        status: 'next',
        title: home && away ? `${home} - ${away}` : key,
        home,
        away,
        competition: 'LaLiga',
        start: new Date('2026-10-19T19:00:00Z'),
        country: 'ES',
    },
    ...overrides,
});

describe('involvesMyTeam', () => {
    it("knows the owner's teams on either side", () => {
        expect(involvesMyTeam(match('a', 'Real Madrid CF', 'Getafe'))).toBe(
            true
        );
        expect(involvesMyTeam(match('b', 'Arsenal', 'West Ham'))).toBe(true);
        expect(
            involvesMyTeam(match('c', 'Real Sociedad', 'Rosario Central'))
        ).toBe(false);
    });
});

describe('selectHomeEvents', () => {
    it("lists the first ones, but finds room for the user's teams", () => {
        const others = Array.from({ length: 10 }, (_, i) =>
            match(`m${i}`, `Home ${i}`, `Away ${i}`)
        );
        const mine = match('mine', 'West Ham United', 'Arsenal');
        const shown = selectHomeEvents([...others, mine]);

        expect(shown).toHaveLength(HOME_EVENTS_LIMIT);
        expect(shown[shown.length - 1]).toBe(mine);
        expect(shown.slice(0, -1)).toEqual(
            others.slice(0, HOME_EVENTS_LIMIT - 1)
        );
    });

    it('keeps the order when everything fits', () => {
        const list = [match('a', 'A', 'B'), match('b', 'C', 'D')];
        expect(selectHomeEvents(list)).toEqual(list);
    });
});

describe('homeEventRow', () => {
    it("names the match's channel and puts the owner's team in bold", () => {
        const game = match('m', 'Real Madrid', 'Getafe', {
            channelName: 'DAZN',
        });
        const row = homeEventRow(game, true);

        expect(row).toEqual(
            expect.objectContaining({
                live: true,
                competition: findSportSection('laliga')?.title,
                home: 'Real Madrid',
                away: 'Getafe',
                homeMine: true,
                awayMine: false,
                channel: 'DAZN',
            })
        );
        expect(row.match).toBe(game);
    });

    it("falls back to the competition channel's name a match is offered on", () => {
        const via = {
            name: 'M+ LaLiga TV',
            channel: {
                streamId: 9,
                categoryId: '5',
                title: 'M+ LaLiga TV',
                icon: null,
            },
        };
        expect(
            homeEventRow(match('m', 'Sevilla', 'Betis', { via: [via] }), false)
                .channel
        ).toBe('M+ LaLiga TV');
    });

    it('titles an event without two sides by its own competition', () => {
        const row = homeEventRow(
            match('atp', null, null, {
                sectionId: 'tennis',
                title: 'Alcaraz · Zverev',
                event: {
                    status: 'live',
                    title: 'Alcaraz · Zverev',
                    home: null,
                    away: null,
                    competition: 'ATP Viena',
                    start: null,
                    country: 'ES',
                },
            }),
            true
        );

        expect(row).toEqual(
            expect.objectContaining({
                home: null,
                away: null,
                title: 'Alcaraz · Zverev',
                competition: 'ATP Viena',
                channel: '',
            })
        );
    });
});

describe('homeEventsSummary', () => {
    it('counts the events on now among all of today', () => {
        const list = [match('a', 'A', 'B'), match('b', 'C', 'D')];
        expect(homeEventsSummary(list, (item) => item.key === 'a')).toEqual({
            live: 1,
            total: 2,
        });
    });
});
