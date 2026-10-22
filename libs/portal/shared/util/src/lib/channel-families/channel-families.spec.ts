import {
    channelFamilyName,
    feedTitle,
    groupChannelFamilies,
    hasWhiteLogo,
    parseChannelName,
    type FamilyChannel,
} from './channel-families';

function channel(name: string, icon: string | null = null): FamilyChannel {
    return { title: name, icon };
}

describe('parseChannelName', () => {
    it.each([
        ['|ES| DAZN LIGA 1 HD B', 'dazn laliga', 1, true],
        ['|ES| DAZN LIGA HD', 'dazn laliga', null, false],
        ['|ES| DAZNT LA LIGA 2 ᵁᴴᴰ', 'dazn laliga', 2, false],
        ['|ES-P| LaLiga Hypermotion TV 3', 'laliga hypermotion', 3, false],
        ['|ES| LA LIGATV 2 HYPERMOTION', 'laliga hypermotion', 2, false],
        ['ES-LALIGA TV HYPERMOTION 11 HD', 'laliga hypermotion', 11, false],
        ['HYPERMOTION 2 HD Orange', 'laliga hypermotion', 2, false],
        ['M+ LaLigaTV 3 FHD Orange', 'm+ laliga', 3, false],
        ['|ES| M LA LIGA TV ᵁᴴᴰ', 'm+ laliga', null, false],
        ['|ES| M. LaLiga 2 ᵁᴴᴰ', 'm+ laliga', 2, false],
        ['|ES| M+LCAMPEON 5 ᴴᴰ', 'm+ liga de campeones', 5, false],
        [
            '|ES| M  Liga de LCAMPEON FHD SAT',
            'm+ liga de campeones',
            null,
            false,
        ],
        ['|ES| M.LCAMPEONES ᵁᴴᴰ', 'm+ liga de campeones', null, false],
        [
            '|ES| MOVISTAR PRIMERA FEDERACION FHD',
            'm+ primera federacion',
            null,
            false,
        ],
        ['ES| + Baloncesto 2 HD', 'm+ baloncesto', 2, false],
        ['|ARG| DIRECT TV SPORTS 2', 'directv sports', 2, false],
        ['|ARGENT ᴴᴰ -  ESPN ARG ᴴᴰ-', 'espn', null, false],
        ['|US| Fox Sports 1 ᴴᴰ US', 'fox sports', 1, false],
        // ESPN Premium, listed by its name before 2022.
        ['|ARG| FOX SPORTS PREMIUM ᴴᴰ', 'espn premium', null, false],
        ['|UK| SKY F1 ˢᴰ', 'sky sports f1', null, false],
        ['|ES| DAZN FORMULA 1 ᴴᴰ', 'dazn f1', null, false],
        ['|ES|NBA TV 7', 'nba', 7, false],
    ])('reads %s', (name, key, feed, backup) => {
        expect(parseChannelName(name)).toEqual({ key, feed, backup });
    });

    it('leaves the numbers of an event slot in its name', () => {
        const parts = parseChannelName(
            "UEFA | 01 - AZ Alkmaar vs H Be'er Sheva 17:45 pm"
        );

        expect(parts.feed).toBeNull();
        expect(parts.key).toContain('az alkmaar');
    });
});

describe('channelFamilyName', () => {
    it('knows the main families by name', () => {
        expect(channelFamilyName('laliga hypermotion', [])).toBe(
            'LaLiga TV Hypermotion'
        );
        expect(channelFamilyName('m+ liga de campeones', [])).toBe(
            'Movistar Liga de Campeones'
        );
    });

    it('prefers a spelling in mixed case, then the shortest', () => {
        expect(
            channelFamilyName('nba international', [
                'NBA TV INTERNATIONAL',
                '|ES-P| NBA TV International HD',
                'NBA TV International Extended',
            ])
        ).toBe('NBA TV International');
    });

    it('writes a name in capitals the brands’ way', () => {
        expect(
            channelFamilyName('sky sports premier league', [
                '|UK| SKY SPORTS PREMIER LEAGUE ᴴᴰ',
            ])
        ).toBe('Sky Sports Premier League');
        expect(channelFamilyName('laliga+ ppv', ['LALIGA+ PPV 12'])).toBe(
            'LaLiga+ PPV'
        );
        expect(channelFamilyName('m+ baloncesto', ['+ Baloncesto 2'])).toBe(
            'M+ Baloncesto'
        );
    });
});

describe('channelFamilyName for the live brands', () => {
    it('drops a trailing country code', () => {
        expect(
            channelFamilyName('fox sports florida', [
                '|US| Fox Sports Florida ᴴᴰ US',
            ])
        ).toBe('Fox Sports Florida');
    });

    it("writes the brands' other feeds their way", () => {
        expect(channelFamilyName('espn premium', [])).toBe('ESPN Premium');
        expect(channelFamilyName('tyc sports internacional', [])).toBe(
            'TyC Sports Internacional'
        );
        expect(channelFamilyName('espn+', ['|ARG| ESPN+'])).toBe('ESPN+');
        expect(
            channelFamilyName('espn acc network', ['|US| ESPN ACC NETWORK'])
        ).toBe('ESPN ACC Network');
    });
});

describe('channelFamilyName for event slots', () => {
    it('names a pay-per-view slot after its event and time', () => {
        const uefa = 'UEFA | 03 - Lech Poznan vs Bayer 04 Leverkusen 17:45 pm';
        const nba =
            'Philadelphia 76ers vs Boston Celtics @ Oct 16 7:00 PM :NBA 01';

        expect(channelFamilyName(parseChannelName(uefa).key, [uefa])).toBe(
            'Lech Poznan vs Bayer 04 Leverkusen · 17:45'
        );
        expect(channelFamilyName(parseChannelName(nba).key, [nba])).toBe(
            'Philadelphia 76ers vs Boston Celtics · Oct 16 7:00 PM'
        );
    });
});

describe('groupChannelFamilies', () => {
    const dazn = 'https://lo1.in/it/dzn.png';
    const hyper = 'http://logos.example/LALIGATVHYPERMOTION.png';
    const channels = [
        channel('|ES-P| LaLiga Hypermotion TV'),
        channel('|ES-P| LaLiga Hypermotion TV 2'),
        channel('|ES| DAZN LIGA 1 HD B', dazn),
        channel('|ES| DAZN LIGA HD', dazn),
        channel('|ES| DAZN LIGA 2 HD', dazn),
        channel('|ES| LA LIGATV HYPERMOTION', hyper),
        channel('|ES| LA LIGATV 3 HYPERMOTION', hyper),
        channel('HYPERMOTION 2 HD Orange', 'https://orange.example/MLIGS2'),
        channel('|UK| LA LIGATV ᴴᴰ'),
    ];
    const families = groupChannelFamilies(channels);

    it('gathers the spellings of one channel into numbered feeds', () => {
        expect(
            families.map((family) => [
                family.name,
                family.feeds.map((feed) => feed.number),
            ])
        ).toEqual([
            ['LaLiga TV Hypermotion', [1, 2, 3]],
            ['DAZN LaLiga', [1, 2]],
            ['LaLiga TV', [1]],
        ]);
    });

    it('keeps the other copies of a feed behind the one that plays', () => {
        const hypermotion = families[0];
        const second = hypermotion.feeds[1].channels;

        expect(second).toHaveLength(2);
        // The copy with a logo plays first.
        expect(second[0].title).toBe('HYPERMOTION 2 HD Orange');
    });

    it("never plays a provider's backup first", () => {
        const first = families[1].feeds[0].channels;

        expect(first.map((copy) => copy.title)).toEqual([
            '|ES| DAZN LIGA HD',
            '|ES| DAZN LIGA 1 HD B',
        ]);
    });

    it('lists the commonest logo first', () => {
        expect(families[0].icons[0]).toBe(hyper);
        expect(families[1].icons).toEqual([dazn]);
        expect(families[2].icons).toEqual([]);
    });

    it('names a feed after its family', () => {
        const hypermotion = families[0];

        expect(feedTitle(hypermotion, hypermotion.feeds[2].channels[0])).toBe(
            'LaLiga TV Hypermotion 3'
        );
        expect(feedTitle(hypermotion, hypermotion.feeds[0].channels[0])).toBe(
            'LaLiga TV Hypermotion'
        );
    });
});

describe('hasWhiteLogo', () => {
    it("knows DAZN's and Prime Video's logos are white", () => {
        expect(hasWhiteLogo('dazn laliga', null)).toBe(true);
        expect(
            hasWhiteLogo(
                'laliga hypermotion',
                'https://m.media-amazon.com/images/G/01/LCXO_Station_Logos/la_liga_hypermotion.png'
            )
        ).toBe(true);
        expect(hasWhiteLogo('m+ laliga', 'http://logos.example/M.png')).toBe(
            false
        );
    });
});
