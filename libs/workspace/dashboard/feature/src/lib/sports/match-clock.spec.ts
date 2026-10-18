import {
    isMatchOn,
    isMatchOver,
    KickoffMemory,
    longestMatch,
} from './match-clock';
import type { SportEventStatus } from './sport-events';
import type { SportSectionId } from './sport-sections';
import type { SportMatch } from './sports-catalog';

const HOUR = 3600_000;
const NOW = new Date('2026-10-18T18:00:00Z');

function sportMatch(
    status: SportEventStatus,
    title: string,
    start: Date | null = null,
    sectionId: SportSectionId = 'laliga',
    keys = [`${sectionId}|${title.toLowerCase()}`]
): SportMatch {
    const [home, away] = title.split(' - ');
    return {
        streamId: 1,
        categoryId: '1',
        title,
        icon: null,
        key: keys[0],
        keys,
        via: [],
        sectionId,
        event: {
            status,
            title,
            home,
            away: away ?? null,
            competition: 'LaLiga',
            start,
            country: 'ES',
        },
    };
}

function hoursAgo(hours: number, now = NOW): Date {
    return new Date(now.getTime() - hours * HOUR);
}

class MemoryStorage {
    readonly items = new Map<string, string>();

    getItem(key: string): string | null {
        return this.items.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.items.set(key, value);
    }
}

describe('longestMatch', () => {
    it('gives each sport and competition its longest running time', () => {
        expect(longestMatch('tennis')).toBe(5 * HOUR);
        expect(longestMatch('basketball')).toBe(3 * HOUR);
        expect(longestMatch('laliga')).toBe(2.25 * HOUR);
        expect(longestMatch('premier-league')).toBe(2.25 * HOUR);
        // Cups go to extra time and penalties.
        expect(longestMatch('champions-league')).toBe(2.75 * HOUR);
        expect(longestMatch('libertadores')).toBe(2.75 * HOUR);
        expect(longestMatch(null)).toBe(2.25 * HOUR);
    });
});

describe('isMatchOver', () => {
    const live = sportMatch('live', 'Girona FC - FC Andorra');

    it('cannot tell without a kick-off', () => {
        expect(isMatchOver(live, null, NOW)).toBe(false);
    });

    it('ends a "Live" match once it ran longer than its sport does', () => {
        expect(isMatchOver(live, hoursAgo(2), NOW)).toBe(false);
        expect(isMatchOver(live, hoursAgo(2.3), NOW)).toBe(true);
    });

    it('gives tennis its longer day', () => {
        const tennis = sportMatch('live', 'Alcaraz - Sinner', null, 'tennis');

        expect(isMatchOver(tennis, hoursAgo(4), NOW)).toBe(false);
        expect(isMatchOver(tennis, hoursAgo(5.5), NOW)).toBe(true);
    });

    it("reads an upcoming match's own kick-off first", () => {
        const next = sportMatch('next', 'Burgos CF - CE Sabadell', hoursAgo(3));

        expect(isMatchOver(next, null, NOW)).toBe(true);
        expect(
            isMatchOver(
                sportMatch('next', 'Burgos CF - CE Sabadell', hoursAgo(1)),
                hoursAgo(9),
                NOW
            )
        ).toBe(false);
    });
});

describe('isMatchOn', () => {
    it('is on while a feed says "Live", until it is over', () => {
        const live = sportMatch('live', 'AD Ceuta FC - Real Oviedo');

        expect(isMatchOn(live, null, NOW)).toBe(true);
        expect(isMatchOn(live, hoursAgo(1), NOW)).toBe(true);
        expect(isMatchOn(live, hoursAgo(3), NOW)).toBe(false);
    });

    it('is on once its kick-off has passed, though the feeds still say "Next"', () => {
        const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);
        const next = (start: Date) =>
            sportMatch('next', 'Real Madrid - Sevilla', start);

        expect(isMatchOn(next(at(0.5)), null, NOW)).toBe(false);
        expect(isMatchOn(next(at(-0.25)), null, NOW)).toBe(true);
        expect(isMatchOn(next(at(-2.5)), null, NOW)).toBe(false);
        expect(isMatchOn(sportMatch('next', 'A - B'), null, NOW)).toBe(false);
    });
});

describe('KickoffMemory', () => {
    it('keeps the kick-offs of upcoming matches across restarts', () => {
        const storage = new MemoryStorage();
        const kickOff = new Date('2026-10-18T16:30:00Z');
        new KickoffMemory(storage).remember(
            [sportMatch('next', 'Girona FC - FC Andorra', kickOff)],
            NOW.getTime()
        );

        // The provider renames the channel "Live", without a time.
        const restarted = new KickoffMemory(storage);
        const live = sportMatch('live', 'Girona FC - FC Andorra');

        expect(restarted.kickOffOf(live)).toEqual(kickOff);
        expect(restarted.kickOffOf(sportMatch('live', 'A - B'))).toBeNull();
    });

    it('takes the first sight of a live match as its latest kick-off', () => {
        const memory = new KickoffMemory(new MemoryStorage());
        const live = sportMatch('live', 'AD Ceuta FC - Real Oviedo');

        memory.remember([live], hoursAgo(1).getTime());
        memory.remember([live], NOW.getTime());

        expect(memory.kickOffOf(live)).toEqual(hoursAgo(1));
        expect(isMatchOver(live, memory.kickOffOf(live), NOW)).toBe(false);
        const later = new Date(NOW.getTime() + 2 * HOUR);
        expect(isMatchOver(live, memory.kickOffOf(live), later)).toBe(true);
    });

    it('ends a "Live" that outlasts its match, from the time a feed announced', () => {
        // Seen at 12:48 as "Next | 2026-10-18 | 14:15 (GMT)", then "Live"
        // on every feed long after the final whistle.
        const memory = new KickoffMemory(new MemoryStorage());
        const kickOff = new Date('2026-10-18T14:15:00Z');
        memory.remember(
            [
                sportMatch(
                    'next',
                    'Granada CF - Cádiz CF',
                    kickOff,
                    'hypermotion'
                ),
            ],
            new Date('2026-10-18T12:48:00Z').getTime()
        );
        const stale = sportMatch(
            'live',
            'Granada CF - Cádiz CF',
            null,
            'hypermotion'
        );
        memory.remember([stale], NOW.getTime());

        expect(memory.kickOffOf(stale)).toEqual(kickOff);
        expect(isMatchOver(stale, memory.kickOffOf(stale), NOW)).toBe(true);
    });

    it('shares a kick-off between the spellings of one match, the earliest winning', () => {
        const memory = new KickoffMemory(new MemoryStorage());
        const spanish = sportMatch(
            'live',
            'SC Cambuur - AZ Alkmaar',
            null,
            'eredivisie',
            ['eredivisie|cambuur|az alkmaar']
        );
        memory.remember([spanish], hoursAgo(2).getTime());
        // Later the French feed's spelling joins it.
        const both = sportMatch(
            'live',
            'SC Cambuur - AZ Alkmaar',
            null,
            'eredivisie',
            ['eredivisie|cambuur|az', 'eredivisie|cambuur|az alkmaar']
        );
        memory.remember([both], NOW.getTime());
        const french = sportMatch('live', 'Cambuur - AZ', null, 'eredivisie', [
            'eredivisie|cambuur|az',
        ]);

        expect(memory.kickOffOf(both)).toEqual(hoursAgo(2));
        expect(memory.kickOffOf(french)).toEqual(hoursAgo(2));
    });

    it('fills in announced kick-offs only where nothing was seen', () => {
        const memory = new KickoffMemory(new MemoryStorage());
        const live = sportMatch('live', 'Girona FC - FC Andorra');
        const seen = sportMatch('live', 'AD Ceuta FC - Real Oviedo');
        memory.remember([seen], hoursAgo(1).getTime());

        memory.fill(
            new Map([
                [live.key, hoursAgo(1.5).getTime()],
                [seen.key, hoursAgo(3).getTime()],
                ['laliga|old - match', hoursAgo(60).getTime()],
            ]),
            NOW.getTime()
        );

        expect(memory.kickOffOf(live)).toEqual(hoursAgo(1.5));
        expect(memory.kickOffOf(seen)).toEqual(hoursAgo(1));
        expect(memory.kickOffOf(sportMatch('next', 'Old - Match'))).toBeNull();
    });

    it('forgets kick-offs older than two days', () => {
        const storage = new MemoryStorage();
        const memory = new KickoffMemory(storage);
        const old = sportMatch('next', 'Old - Match', hoursAgo(50));
        memory.remember([old], NOW.getTime());

        expect(memory.kickOffOf(old)).toBeNull();
        expect(
            JSON.parse(storage.getItem('tiagotv:kickoffs:v1') ?? '{}')
        ).toEqual({});
    });

    it('works without storage, or with a broken one', () => {
        const match = sportMatch('next', 'A - B', hoursAgo(1));
        const broken = {
            getItem: () => '{not json',
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
        };

        for (const storage of [null, broken]) {
            const memory = new KickoffMemory(storage);
            expect(() => memory.remember([match], NOW.getTime())).not.toThrow();
            expect(memory.kickOffOf(match)).toEqual(hoursAgo(1));
        }
    });
});
