import { daySeed, seededUnit } from './platform-seed';

describe('platform seed', () => {
    it('is the same all day long and changes the next day', () => {
        const morning = daySeed(new Date(2026, 9, 19, 0, 5));
        const night = daySeed(new Date(2026, 9, 19, 23, 55));
        const next = daySeed(new Date(2026, 9, 20, 0, 5));

        expect(night).toBe(morning);
        expect(next).toBe(morning + 1);
    });

    it('draws a fixed number in [0, 1) per key and seed', () => {
        const draws = Array.from({ length: 200 }, (_, i) =>
            seededUnit(20380, `movie:${i}`)
        );

        expect(seededUnit(20380, 'movie:1')).toBe(draws[1]);
        expect(seededUnit(20381, 'movie:1')).not.toBe(draws[1]);
        expect(draws.every((draw) => draw >= 0 && draw < 1)).toBe(true);
        expect(new Set(draws).size).toBe(200);
        // Spread over the range, not bunched at one end.
        expect(draws.filter((draw) => draw < 0.5).length).toBeGreaterThan(60);
        expect(draws.filter((draw) => draw < 0.5).length).toBeLessThan(140);
    });
});
