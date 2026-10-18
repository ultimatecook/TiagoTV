import type { SportEventStatus } from './sport-events';
import { SPORT_SECTIONS, type SportSectionId } from './sport-sections';
import {
    buildSportsCatalog,
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
        key: `${sectionId}|${title}`,
        keys: [`${sectionId}|${title}`],
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

    it('leaves "Resto del mundo" to its own page', () => {
        const catalog = catalogOf({
            laliga: [sportMatch('live', 'Girona FC - FC Andorra', 1)],
            'rest-of-world': [
                sportMatch(
                    'live',
                    'Kayanza United - Rukinzo',
                    2,
                    null,
                    'rest-of-world'
                ),
            ],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([1]);
    });

    it('keeps live matches without a known kick-off', () => {
        const catalog = catalogOf({
            laliga: [sportMatch('live', 'Unknown - Start', 1)],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([1]);
    });

    it('shows a match whose kick-off passed as on now, among the live ones', () => {
        const catalog = catalogOf({
            hypermotion: [
                sportMatch(
                    'next',
                    'Burgos CF - CE Sabadell',
                    1,
                    at(1),
                    'hypermotion'
                ),
            ],
            laliga: [sportMatch('next', 'Real Madrid - Sevilla', 2, at(-0.25))],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([2, 1]);
    });

    it('puts the big competitions first among the live ones, kick-offs in order after', () => {
        const catalog = catalogOf({
            hypermotion: [
                sportMatch(
                    'live',
                    'AD Ceuta FC - Real Oviedo',
                    1,
                    null,
                    'hypermotion'
                ),
                sportMatch(
                    'next',
                    'Burgos CF - CE Sabadell',
                    2,
                    at(2),
                    'hypermotion'
                ),
            ],
            'serie-a': [
                sportMatch('next', 'Juventus - Lazio', 3, at(2), 'serie-a'),
            ],
            laliga: [
                sportMatch('live', 'Osasuna - Racing de Santander', 4),
                sportMatch('next', 'Real Madrid - Sevilla', 5, at(2)),
            ],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([4, 1, 5, 3, 2]);
    });

    it('never shows an upcoming match of an earlier day, nor of tomorrow', () => {
        const catalog = catalogOf({
            laliga: [
                // Announced for last night: its "Next" was never renamed.
                sportMatch('next', 'Valencia CF - Getafe CF', 1, at(-17)),
                sportMatch('next', 'Elche CF - Levante UD', 2, at(10)),
                sportMatch('next', 'Girona FC - Rayo Vallecano', 3, at(2)),
            ],
        });

        expect(ids(todaysMatches(catalog, NOW))).toEqual([3]);
    });
});

describe('buildSportsCatalog', () => {
    const categories = [
        { category_id: 1, category_name: '|ES| ✪ DAZN EVENT' },
        { category_id: 2, category_name: '|ES| ✪ GOL MUNDIAL SOLO EVENTOS' },
        { category_id: 3, category_name: '|ES| ✪ LALIGA HYPERMOTION' },
    ];
    const stream = (stream_id: number, name: string, category_id = 1) => ({
        stream_id,
        name,
        category_id,
    });

    it('sends the football no card follows to "Resto del mundo", other sports nowhere', () => {
        const catalog = buildSportsCatalog(
            categories,
            [
                stream(
                    1,
                    'Live | Olympiacos - PAOK | Super League Greece | ES'
                ),
                stream(
                    2,
                    'Live | Chicago Grizzlies vs. Lake Erie Beacons | National Squash League | ES'
                ),
                stream(3, 'Live | Ajax - PSV | Eredivisie femenina | ES'),
                stream(4, 'Live | SC Cambuur - AZ Alkmaar | Eredivisie | ES'),
                stream(
                    5,
                    'Live | AD Ceuta FC - Real Oviedo | LALIGA HYPERMOTION | ES'
                ),
            ],
            NOW
        );

        expect(ids(catalog['rest-of-world'].matches)).toEqual([1]);
        expect(ids(catalog.eredivisie.matches)).toEqual([4]);
        expect(ids(catalog.hypermotion.matches)).toEqual([5]);
        expect(ids(catalog.laliga.matches)).toEqual([]);
        expect(catalog['rest-of-world'].matches[0].event.competition).toBe(
            'Super League Greece'
        );
    });

    it('gives "Resto del mundo" only the channels no other card claims', () => {
        const catalog = buildSportsCatalog(
            categories,
            [
                stream(10, '|ES| GOL Mundial 1 ᴴᴰ', 2),
                stream(11, '|ES| GOL Mundial Eredivisie ᴴᴰ', 2),
                stream(12, '|ES| LA LIGATV 1 HYPERMOTION', 3),
            ],
            NOW
        );

        expect(
            catalog['rest-of-world'].channels.map((c) => c.streamId)
        ).toEqual([10]);
        expect(catalog.eredivisie.channels.map((c) => c.streamId)).toEqual([
            11,
        ]);
        expect(catalog.hypermotion.channels.map((c) => c.streamId)).toEqual([
            12,
        ]);
        expect(catalog.laliga.channels).toEqual([]);
    });
});
