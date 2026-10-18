import { isIdleEventChannel, parseSportEvent } from './sport-events';
import {
    channelInSection,
    findSportSection,
    sectionForCompetition,
} from './sport-sections';

describe('parseSportEvent', () => {
    it('reads a live match', () => {
        expect(
            parseSportEvent(
                'Live | Leeds United - Manchester United | Premier League | ES'
            )
        ).toEqual({
            status: 'live',
            title: 'Leeds United - Manchester United',
            home: 'Leeds United',
            away: 'Manchester United',
            competition: 'Premier League',
            start: null,
            country: 'ES',
        });
    });

    it('reads the GMT kick-off of an upcoming match', () => {
        const event = parseSportEvent(
            'Next | 2026-10-18 | 15:30 (GMT) | Nottingham Forest - Arsenal | Premier League | ES'
        );

        expect(event?.status).toBe('next');
        expect(event?.start?.toISOString()).toBe('2026-10-18T15:30:00.000Z');
        expect(event?.home).toBe('Nottingham Forest');
        expect(event?.away).toBe('Arsenal');
    });

    it('keeps events without two sides, and "vs." separators', () => {
        expect(
            parseSportEvent(
                'Live | 6 horas de Barcelona | FIA World Endurance | ES'
            )
        ).toMatchObject({ title: '6 horas de Barcelona', home: null });
        expect(
            parseSportEvent(
                "End | Village Superstars vs. St. Paul's United | Premier League - St. Kitts and Nevis | GB"
            )
        ).toMatchObject({
            status: 'end',
            home: 'Village Superstars',
            away: "St. Paul's United",
        });
        expect(
            parseSportEvent(
                'Next | 2026-10-18 | 21:00 (GMT) | El Post | Jornada 9 | LALIGA EA SPORTS | ES'
            )
        ).toMatchObject({ title: 'El Post · Jornada 9', home: null });
    });

    it('ignores channels that are not event slots', () => {
        expect(parseSportEvent('|ES| M LA LIGA TV ᴴᴰ')).toBeNull();
        expect(parseSportEvent('ES | No Event')).toBeNull();
        expect(isIdleEventChannel('ES | No Event')).toBe(true);
        expect(isIdleEventChannel('|ES| DAZN 1 ᴴᴰ')).toBe(false);
    });
});

describe('sport sections', () => {
    it('follows the top flights, not their lookalikes', () => {
        const id = (competition: string) =>
            sectionForCompetition(competition)?.id ?? null;

        expect(id('Premier League')).toBe('premier-league');
        expect(id('Premier League - Lebanon')).toBeNull();
        expect(id('LALIGA EA SPORTS')).toBe('laliga');
        expect(id('Serie A Enilive')).toBe('serie-a');
        expect(id('Serie A Women')).toBeNull();
        expect(id('Ligue 1+')).toBe('ligue-1');
        expect(id('Ligue 1 - Burkina Faso')).toBeNull();
        expect(id('Bundesliga')).toBe('bundesliga');
        expect(id('Google Pixel Frauen-Bundesliga')).toBeNull();
        expect(id('FIA World Endurance')).toBe('motor');
        expect(id('ABN AMRO Open _ ATP 500')).toBe('tennis');
    });

    it('gathers 24/7 channels by category or name', () => {
        const laliga = findSportSection('laliga');
        const premier = findSportSection('premier-league');
        if (!laliga || !premier) {
            throw new Error('sections missing');
        }

        expect(
            channelInSection(
                laliga,
                'M+ LaLigaTV FHD Orange',
                '|ES| ✪ LALIGA ORANGE'
            )
        ).toBe(true);
        expect(
            channelInSection(
                premier,
                '|UK| SKY SPORTS PREMIER LEAGUE ᴴᴰ',
                '|UK| ✪ SPORTS'
            )
        ).toBe(true);
        expect(
            channelInSection(
                premier,
                '|UK| PREMIER SPORTS 1 ᵁᴴᴰ',
                '|UK| ✪ SPORTS'
            )
        ).toBe(false);
        expect(
            channelInSection(
                findSportSection('tennis') ?? premier,
                'EC-DAZN 5: ABN AMRO Open _ ATP 500| Semifinals| Sat 08 Feb 10:00 AM',
                '|LAT|  ✪ EC DAZN PPV'
            )
        ).toBe(false);
    });
});
