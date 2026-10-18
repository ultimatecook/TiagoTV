import {
    buildCountriesCatalog,
    categoryLabel,
    defaultCategory,
    findCountry,
    type CountriesCatalogStream,
    type Country,
} from './countries-catalog';
import { findCountryDefinition, type CountryDefinition } from './countries';

const NOW = new Date('2026-10-18T18:00:00Z');

const CATEGORIES = [
    { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
    { category_id: 2, category_name: '|ES| ✪ DAZN LA LIGA' },
    { category_id: 3, category_name: '|LAT| ✪ MEXICO' },
    { category_id: 4, category_name: '|LAT|  ✪ ARGENTINA' },
    { category_id: 5, category_name: '|LAT|  ✪ GENERAL' },
    { category_id: 6, category_name: '|LAT| ✪ BRAZIL' },
    { category_id: 7, category_name: '|AR| ✪ MBC' },
    { category_id: 8, category_name: '|CA| ✪ QUEBEC' },
    { category_id: 9, category_name: '|UK| ✪ NEWS' },
    { category_id: 10, category_name: '|US| ✪ SPORTS' },
];

function stream(
    stream_id: number,
    category_id: number,
    name: string,
    extra: Partial<CountriesCatalogStream> = {}
): CountriesCatalogStream {
    return { stream_id, category_id, name, stream_icon: '', ...extra };
}

const STREAMS = [
    stream(1, 1, '|ES| La 1 ᵁᴴᴰ'),
    stream(2, 1, '|ES| La 1 ᴴᴰ'),
    stream(3, 1, '|ES| Antena 3 ᵁᴴᴰ'),
    stream(4, 2, '|ES| DAZN LALIGA ᴴᴰ'),
    stream(5, 2, 'ES | No Event'),
    stream(6, 3, '|MX| CANAL 5 ᵁᴴᴰ'),
    stream(7, 4, '|ARG| TELEFE'),
    stream(8, 4, '|ARG| TELEFE ᴴᴰ'),
    stream(9, 4, '|ARG| C5N'),
    stream(10, 5, '|LAM| AXN'),
    stream(11, 6, '|BR| GLOBO'),
    stream(12, 7, '|AR| MBC 1'),
    stream(13, 8, '|CA| TVA'),
    stream(14, 9, '|UK| SKY NEWS', { is_adult: 1 }),
    stream(15, 10, '|US| ESPN', { stream_icon: 'espn.png' }),
];

describe('buildCountriesCatalog', () => {
    const regions = buildCountriesCatalog(CATEGORIES, STREAMS, NOW);
    const ids = regions.map((region) => ({
        region: region.definition.id,
        countries: region.countries.map((country) => country.definition.id),
    }));

    it('files the Spanish and English groups by country and region', () => {
        expect(ids).toEqual([
            { region: 'europe', countries: ['es'] },
            { region: 'north-america', countries: ['us'] },
            { region: 'latam', countries: ['ar', 'mx', 'latam'] },
        ]);
    });

    it('counts a channel’s copies once and drops idle event slots', () => {
        const spain = findCountry(regions, 'es') as Country;
        expect(spain.channelCount).toBe(3);
        expect(
            spain.categories.map((category) => [
                category.label,
                category.channels.map((channel) => channel.title),
            ])
        ).toEqual([
            [null, ['La 1', 'Antena 3']],
            ['DAZN La Liga', ['DAZN LALIGA']],
        ]);
        expect(findCountry(regions, 'ar')?.channelCount).toBe(2);
    });

    it('keeps the logo and the category a copy plays from', () => {
        const [channel] =
            findCountry(regions, 'us')?.categories[0].channels ?? [];
        expect(channel.copies[0]).toEqual({
            streamId: 15,
            categoryId: '10',
            title: 'ESPN',
            icon: 'espn.png',
            quality: null,
        });
    });

    it('puts the group a country opens on first', () => {
        const uk = findCountry(
            buildCountriesCatalog(
                [
                    { category_id: 1, category_name: '|UK| ✪ UK ᵁᴴᴰ/ᴴᴰ' },
                    { category_id: 2, category_name: '|UK| ✪ NEWS' },
                    { category_id: 3, category_name: '|UK| ✪ ENTERTAINMENT' },
                ],
                [
                    stream(1, 1, '|UK| CRIME INVESTIGATION'),
                    stream(2, 2, '|UK| SKY NEWS'),
                    stream(3, 3, '|UK| ITV 1'),
                ],
                NOW
            ),
            'gb'
        ) as Country;
        expect(uk.categories.map((category) => category.label)).toEqual([
            'Entertainment',
            null,
            'News',
        ]);
    });

    it('lists nothing for a catalog without Spanish or English groups', () => {
        expect(
            buildCountriesCatalog(
                [{ category_id: 1, category_name: '|IT| ✪ SPORT' }],
                [stream(1, 1, '|IT| RAI 1')],
                NOW
            )
        ).toEqual([]);
        expect(findCountry([], 'es')).toBeNull();
    });
});

describe('categoryLabel', () => {
    const country = (id: string) =>
        findCountryDefinition(id) as CountryDefinition;

    it.each([
        ['|ES| ✪ DAZN LA LIGA', 'es', 'DAZN La Liga'],
        ['|ES| ✪ SPAINS 4K', 'es', '4K'],
        ['|ES| ✪ VIX|TUDN', 'es', 'ViX / TUDN'],
        ['|ES| ✪ M LCAMPEON', 'es', 'M+ Liga de Campeones'],
        ['|ES| ✪ NIÑOS', 'es', 'Niños'],
        ['|ES| ✪ BEIN SPORT', 'es', 'beIN Sport'],
        ['|US| ✪ BOX OFFICE 24/7', 'us', 'Box Office 24/7'],
        ['|US| ✪ LOCAL - FOX', 'us', 'Local - FOX'],
        ['|CA| ✪ ENGLISH CH', 'ca', 'English Channels'],
        ['|CA| ✪ CANADA SD', 'ca', 'SD'],
        ['|UK| ✪ OXING EVENT', 'gb', 'Boxing Event'],
        ['|UK| ✪ IRELAND SPORT EVENT', 'ie', 'Sport Event'],
        ['|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT', 'ar', 'Liga Profesional'],
        ['|LAT|  ✪ CARRIBEAN', 'latam', 'Caribbean'],
    ])('reads "%s" as "%s"', (name, id, label) => {
        expect(categoryLabel(name, country(id))).toBe(label);
    });

    it.each([
        ['|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ', 'es'],
        ['|UK| ✪ UK ᵁᴴᴰ/ᴴᴰ', 'gb'],
        ['|LAT|  ✪ CHILE', 'cl'],
        ['|LAT|  ✪ GENERAL', 'latam'],
    ])('reads "%s" as the general group', (name, id) => {
        expect(categoryLabel(name, country(id))).toBeNull();
    });
});

describe('defaultCategory', () => {
    const category = (id: string, label: string | null, size: number) => ({
        id,
        label,
        channels: Array.from({ length: size }, (_, index) => ({
            key: `${id}-${index}`,
            title: `${id} ${index}`,
            subtitle: null,
            icons: [],
            copies: [],
        })),
    });
    it('opens on the general group', () => {
        expect(
            defaultCategory([
                category('1', null, 80),
                category('2', 'News', 90),
            ])?.id
        ).toBe('1');
    });

    it('skips a leftover general group for the main channels', () => {
        expect(
            defaultCategory([
                category('1', null, 1),
                category('2', 'Premier League PPV', 5),
                category('3', 'Entertainment', 95),
            ])?.id
        ).toBe('3');
    });

    it('falls back to the largest group', () => {
        expect(
            defaultCategory([
                category('1', 'WWE', 3),
                category('2', 'News', 94),
            ])?.id
        ).toBe('2');
        expect(defaultCategory([])).toBeNull();
    });
});
