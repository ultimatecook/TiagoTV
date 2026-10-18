import type { SportEventStatus } from './sport-events';
import { SPORT_SECTIONS, type SportSectionId } from './sport-sections';
import {
    todaysMatches,
    type SportMatch,
    type SportSectionContent,
    type SportsCatalog,
} from './sports-catalog';

const HOUR = 3600_000;
/** 3 pm local time: the "today" row cuts at the viewer's midnight. */
const NOW = new Date(2026, 9, 18, 15, 0);

function sportMatch(
    status: SportEventStatus,
    title: string,
    streamId: number,
    start: Date | null = null,
    sectionId: SportSectionId = 'laliga'
): SportMatch {
    const [home, away] = title.split(' - ');
    return {
        streamId,
        categoryId: '1',
        title,
        icon: null,
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

function catalogOf(
    content: Partial<Record<SportSectionId, SportMatch[]>>
): SportsCatalog {
    const catalog = {} as Record<SportSectionId, SportSectionContent>;
    for (const section of SPORT_SECTIONS) {
        catalog[section.id] = {
            matches: content[section.id] ?? [],
            channels: [],
        };
    }
    return catalog;
}

const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);
const ids = (matches: readonly SportMatch[]) =>
    matches.map((match) => match.streamId);

describe('todaysMatches', () => {
    it('lists the matches on now, then the rest of the day by kick-off', () => {
        const catalog = catalogOf({
            laliga: [
                sportMatch('next', 'Burgos CF - CE Sabadell', 1, at(4)),
                sportMatch('live', 'AD Ceuta FC - Real Oviedo', 2),
                sportMatch('next', 'Girona FC - FC Andorra', 3, at(1.5)),
            ],
            'premier-league': [
                sportMatch('next', 'Arsenal - Chelsea', 4, at(24)),
            ],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([2, 3, 1]);
    });

    it('drops an upcoming match that kicked off longer ago than a match lasts', () => {
        const catalog = catalogOf({
            laliga: [
                sportMatch('next', 'Started - Recently', 1, at(-1)),
                sportMatch('next', 'Long - Over', 2, at(-3)),
            ],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([1]);
    });

    it('drops a "Live" match whose remembered kick-off says it is over', () => {
        const catalog = catalogOf({
            laliga: [
                sportMatch('live', 'Still - On', 1),
                sportMatch('live', 'Final - Whistle', 2),
            ],
            tennis: [sportMatch('live', 'Long - Rally', 3, null, 'tennis')],
        });
        const kickOffs: Record<number, Date> = {
            1: at(-2),
            2: at(-2.6),
            3: at(-4),
        };

        expect(
            ids(
                todaysMatches(
                    catalog,
                    NOW,
                    (match) => kickOffs[match.streamId] ?? null
                )
            )
        ).toEqual([1, 3]);
    });

    it('keeps live matches without a known kick-off', () => {
        const catalog = catalogOf({
            laliga: [sportMatch('live', 'Unknown - Start', 1)],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([1]);
    });
});
