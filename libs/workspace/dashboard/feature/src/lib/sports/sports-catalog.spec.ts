import type { SportEventStatus } from './sport-events';
import { SPORT_SECTIONS, type SportSectionId } from './sport-sections';
import { isMatchOver } from './match-clock';
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

describe('a "Live" the provider never renamed', () => {
    // Its `added` says when the panel named it: real slots from the
    // provider, seen on Monday morning (19 Oct, 9 am).
    const MONDAY = new Date(Date.UTC(2026, 9, 19, 7, 0));
    const seconds = (date: Date) => String(Math.floor(date.getTime() / 1000));
    const categories = [
        { category_id: 1, category_name: '|ES| ✪ DAZN EVENT' },
        { category_id: 3, category_name: '|ES| ✪ LALIGA HYPERMOTION' },
    ];
    const slot = (stream_id: number, name: string, named: Date) => ({
        stream_id,
        name,
        category_id: stream_id === 3 ? 3 : 1,
        added: seconds(named),
    });
    const streams = [
        slot(
            1,
            'Live | Superpole Race (WSBK) & Carrera 2 (Todas las categorías) | Pirelli Spanish Round | ',
            new Date(Date.UTC(2026, 9, 18, 9, 6))
        ),
        slot(
            2,
            'Live | 6 horas de Barcelona | FIA World Endurance | ES',
            new Date(Date.UTC(2026, 9, 18, 9, 29))
        ),
        slot(
            3,
            'Live | AD Ceuta FC - Real Oviedo | LALIGA HYPERMOTION | ES',
            new Date(Date.UTC(2026, 9, 18, 11, 53))
        ),
    ];

    it('takes the time its feed was named "Live" as its kick-off', () => {
        const catalog = buildSportsCatalog(categories, streams, MONDAY);

        expect(catalog.hypermotion.matches[0].liveSince?.toISOString()).toBe(
            '2026-10-18T11:53:00.000Z'
        );
        expect(todaysMatches(catalog, MONDAY)).toEqual([]);
    });

    it('keeps a long race on for as long as its name says', () => {
        const during = new Date(Date.UTC(2026, 9, 18, 14, 0));
        const after = new Date(Date.UTC(2026, 9, 18, 16, 40));
        const catalog = buildSportsCatalog(categories, streams, during);

        expect(ids(todaysMatches(catalog, during))).toEqual([2, 3]);
        expect(ids(todaysMatches(catalog, after))).toEqual([]);
    });

    it('lets a remembered first sighting yield to an older "Live" name', () => {
        const ceuta = buildSportsCatalog(categories, streams, MONDAY)
            .hypermotion.matches[0];
        // Seen for the first time when the app opened, Monday 9 am.
        expect(isMatchOver(ceuta, MONDAY, MONDAY)).toBe(true);
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

    it("gives the Liga Profesional Argentina's broadcasters, and no generic channel", () => {
        const catalog = buildSportsCatalog(
            [
                { category_id: 20, category_name: '|LAT|  ✪ ARGENTINA' },
                {
                    category_id: 21,
                    category_name: '|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT',
                },
                { category_id: 22, category_name: '|UK| ✪ SPORTS' },
                { category_id: 23, category_name: '|DE| ✪ DAZN EVENT' },
            ],
            [
                stream(20, '|ARG| TYC SPORTS ᴴᴰ', 20),
                stream(21, '|ARG| ESPN', 20),
                stream(22, '|ARG| FOX SPORTS 2 ᴴᴰ', 20),
                stream(23, '|ARG| TELEFE ᴴᴰ', 20),
                stream(24, '|ARG| FOX SPORTS PREMIUM ᴴᴰ', 20),
                stream(25, '|ARG| TNT SPORTS ᴴᴰ', 20),
                stream(
                    26,
                    'US (P+) Argentina Liga Profesional De Futbol 1',
                    21
                ),
                stream(
                    27,
                    'US (P+) Argentina Liga Profesional De Futbol 2',
                    21
                ),
                stream(28, '|UK| TNT SPORTS 1 ᴴᴰ', 22),
                stream(
                    29,
                    'Live | Boca Juniors vs. River Plate | Liga Profesional Argentina | DE',
                    23
                ),
            ],
            NOW
        );

        const argentina = catalog['liga-argentina'];
        // ESPN Premium and TNT Sports first (each airs half of a round),
        // then the league's own feeds, TyC Sports (the Copa Argentina) last.
        expect(argentina.channels.map((c) => c.streamId)).toEqual([
            24, 25, 26, 27, 20,
        ]);
        // A match no kept feed names plays on those channels.
        expect(argentina.matches.map((match) => match.title)).toEqual([
            'Boca Juniors - River Plate',
        ]);
        expect(argentina.matches[0].via.map((option) => option.name)).toEqual([
            'ESPN Premium',
            'TNT Sports',
            'Argentina Liga Profesional De Futbol',
            'TyC Sports',
        ]);
        expect(argentina.matches[0].channelName).toBe('ESPN Premium');
        expect(catalog['rest-of-world'].channels).toEqual([]);
    });

    it("leaves LALIGA+'s passes out of LaLiga", () => {
        const catalog = buildSportsCatalog(
            [
                { category_id: 30, category_name: '|ES| ✪ LALIGA+ PPV' },
                { category_id: 31, category_name: '|ES| ✪ LALIGA ORANGE' },
            ],
            [
                stream(30, 'ES: LALIGA+ PPV 4', 30),
                stream(31, 'M+ LaLigaTV 2 HD Orange', 31),
            ],
            NOW
        );

        expect(catalog.laliga.channels.map((c) => c.streamId)).toEqual([31]);
    });
});
