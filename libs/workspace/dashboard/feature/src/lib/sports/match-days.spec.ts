import {
    dayName,
    dayOffset,
    kickOffTime,
    matchDay,
    matchesOnDay,
    shortDate,
} from './match-days';
import { buildSportsCatalog } from './sports-catalog';

const NOW = new Date(2026, 9, 18, 12, 0);
const iso = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const time = (date: Date) =>
    `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
/** "Next | <date> | <time> (GMT) | …" for a local time `hours` from NOW. */
const next = (hours: number, teams: string, competition = 'LaLiga') => {
    const at = new Date(NOW.getTime() + hours * 3600_000);
    return `Next | ${iso(at)} | ${time(at)} (GMT) | ${teams} | ${competition} | ES`;
};

describe('match days', () => {
    it('spans a local day', () => {
        const tomorrow = matchDay(NOW, 1);
        expect(tomorrow.start).toEqual(new Date(2026, 9, 19));
        expect(tomorrow.end.getTime()).toBe(
            new Date(2026, 9, 20).getTime() - 1
        );
        expect(matchDay(NOW, -1).start).toEqual(new Date(2026, 9, 17));
    });

    it('names yesterday, today and tomorrow, then the date', () => {
        expect(dayName(-1, matchDay(NOW, -1).start).key).toBe(
            'WORKSPACE.SPORTS.DAYS.YESTERDAY'
        );
        expect(dayName(0, NOW).key).toBe('WORKSPACE.SPORTS.DAYS.TODAY');
        expect(dayName(1, NOW).key).toBe('WORKSPACE.SPORTS.DAYS.TOMORROW');
        const later = dayName(3, matchDay(NOW, 3).start, 'es');
        expect(later.key).toBeNull();
        expect(later.text).toBe('Mié 21');
        expect(shortDate(new Date(2026, 9, 22), 'en')).toBe('Thu 22');
    });

    it('counts days by the local date', () => {
        expect(dayOffset(new Date(2026, 9, 18, 23, 59), NOW)).toBe(0);
        expect(dayOffset(new Date(2026, 9, 19, 0, 1), NOW)).toBe(1);
        expect(dayOffset(new Date(2026, 9, 25, 9), NOW)).toBe(7);
        expect(kickOffTime(new Date(2026, 9, 18, 21, 0), 'es')).toBe('21:00');
    });

    it('lists the matches kicking off on the day, by kick-off', () => {
        const catalog = buildSportsCatalog(
            [{ category_id: 1, category_name: '|ES| ✪ LALIGA PPV' }],
            [
                {
                    stream_id: 1,
                    category_id: 1,
                    name: next(8, 'Sevilla FC - Real Betis'),
                },
                {
                    stream_id: 2,
                    category_id: 1,
                    name: next(3, 'Getafe CF - Real Madrid'),
                },
                {
                    stream_id: 3,
                    category_id: 1,
                    name: next(26, 'Villarreal CF - Girona FC'),
                },
                {
                    stream_id: 4,
                    category_id: 1,
                    name: next(
                        4,
                        'Masters FC vs. Karonga United',
                        'FDH Bank Premiership - Malawi'
                    ),
                },
            ],
            NOW
        );

        const ids = (offset: number) =>
            matchesOnDay(catalog, matchDay(NOW, offset), NOW).map(
                (match) => match.streamId
            );
        // "Resto del mundo" stays on its own page.
        expect(ids(0)).toEqual([2, 1]);
        expect(ids(1)).toEqual([3]);
        expect(ids(-1)).toEqual([]);
        expect(ids(2)).toEqual([]);
    });
});
