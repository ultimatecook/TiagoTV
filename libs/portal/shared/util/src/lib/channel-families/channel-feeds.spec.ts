import {
    channelFeedGroup,
    feedRegionOfCategory,
    isFeedChannel,
    type ChannelFeedGroup,
    type FeedCandidate,
} from './channel-feeds';

// Names as the provider lists them (a snapshot of the real catalog).
const ARGENTINA = '|LAT|  ✪ ARGENTINA';
const US_SPORTS = '|US| ✪ SPORTS';
const SPAIN = '|ES| ✪ DEPORTES';

let nextId = 1;
function feed(
    title: string,
    category: string,
    icon: string | null = `http://logos.example/${nextId}.png`
): FeedCandidate {
    return {
        id: nextId++,
        title,
        icon,
        region: feedRegionOfCategory(category),
    };
}

const espnArg = feed('|ARGENT ᴴᴰ -  ESPN ARG ᴴᴰ-', ARGENTINA);
const espn = feed('|ARG| ESPN', ARGENTINA);
const espn2 = feed('|ARG| ESPN 2', ARGENTINA);
const espnPlus = feed('|ARG| ESPN+', ARGENTINA);
const espnUs = feed('|US| ESPN USA', US_SPORTS);
const espnUs2 = feed('|US| ESPN 2 ᴴᴰ', US_SPORTS);
const espnUs3 = feed('|US| ESPN 3 ᴴᴰ', US_SPORTS);
const espnNews = feed('|US| ESPN NEWS ᴴᴰ', US_SPORTS);

const foxSport = feed('|ARG| FOX SPORT', ARGENTINA);
const fox1 = feed('|ARG| FOX SPORTS 1 ᴴᴰ', ARGENTINA);
const fox1Opc2 = feed('|ARG| FOX SPORTS 1 ᴴᴰ (opc2)', ARGENTINA);
const fox2 = feed('|ARG| FOX SPORT 2', ARGENTINA);
const fox3 = feed('|ARG| FOX SPORT 3', ARGENTINA);
const foxPremium = feed('|ARG| FOX SPORTS PREMIUM ᴴᴰ', ARGENTINA);
const foxUs1 = feed('|US| Fox Sports 1 ᴴᴰ US', US_SPORTS);
const foxUs2 = feed('|US| Fox Sports 2 ᴴᴰ US', US_SPORTS);
const foxFlorida = feed('|US| Fox Sports Florida ᴴᴰ US', US_SPORTS);

const tyc = feed('|ARG| TYC SPORTS ᴬᴿᴳᴱᴺᵀᴵᴺᴬ ᴴᴰ', ARGENTINA);
const tycCopy = feed('|ARG| TYC SPORTS', ARGENTINA, null);
const tycInternational = feed('ARG TyC SPORTS INTERNACIONAL', ARGENTINA);
const tycUs = feed('|US| TYC SPORTS HD', US_SPORTS);

const hypermotion = feed('|ES| LA LIGATV HYPERMOTION', SPAIN);
const hypermotion2 = feed('|ES| LA LIGATV 2 HYPERMOTION', SPAIN);
const hypermotion2Orange = feed('HYPERMOTION 2 HD Orange', SPAIN);

const catalog: readonly FeedCandidate[] = [
    espnArg,
    espn,
    espn2,
    espnPlus,
    espnUs,
    espnUs2,
    espnUs3,
    espnNews,
    foxSport,
    fox1,
    fox1Opc2,
    fox2,
    fox3,
    foxPremium,
    foxUs1,
    foxUs2,
    foxFlorida,
    feed('|US| Fox Deportes', US_SPORTS),
    feed('|ES| FOX ᵁᴴᴰ', SPAIN),
    tyc,
    tycCopy,
    tycInternational,
    tycUs,
    hypermotion,
    hypermotion2,
    hypermotion2Orange,
    feed('|UK|  BBC ONE EAST E', '|UK| ✪ BBC GENERAL'),
    feed(
        'Live | Leeds United - Manchester United | Premier League | ES',
        SPAIN
    ),
    feed('ES | No Event', SPAIN),
    feed(':NBA 13', '|US| ✪ NBA PPV'),
];

/** Each country's options as "label", "label #copy" and "*" for the one playing. */
function lineUp(group: ChannelFeedGroup | null) {
    return group?.regions.map((region) => [
        region.region,
        region.options.map(
            (option) =>
                `${option.current ? '*' : ''}${option.label}${
                    option.copy > 1 ? ` #${option.copy}` : ''
                }`
        ),
    ]);
}

describe('channelFeedGroup', () => {
    it("lists Argentina's ESPN feeds first, then the brand's other countries", () => {
        const group = channelFeedGroup(espn2, catalog);

        expect(group?.name).toBe('ESPN');
        expect(group?.brand?.id).toBe('espn');
        expect(lineUp(group)).toEqual([
            ['AR', ['ESPN', '*ESPN 2', 'ESPN+']],
            ['US', ['ESPN', 'ESPN 2', 'ESPN 3', 'ESPN News']],
        ]);
        expect(group?.alternatives).toBe(6);
    });

    it('offers every copy of the feed that plays, the first copy of the others', () => {
        const group = channelFeedGroup(espn, catalog);

        expect(lineUp(group)?.[0]).toEqual([
            'AR',
            ['ESPN', '*ESPN #2', 'ESPN 2', 'ESPN+'],
        ]);
        expect(group?.regions[0].options[0].channel).toBe(espnArg);
    });

    it("puts the playing channel's country first", () => {
        expect(
            lineUp(channelFeedGroup(espnUs3, catalog))?.map(
                ([region]) => region
            )
        ).toEqual(['US', 'AR']);
    });

    it('gathers all of FOX Sports, its premium feed after the numbered ones', () => {
        const group = channelFeedGroup(fox1, catalog);

        expect(group?.key).toBe('fox-sports');
        expect(lineUp(group)).toEqual([
            [
                'AR',
                [
                    'FOX Sports 1',
                    '*FOX Sports 1 #2',
                    'FOX Sports 1 #3',
                    'FOX Sports 2',
                    'FOX Sports 3',
                    'FOX Sports Premium',
                ],
            ],
            ['US', ['FOX Sports 1', 'FOX Sports 2', 'Fox Sports Florida']],
        ]);
        // "FOX SPORT" is the first feed's other spelling, not FOX Deportes
        // or the Spanish FOX entertainment channel.
        expect(group?.regions[0].options[0].channel).toBe(foxSport);
    });

    it('keeps the copies numbered the same whichever of them plays', () => {
        expect(lineUp(channelFeedGroup(fox1Opc2, catalog))?.[0]).toEqual([
            'AR',
            [
                'FOX Sports 1',
                'FOX Sports 1 #2',
                '*FOX Sports 1 #3',
                'FOX Sports 2',
                'FOX Sports 3',
                'FOX Sports Premium',
            ],
        ]);
    });

    it('lists TyC Sports with its international feed', () => {
        const group = channelFeedGroup(tyc, catalog);

        expect(lineUp(group)).toEqual([
            [
                'AR',
                ['*TyC Sports', 'TyC Sports #2', 'TyC Sports Internacional'],
            ],
            ['US', ['TyC Sports']],
        ]);
        expect(group?.icon).toBe(tyc.icon);
    });

    it('groups a channel no brand claims by its own family', () => {
        const group = channelFeedGroup(hypermotion2Orange, catalog);

        expect(group?.name).toBe('LaLiga TV Hypermotion');
        expect(group?.brand).toBeNull();
        expect(lineUp(group)).toEqual([
            [
                'ES',
                [
                    'LaLiga TV Hypermotion',
                    'LaLiga TV Hypermotion 2',
                    '*LaLiga TV Hypermotion 2 #2',
                ],
            ],
        ]);
    });

    it('offers nothing for a channel with no other feed or copy', () => {
        expect(channelFeedGroup(catalog[26], catalog)).toBeNull();
    });

    it("offers nothing for a match's event slot", () => {
        expect(channelFeedGroup(catalog[27], catalog)).toBeNull();
        expect(channelFeedGroup(catalog[29], catalog)).toBeNull();
    });

    it('keeps the playing channel when the list does not hold it', () => {
        const searched = { ...espn2, id: 9999 };
        const group = channelFeedGroup(searched, [espn, espnUs]);

        expect(lineUp(group)).toEqual([
            ['AR', ['ESPN', '*ESPN 2']],
            ['US', ['ESPN']],
        ]);
    });
});

describe('feedRegionOfCategory', () => {
    it.each([
        ['|LAT|  ✪ ARGENTINA', 'AR'],
        ['|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT', 'AR'],
        ['|LAT| ✪ MEXICO', null],
        ['|ES| ✪ DAZN LA LIGA', 'ES'],
        ['|US| ✪ SPORTS', 'US'],
        ['|UK| ✪ SPORTS', 'GB'],
        // Arabic, not Argentina.
        ['|AR| ✪ BEIN SPORT HD', null],
        ['Sports', null],
    ])('files %s under %s', (name, region) => {
        expect(feedRegionOfCategory(name)).toBe(region);
    });
});

describe('isFeedChannel', () => {
    it('leaves out event slots, idle or empty', () => {
        expect(isFeedChannel('|ARG| ESPN 2')).toBe(true);
        expect(
            isFeedChannel(
                'Next | 2026-10-18 | 15:30 (GMT) | Nottingham Forest - Arsenal | Premier League | ES'
            )
        ).toBe(false);
        expect(isFeedChannel('GB | No Event')).toBe(false);
        expect(isFeedChannel('UEFA | 15 -')).toBe(false);
    });
});
