import type { SportSectionId } from '../sports/sport-sections';
import type { SportMatch } from '../sports/sports-catalog';
import {
    isFootballProgramme,
    liveFootball,
    matchLabel,
} from './country-tv-football';

function match(
    streamId: number,
    sectionId: SportSectionId,
    home: string,
    away: string,
    competition: string,
    via: readonly number[] = []
): SportMatch {
    return {
        streamId,
        categoryId: '1',
        title: `${home} - ${away}`,
        icon: null,
        key: `${sectionId}:${home}:${away}`,
        keys: [],
        sectionId,
        event: {
            status: 'live',
            title: `${home} - ${away}`,
            home,
            away,
            competition,
            start: null,
            country: 'ES',
        },
        via: via.map((id) => ({
            name: `Channel ${id}`,
            channel: { streamId: id, categoryId: '2', title: '', icon: null },
        })),
    };
}

describe('liveFootball', () => {
    const always = () => true;

    it('names the match on the event channel that carries it', () => {
        const shows = liveFootball(
            [
                match(
                    5,
                    'premier-league',
                    'Leeds United',
                    'Manchester United',
                    'Premier League'
                ),
            ],
            always
        );
        expect(shows.get(5)).toBe(
            'Premier League · Leeds United – Manchester United'
        );
    });

    it('marks a competition’s channels, naming the match when one is on', () => {
        const shows = liveFootball(
            [
                match(7, 'laliga', 'Real Madrid', 'Getafe', 'LaLiga', [7, 8]),
                match(7, 'laliga', 'Betis', 'Sevilla', 'LaLiga', [7]),
            ],
            always
        );
        // Two matches on DAZN LaLiga: the competition only.
        expect(shows.get(7)).toBe('LaLiga');
        expect(shows.get(8)).toBe('LaLiga · Real Madrid – Getafe');
    });

    it('leaves out other sports and matches not on now', () => {
        const shows = liveFootball(
            [
                match(1, 'basketball', 'Lakers', 'Celtics', 'NBA'),
                match(2, 'tennis', 'Alcaraz', 'Sinner', 'ATP Paris'),
                match(3, 'laliga', 'Girona', 'Celta', 'LaLiga'),
            ],
            (entry) => entry.streamId !== 3
        );
        expect(shows.size).toBe(0);
    });

    it('labels a match without two sides by its title', () => {
        const single = {
            ...match(9, 'rest-of-world', 'A', 'B', ''),
            event: {
                ...match(9, 'rest-of-world', 'A', 'B', '').event,
                home: null,
                away: null,
                title: 'Gala',
            },
        };
        expect(matchLabel(single)).toBe('Gala');
    });
});

describe('isFootballProgramme', () => {
    it.each([
        'LaLiga EA Sports: Real Madrid - Getafe',
        'Fútbol: Primera División',
        'Premier League Live',
        'UEFA Champions League',
        'Liga Profesional: Newell’s - Rosario Central',
    ])('%s is football', (title) => {
        expect(isFootballProgramme(title)).toBe(true);
    });

    it.each([
        'Monday Night Football',
        'NFL Football: Chiefs at Bills',
        'Fútbol americano universitario',
        'Fútbol sala: final',
        'Telediario 2',
        'El Hormiguero',
    ])('%s is not', (title) => {
        expect(isFootballProgramme(title)).toBe(false);
    });
});
