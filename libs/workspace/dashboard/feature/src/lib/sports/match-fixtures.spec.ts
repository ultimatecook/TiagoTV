import { announcedKickOffs, categoryChannelName } from './match-fixtures';
import { buildSportsCatalog, todaysMatches } from './sports-catalog';
import type { SportsCatalogStream } from './sports-catalog';

/**
 * Names from the provider's catalog of 18 October 2026 (12:48 GMT): in
 * Spain LaLiga airs on M+ LaLiga TV and DAZN LaLiga, whose names never
 * carry the match; only the French feeds list Real Madrid - Sevilla.
 */
const CATEGORIES = [
    { category_id: 548, category_name: '|ES| ✪ LALIGA' },
    { category_id: 1999, category_name: '|ES| ✪ LALIGA ORANGE' },
    { category_id: 2552, category_name: '|ES| ✪ DAZN LALIGA' },
    { category_id: 1922, category_name: '|ES| ✪ LALIGA+ PPV' },
    { category_id: 1921, category_name: '|ES| ✪ LALIGA PPV' },
    { category_id: 1110, category_name: '|ES| ✪ DAZN EVENT' },
    { category_id: 1111, category_name: '|ES| ✪ BUNDESLIGA  PPV' },
    { category_id: 1112, category_name: '|ES| ✪ DAZN SERIE A' },
    { category_id: 1113, category_name: '|ES| ✪ PREMIER LEAGUE PPV' },
    { category_id: 1114, category_name: '|UK| ✪ DAZN EVENT' },
    { category_id: 2001, category_name: 'FR| ✪ DAZN LALIGA ES' },
    { category_id: 2002, category_name: '|FR| ✪  DISNEY + PPV' },
    { category_id: 2003, category_name: '|FR| ✪ DAZN EVENT' },
    { category_id: 2004, category_name: '|DE| ✪ BUNDESLIGA  PPV' },
    { category_id: 2005, category_name: '|FR| ✪ DAZN SERIE A' },
];

/** The kept 24/7 LaLiga channels. */
const LALIGA_CHANNELS: SportsCatalogStream[] = [
    { stream_id: 10, name: '|ES| M LA LIGA TV ᴴᴰ', category_id: 548 },
    { stream_id: 11, name: 'M+ LaLigaTV 2 FHD Orange', category_id: 1999 },
    { stream_id: 16, name: 'M+ LaLigaTV 3 HD Orange', category_id: 1999 },
    { stream_id: 12, name: '|ES| DAZN LIGA ᴴᴰ', category_id: 2552 },
    { stream_id: 13, name: '|ES| DAZN LIGA 2 ᴴᴰ', category_id: 2552 },
    { stream_id: 14, name: 'ES: LALIGA+ PPV 1', category_id: 1922 },
    { stream_id: 15, name: '|ES| LA LIGATV', category_id: 548 },
];

const slot = (
    stream_id: number,
    name: string,
    category_id: number
): SportsCatalogStream => ({ stream_id, name, category_id });

const FRENCH_LALIGA: SportsCatalogStream[] = [
    slot(
        101,
        'Next | 2026-10-18 | 19:00 (GMT) | Real Madrid vs. FC Séville | LALIGA EA Sports | FR',
        2001
    ),
    slot(
        102,
        'Next | 2026-10-18 | 16:30 (GMT) | Málaga vs. Real Sociedad | LALIGA EA Sports | FR',
        2001
    ),
    slot(
        103,
        'Live | Osasuna vs. Racing de Santander | LALIGA EA Sports | FR',
        2001
    ),
    slot(
        104,
        'Next | 20:45 - 23 (GMT) | Real Madrid - FC Séville [und] | Spanish LALIGA | FR',
        2002
    ),
    slot(
        105,
        'Next | 18:23 - 20 (GMT) | Malaga CF - Real Sociedad San Sebastian [und] | Spanish LALIGA | FR',
        2002
    ),
    slot(
        106,
        'Live | CA Osasuna - Racing de Santander [und] | Spanish LALIGA | FR',
        2002
    ),
];

const SNAPSHOT = new Date('2026-10-18T12:48:00Z');
const FRENCH_IDS = new Set([101, 102, 103, 104, 105, 106, 201, 202, 203]);

function build(streams: SportsCatalogStream[], now = SNAPSHOT) {
    return buildSportsCatalog(CATEGORIES, streams, now);
}

describe('matches from every language', () => {
    it('finds Real Madrid - Sevilla, named only on French feeds, on the kept LaLiga channels', () => {
        const catalog = build([
            ...LALIGA_CHANNELS,
            slot(
                1,
                'Next | 2026-10-18 | 14:00 (GMT) | RC Celta - Deportivo Alavés | LALIGA EA SPORTS | ES',
                1921
            ),
            ...FRENCH_LALIGA,
        ]);
        const matches = catalog.laliga.matches;
        const madrid = matches.find((match) => match.title.includes('Madrid'));

        expect(matches.map((match) => match.title)).toEqual([
            'Osasuna - Racing de Santander',
            'RC Celta - Deportivo Alavés',
            'Málaga - Real Sociedad',
            'Real Madrid - Sevilla',
        ]);
        expect(madrid?.event).toMatchObject({
            status: 'next',
            home: 'Real Madrid',
            away: 'Sevilla',
            start: new Date('2026-10-18T19:00:00Z'),
        });
        expect(madrid?.via.map((option) => option.name)).toEqual([
            'M+ LaLiga TV',
            'DAZN LaLiga',
            'LaLiga TV',
            'LaLiga+ PPV',
        ]);
        // Its own feed plays the Spanish match; the others offer channels.
        expect(matches[1].via).toEqual([]);
        expect(matches[1].streamId).toBe(1);
        // Each says where it plays: its feed's category, or its channels'.
        expect(matches[1].channelName).toBe('LaLiga PPV');
        expect(madrid?.channelName).toBe('M+ LaLiga TV');
        for (const match of matches) {
            expect(FRENCH_IDS.has(match.streamId)).toBe(false);
            for (const option of match.via) {
                expect(FRENCH_IDS.has(option.channel.streamId)).toBe(false);
            }
        }
    });

    it('shows it in "Partidos de hoy" before and while it is played, not after', () => {
        const catalog = build([...LALIGA_CHANNELS, ...FRENCH_LALIGA]);
        const titles = (iso: string) =>
            todaysMatches(catalog, new Date(iso)).map((match) => match.title);

        // Upcoming: when its kick-off falls on the viewer's day.
        const sameDay =
            new Date('2026-10-18T18:30:00Z').toDateString() ===
            new Date('2026-10-18T19:00:00Z').toDateString();
        expect(
            titles('2026-10-18T18:30:00Z').includes('Real Madrid - Sevilla')
        ).toBe(sameDay);
        expect(titles('2026-10-18T20:30:00Z')).toContain(
            'Real Madrid - Sevilla'
        );
        expect(titles('2026-10-18T21:30:00Z')).not.toContain(
            'Real Madrid - Sevilla'
        );
    });

    it('never offers a match that no kept channel can show', () => {
        const catalog = build([
            ...LALIGA_CHANNELS,
            // Serie A: no kept 24/7 channel; Liga Endesa: basketball's
            // channels carry several leagues.
            slot(
                201,
                'Next | 2026-10-18 | 16:00 (GMT) | AC Milan vs. Atalanta | Serie A Enilive | FR',
                2005
            ),
            slot(202, 'Live | Real Madrid vs. Bilbao | Liga Endesa | FR', 2003),
            slot(
                203,
                'Next | 2026-10-18 | 13:00 (GMT) | Kayanza United vs. Rukinzo | Ligue A - Burundi | FR',
                2003
            ),
        ]);

        expect(catalog['serie-a'].matches).toEqual([]);
        expect(catalog.basketball.matches).toEqual([]);
        expect(catalog['rest-of-world'].matches).toEqual([]);
    });

    it('makes one card of a match every feed spells its own way', () => {
        const catalog = build([
            slot(1, 'Live | SC Cambuur - AZ Alkmaar | Eredivisie | ES', 1110),
            slot(2, 'Live | Cambuur vs. AZ | Eredivisie | FR', 2003),
            slot(
                3,
                'Next | 2026-10-18 | 14:45 (GMT) | Groningen - Ajax | Eredivisie | ES',
                1110
            ),
            slot(
                4,
                'Next | 2026-10-18 | 14:45 (GMT) | Groningue vs. Ajax | Eredivisie | FR',
                2003
            ),
            slot(
                5,
                'Next | 2026-10-18 | 13:30 (GMT) | Bayer Leverkusen - Freiburg | Bundesliga | ES',
                1111
            ),
            slot(
                6,
                'Live | Bayer Leverkusen - SC Freiburg | Bundesliga | DE',
                2004
            ),
            slot(
                7,
                'Next | 2026-10-18 | 15:30 (GMT) | Borussia Mönchengladbach - Hoffenheim | Bundesliga | ES',
                1111
            ),
            slot(
                8,
                "Next | 2026-10-18 | 15:00 (GMT) | Borussia M'gladbach - TSG Hoffenheim | Bundesliga | DE",
                2004
            ),
        ]);
        const summary = (id: 'eredivisie' | 'bundesliga') =>
            catalog[id].matches.map((match) => [
                match.title,
                match.streamId,
                match.event.status,
                match.event.start?.toISOString().slice(11, 16) ?? null,
            ]);

        expect(summary('eredivisie')).toEqual([
            ['SC Cambuur - AZ Alkmaar', 1, 'live', null],
            ['Groningen - Ajax', 3, 'next', '14:45'],
        ]);
        // The German feed already says "Live"; the Spanish kick-off counts.
        expect(summary('bundesliga')).toEqual([
            ['Bayer Leverkusen - Freiburg', 5, 'live', '13:30'],
            ['Borussia Mönchengladbach - Hoffenheim', 7, 'next', '15:30'],
        ]);
        expect(catalog.eredivisie.matches[0].keys).toEqual([
            'eredivisie|cambuur|az alkmaar',
            'eredivisie|cambuur|az',
        ]);
    });

    it('drops a match one feed already calls over, whatever another says', () => {
        const catalog = build([
            slot(1, 'Live | Udinese - Lecce | Serie A | ES', 1112),
            slot(2, 'End | Udinese vs. Lecce | Serie A Enilive | FR', 2005),
            slot(
                3,
                'Next | 2026-10-18 | 18:45 (GMT) | Juventus - Lazio | Serie A | ES',
                1112
            ),
            // An earlier meeting's "End" does not end tonight's match, nor
            // does a studio show's.
            slot(4, 'End | Juventus vs. Lazio | Serie A Enilive | FR', 2005),
            slot(
                5,
                'End | Juventus vs. Lazio - avant-match | Serie A Enilive | FR',
                2005
            ),
        ]);

        expect(catalog['serie-a'].matches.map((match) => match.title)).toEqual([
            'Juventus - Lazio',
        ]);
    });

    it("plays a kept feed of the viewer's region first", () => {
        const catalog = build([
            slot(
                1,
                'Live | Leeds United vs. Manchester United | Premier League | GB',
                1114
            ),
            slot(
                2,
                'Live | Leeds United - Manchester United | Premier League | ES',
                1113
            ),
        ]);

        expect(
            catalog['premier-league'].matches.map((match) => match.streamId)
        ).toEqual([2]);
    });
});

describe('announcedKickOffs', () => {
    it("reads every feed's announced kick-offs, by match key", () => {
        const kickOffs = announcedKickOffs([
            {
                name: 'Next | 2026-10-18 | 19:00 (GMT) | Real Madrid vs. FC Séville | LALIGA EA Sports | FR',
            },
            {
                name: "Next | 2026-10-18 | 15:00 (GMT) | Borussia M'gladbach - TSG Hoffenheim | Bundesliga | DE",
            },
            {
                name: 'Next | 2026-10-18 | 15:30 (GMT) | Borussia Mönchengladbach - Hoffenheim | Bundesliga | ES',
            },
            {
                name: 'Live | Osasuna vs. Racing de Santander | LALIGA EA Sports | FR',
            },
            {
                name: 'Next | 20:45 - 23 (GMT) | Real Madrid - FC Séville [und] | Spanish LALIGA | FR',
            },
            { name: '|ES| M LA LIGA TV ᴴᴰ' },
        ]);

        expect([...kickOffs.entries()]).toEqual([
            ['laliga|real madrid|sevilla', Date.parse('2026-10-18T19:00:00Z')],
            [
                'bundesliga|monchengladbach|hoffenheim',
                Date.parse('2026-10-18T15:30:00Z'),
            ],
        ]);
    });
});

describe('categoryChannelName', () => {
    it("names the channel an event feed's category stands for", () => {
        expect(categoryChannelName('|ES| ✪ DAZN EVENT')).toBe('DAZN');
        expect(categoryChannelName('|ES| ✪ PREMIER LEAGUE PPV')).toBe(
            'Premier League PPV'
        );
        expect(categoryChannelName('|ES| ✪ LALIGA HYPERMOTION PPV')).toBe(
            'LaLiga Hypermotion PPV'
        );
        expect(categoryChannelName('|ES| ✪ DAZN FEME SOLO EVENTOS')).toBe(
            'DAZN Feme'
        );
    });
});

describe('a feed filed under another sport', () => {
    // The provider files "Paris FC - Stade Rennais FC | Ligue 1" under
    // Formula 1 (18 October 2026).
    const categories = [
        { category_id: 1, category_name: '|ES| ✪ FORMULA 1' },
        { category_id: 2, category_name: '|ES| ✪ DAZN EVENT' },
    ];
    const ligue1 =
        'Next | 2026-10-18 | 15:15 (GMT) | Paris FC - Stade Rennais FC | Ligue 1 | ES';

    it('plays the match without offering the other sport’s channel', () => {
        const [match] = buildSportsCatalog(
            categories,
            [slot(1, ligue1, 1)],
            SNAPSHOT
        )['ligue-1'].matches;

        expect(match.streamId).toBe(1);
        expect(match.channelName).toBeNull();
    });

    it('prefers a feed of the match’s own sport, and names it', () => {
        const [match] = buildSportsCatalog(
            categories,
            [slot(1, ligue1, 1), slot(2, ligue1, 2)],
            SNAPSHOT
        )['ligue-1'].matches;

        expect(match.streamId).toBe(2);
        expect(match.channelName).toBe('DAZN');
    });

    it('still names a race on Formula 1', () => {
        const [race] = buildSportsCatalog(
            categories,
            [
                slot(
                    3,
                    'Live | Gran Premio de Estados Unidos | Formula 1 | ES',
                    1
                ),
            ],
            SNAPSHOT
        ).motor.matches;

        expect(race.channelName).not.toBeNull();
    });
});
