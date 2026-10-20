import {
    feedLanguage,
    feedQuality,
    nextFeed,
    type MatchFeed,
} from './match-feeds';
import { parseNamedMatch } from './sport-events';
import {
    buildSportsCatalog,
    type SportMatch,
    type SportsCatalogStream,
} from './sports-catalog';

/**
 * A Champions League night modelled on the provider's spellings: in Spain
 * it airs on Movistar Liga de Campeones (whose names never carry the
 * match), Germany's and France's event slots name it, the UK's numbered
 * UEFA listing names it, and an Arabic pack lists it with its date.
 */
const CATEGORIES = [
    { category_id: 1395, category_name: '|ES| ✪ M LCAMPEON' },
    { category_id: 1374, category_name: '|DE| ✪ UEFA CHAMPIONS LEAGUE' },
    { category_id: 1677, category_name: '|UK| ✪ UEFA CHAMPIONS LEAGUE' },
    { category_id: 902, category_name: '|FR| ✪ DAZN EVENT' },
    { category_id: 2150, category_name: '|AR| ✪ TOD BEIN SPORTS' },
    { category_id: 2565, category_name: '|AR| ✪ FIFA WORLD CUP 2026 REPLY' },
    { category_id: 1396, category_name: '|ES| ✪ LALIGA' },
    { category_id: 1327, category_name: '|ES| ✪ LALIGA PPV' },
    { category_id: 493, category_name: '|LAT|  ✪ ARGENTINA' },
    { category_id: 2410, category_name: 'FR| ✪ DAZN LALIGA ES' },
    { category_id: 1709, category_name: '|UK| ✪ DAZN EVENT' },
];

const stream = (
    stream_id: number,
    name: string,
    category_id: number
): SportsCatalogStream => ({ stream_id, name, category_id });

const MOVISTAR: SportsCatalogStream[] = [
    stream(11, '|ES| M  Liga de LCAMPEON FHD SAT', 1395),
    stream(12, '|ES| M  Liga de LCAMPEON HD SAT', 1395),
    stream(10, '|ES| M+LCAMPEON ˢᴰ', 1395),
    stream(13, '|ES| M+LCAMPEON 2 ᴴᴰ', 1395),
];

const NIGHT = new Date('2026-10-21T19:30:00Z');

function championsMatch(extra: SportsCatalogStream[] = []): SportMatch {
    const catalog = buildSportsCatalog(
        CATEGORIES,
        [
            ...MOVISTAR,
            stream(
                20,
                'Live | Paris Saint-Germain - FC Barcelona | UEFA Champions League | DE',
                1374
            ),
            stream(30, 'UEFA | 05 - PSG vs Barcelona 21:00 pm SD', 1677),
            stream(31, 'UEFA | 25 - PSG vs Barcelona 21:00 pm HD', 1677),
            stream(32, 'UEFA | 06 - Benfica vs Celtic 21:00 pm', 1677),
            stream(
                40,
                'Live | Paris SG vs. Barcelone | Ligue des champions | FR',
                902
            ),
            stream(
                50,
                'TOD EV 012|  UEFA Champions League: Paris Saint-Germain vs Barcelona (2026-10-21 19:00:00)',
                2150
            ),
            // An old listing's date, and a replay: neither carries it now.
            stream(
                51,
                'TOD EV 013|  UEFA Champions League: Paris Saint-Germain vs Barcelona (2026-03-11 20:00:00)',
                2150
            ),
            stream(60, 'PSG vs Barcelona', 2565),
            ...extra,
        ],
        NIGHT
    );
    const match = catalog['champions-league'].matches[0];
    expect(match).toBeDefined();
    return match;
}

const ids = (feeds: readonly MatchFeed[] | undefined) =>
    (feeds ?? []).map((feed) => feed.channel.streamId);

describe('match feeds', () => {
    it('lists every signal of the match in any language, in the owner’s order', () => {
        const match = championsMatch();

        // Movistar plays it by default, as before.
        expect(match.streamId).toBe(11);
        expect(match.channelName).toBe('Movistar Liga de Campeones');
        expect(
            match.feeds?.map((feed) => [
                feed.label,
                feed.name,
                feed.named,
                feed.quality,
            ])
        ).toEqual([
            ['España', 'Movistar Liga de Campeones', false, 'FHD'],
            ['España', 'Movistar Liga de Campeones', false, 'HD'],
            ['Inglés (UK)', 'UEFA Champions League', true, 'HD'],
            ['Inglés (UK)', 'UEFA Champions League', true, 'SD'],
            ['Francés', 'DAZN', true, null],
            ['Alemán', 'UEFA Champions League', true, null],
            ['Árabe', 'Tod beIN Sports', true, null],
        ]);
        expect(ids(match.feeds)).toEqual([11, 12, 31, 30, 40, 20, 50]);
        // The numbered UEFA listing keeps its slot's number.
        expect(match.feeds?.[2].number).toBe(25);
        expect(match.feeds?.[0].flag).toBe('es');
        expect(match.feeds?.[2].flag).toBe('gb');
        expect(match.feeds?.[4].flag).toBeNull();
    });

    it('puts Argentina’s and Spain’s own feeds first, the kept one still the default', () => {
        const catalog = buildSportsCatalog(
            CATEGORIES,
            [
                stream(1, '|ES| M LA LIGA TV ᴴᴰ', 1396),
                stream(
                    2,
                    'Live | Barcelona vs. Getafe | LALIGA EA Sports | FR',
                    2410
                ),
                stream(
                    3,
                    'Live | FC Barcelona - Getafe CF | LALIGA EA SPORTS | ES',
                    1327
                ),
                stream(4, 'Live | Barcelona - Getafe | LaLiga | AR', 493),
                stream(5, 'Live | Barcelona vs. Getafe | LaLiga | GB', 1709),
            ],
            NIGHT
        );
        const match = catalog.laliga.matches[0];

        expect(match.streamId).toBe(4);
        expect(match.via).toEqual([]);
        expect(match.feeds?.map((feed) => feed.label)).toEqual([
            'Argentina',
            'España',
            'Inglés (UK)',
            'Francés',
        ]);
        expect(ids(match.feeds)).toEqual([4, 3, 5, 2]);
    });

    it('lists one stream once', () => {
        const match = championsMatch([
            stream(
                20,
                'Live | Paris Saint-Germain - FC Barcelona | UEFA Champions League | DE',
                1374
            ),
        ]);

        expect(ids(match.feeds).filter((id) => id === 20)).toHaveLength(1);
    });
});

describe('feedLanguage', () => {
    it.each([
        ['|ES| ✪ DAZN EVENT', 'ES', 'España', 'es'],
        ['|LAT|  ✪ ARGENTINA', 'ARG', 'Argentina', 'ar'],
        ['|LAT|  ✪ MEXICO', 'MX', 'México', 'mx'],
        ['|LAT|  ✪ BR SPORTS', 'BR', 'Portugués (Brasil)', null],
        ['|AR| ✪ BEIN SPORT HD', 'AR', 'Árabe', null],
        ['|UK| ✪ ARABIC TV', 'AR', 'Árabe', null],
        ['|UK| ✪ TNT SPORTS EVENT', 'UK', 'Inglés (UK)', 'gb'],
        ['|US| ✪ LATINO NETWORK', 'US-ES', 'Español (EE. UU.)', 'us'],
        ['|CA| ✪ QUEBEC SPORT', 'CA-FR', 'Francés (Canadá)', 'ca'],
        ['FR| ✪ DAZN LALIGA ES', 'FR', 'Francés', null],
        ['|IT|✪  DAZN EVENT', 'IT', 'Italiano', null],
        ['|PPV| ✪ ALL PPV EVENT', 'PPV', 'PPV', null],
    ])('reads %s', (name, code, label, flag) => {
        expect(feedLanguage(name)).toMatchObject({ code, label, flag });
    });
});

describe('feedQuality', () => {
    it.each([
        ['|ES| M  Liga de LCAMPEON FHD SAT', 'FHD'],
        ['|ES| M+LCAMPEON 2 ᴴᴰ', 'HD'],
        ['|ES| M+LCAMPEON ˢᴰ', 'SD'],
        ['|ES| DAZN LIGA ᵁᴴᴰ', 'UHD'],
        ['|ES| DAZN LIGA', null],
    ])('reads %s', (name, quality) => {
        expect(feedQuality(name)).toBe(quality);
    });
});

describe('parseNamedMatch', () => {
    const now = new Date('2026-10-21T12:00:00Z');

    it.each([
        [
            'UEFA | 13 - Aston Villa vs Ajax 20.00',
            { home: 'Aston Villa', away: 'Ajax', number: 13 },
        ],
        [
            'Scottish Cup 6: 20:00 Buckie Thistle vs Dundee United',
            { home: 'Buckie Thistle', away: 'Dundee United', number: 6 },
        ],
        [
            'LOI TV 2 | Longford Town v Cork City',
            { home: 'Longford Town', away: 'Cork City', number: 2 },
        ],
        [
            'TOD EV 019|  FIFA U-17 Women’s WC: Canada vs Brazil (2026-10-21 14:40:00)',
            { home: 'Canada', away: 'Brazil', number: 19 },
        ],
    ])('reads %s', (name, expected) => {
        expect(parseNamedMatch(name, now)).toEqual(expected);
    });

    it.each([
        'M+ LaLiga TV',
        'TOD EV 003|  FIFA U-17 Women’s WC: Spain vs Mexico (2026-06-05 14:40:00)',
        'Super League Plus Event 1 | Leigh Leopards vs Wakefield Trinity // UK Fri 11 Sep 7:50pm',
    ])('reads nothing to watch now in %s', (name) => {
        expect(parseNamedMatch(name, now)).toBeNull();
    });
});

describe('nextFeed', () => {
    const feed = (streamId: number): MatchFeed => ({
        channel: {
            streamId,
            categoryId: '1',
            title: `${streamId}`,
            icon: null,
        },
        name: `${streamId}`,
        number: null,
        language: 'ES',
        label: 'España',
        flag: 'es',
        named: true,
        quality: null,
    });
    const feeds = [feed(1), feed(2), feed(3), feed(4)];

    it('tries the next one in order, then the earlier ones', () => {
        expect(nextFeed(feeds, 2, new Set([2]))?.channel.streamId).toBe(3);
        expect(nextFeed(feeds, 4, new Set([4]))?.channel.streamId).toBe(1);
    });

    it('skips the ones that failed, and gives up when none is left', () => {
        expect(nextFeed(feeds, 1, new Set([1, 2]))?.channel.streamId).toBe(3);
        expect(nextFeed(feeds, 1, new Set([1, 2, 3, 4]))).toBeNull();
        expect(nextFeed([feed(1)], 1, new Set())).toBeNull();
    });

    it('starts from the first for a stream that is none of them', () => {
        expect(nextFeed(feeds, 99, new Set())?.channel.streamId).toBe(1);
    });
});
