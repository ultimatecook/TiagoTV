import {
    channelQuality,
    copyLabels,
    countryChannelName,
    groupCountryChannels,
    mergeChannelGroups,
    type CountryChannel,
} from './country-channels';

describe('countryChannelName', () => {
    it.each([
        ['|ARG| C5N ᴴᴰ', ['ARGENT', 'ARG', 'AR'], 'C5N'],
        ['ARGENT - TV PUBLICA', ['ARGENT', 'ARG', 'AR'], 'TV PUBLICA'],
        ['|ARG|  GARAGE.', ['ARGENT', 'ARG', 'AR'], 'GARAGE'],
        ['|ARG| TELESUR  :)', ['ARGENT', 'ARG', 'AR'], 'TELESUR'],
        [
            'US (P+) Argentina Liga Profesional De Futbol 1',
            ['ARGENT', 'ARG', 'AR'],
            'Argentina Liga Profesional De Futbol 1',
        ],
        ['CHL Canal 1 Nuble HD', ['CHL', 'CHI', 'CL'], 'Canal 1 Nuble'],
        ['PE ▎LIGA1', ['PER', 'PE'], 'LIGA1'],
        ['ECU: ECOTELTV ᴱᶜᵘᵃᵈᵒʳ ᴴᴰ', ['ECU', 'EC'], 'ECOTELTV'],
        ['|EC|  Televicentro TVC ᴴᴰ EC', ['ECU', 'EC'], 'Televicentro TVC'],
        ['|Ecuador|  Gol TV-ᴴᴰ', ['ECU', 'EC'], 'Gol TV'],
        ['PRI: Univision ᴾᵁᴱᴿᵀᴼ ᴿⁱᶜᵒ ᴴᴰ', ['PRI', 'PR'], 'Univision'],
        ['|CA| APTN ᴴᴰ (CA)', ['CAN', 'CA'], 'APTN'],
        ['ES BBC Drama', ['ESP', 'ES'], 'BBC Drama'],
        [
            'CAR - FOX SOCCER PLUS | ᴴᴰ',
            ['LATIN', 'LAM', 'CAR'],
            'FOX SOCCER PLUS',
        ],
        ['|ES| DAZN LIGA 1 HD B', ['ESP', 'ES'], 'DAZN LIGA 1 B'],
    ])('names "%s"', (raw, codes, title) => {
        expect(countryChannelName(raw, codes).title).toBe(title);
    });

    it('keeps an event channel’s match and competition', () => {
        expect(
            countryChannelName(
                'Live | Leeds United - Manchester United | Premier League | ES',
                ['ESP', 'ES']
            )
        ).toEqual({
            title: 'Leeds United - Manchester United',
            subtitle: 'Premier League',
        });
    });

    it('never empties a name', () => {
        expect(countryChannelName('|ES|', ['ESP', 'ES']).title).toBe('|ES|');
    });
});

describe('channelQuality', () => {
    it.each([
        ['|ES| La 1 ᵁᴴᴰ', 'UHD'],
        ['|DE| Eurosport 2 ᶠᴴᴰ', 'FHD'],
        ['|ES| La 1 ᴴᴰ', 'HD'],
        ['|IT| SKY SPORT MAX ˢᴰ', 'SD'],
        ['Discovery 4K', 'UHD'],
        ['CHL Win Sports FHD', 'FHD'],
        ['|ARG| C5N', null],
    ])('reads "%s" as %s', (raw, quality) => {
        expect(channelQuality(raw)).toBe(quality);
    });
});

describe('groupCountryChannels', () => {
    const input = (streamId: number, name: string, icon: string | null) => ({
        streamId,
        categoryId: '1325',
        name,
        icon,
    });

    it('puts a channel’s copies on one card, the best first', () => {
        const groups = groupCountryChannels(
            [
                input(1, '|ES| La 1 ᴴᴰ', 'la1.png'),
                input(2, '|ES| Antena 3 ᵁᴴᴰ', null),
                input(3, '|ES| LA 1 ˢᴰ', 'la1-sd.png'),
                input(4, '|ES| La 1 ᵁᴴᴰ', 'la1.png'),
            ],
            ['ESP', 'ES']
        );

        expect(groups.map((group) => group.title)).toEqual([
            'La 1',
            'Antena 3',
        ]);
        expect(groups[0].copies.map((copy) => copy.streamId)).toEqual([
            4, 1, 3,
        ]);
        expect(groups[0].copies.map((copy) => copy.quality)).toEqual([
            'UHD',
            'HD',
            'SD',
        ]);
        expect(groups[0].icons).toEqual(['la1.png', 'la1-sd.png']);
        expect(groups[1].icons).toEqual([]);
    });

    it('writes a name given in capitals as by hand', () => {
        const [group] = groupCountryChannels(
            [input(1, '|ARG| AMERICA TV ᴴᴰ', null)],
            ['ARG']
        );
        expect(group.title).toBe('America TV');
        expect(group.copies[0].title).toBe('America TV');
    });

    it('drops a slot’s broadcast window from its name', () => {
        expect(
            countryChannelName(
                'UFC 03 : CAGE WARRIORS 211 start:2026-10-17 20:25:00 stop:2026-10-18 00:30:00',
                ['USA', 'US']
            ).title
        ).toBe('UFC 03 : CAGE WARRIORS 211');
    });

    it('prefers a copy with a logo among equals', () => {
        const [group] = groupCountryChannels(
            [
                input(1, '|ARG| Cronica', null),
                input(2, '|ARG| CRONICA', 'c.png'),
            ],
            ['ARG']
        );
        expect(group.title).toBe('Cronica');
        expect(group.copies[0].streamId).toBe(2);
    });
});

describe('copyLabels', () => {
    const copy = (quality: CountryChannel['quality']): CountryChannel => ({
        streamId: 1,
        categoryId: '1',
        title: 'La 1',
        icon: null,
        quality,
    });

    it('names copies by quality, numbered where they share one', () => {
        expect(copyLabels([copy('UHD'), copy('HD'), copy('HD')])).toEqual([
            'UHD',
            'HD',
            'HD 2',
        ]);
    });

    it('numbers copies without a badge by their place', () => {
        expect(copyLabels([copy('HD'), copy(null)])).toEqual(['HD', '2']);
        expect(copyLabels([copy(null), copy(null)])).toEqual(['1', '2']);
    });
});

describe('mergeChannelGroups', () => {
    it('adds the other listing’s copies, the best first, once each', () => {
        const [main] = groupCountryChannels(
            [
                {
                    streamId: 1,
                    categoryId: '1',
                    name: '|ES| La 1 ᴴᴰ',
                    icon: 'a.png',
                },
            ],
            ['ES']
        );
        const [uhd] = groupCountryChannels(
            [
                {
                    streamId: 2,
                    categoryId: '2',
                    name: '|ES| LA 1 4K',
                    icon: null,
                },
                {
                    streamId: 1,
                    categoryId: '1',
                    name: '|ES| La 1 ᴴᴰ',
                    icon: 'a.png',
                },
            ],
            ['ES']
        );
        const merged = mergeChannelGroups(main, uhd);
        expect(merged.title).toBe('La 1');
        expect(merged.copies.map((copy) => copy.streamId)).toEqual([2, 1]);
        expect(merged.copies.map((copy) => copy.title)).toEqual([
            'La 1',
            'La 1',
        ]);
        expect(merged.icons).toEqual(['a.png']);
    });
});
