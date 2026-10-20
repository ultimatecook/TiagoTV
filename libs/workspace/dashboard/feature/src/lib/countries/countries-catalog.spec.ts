import { findCountryDefinition, type CountryDefinition } from './countries';
import {
    buildCountriesTv,
    categoryLabel,
    type CountriesCatalogStream,
    type TvCountry,
} from './countries-catalog';
import {
    SNAPSHOT_CATEGORIES,
    SNAPSHOT_STREAMS,
} from './countries-snapshot.spec-data';

const NOW = new Date('2026-10-18T18:00:00Z');

function stream(
    stream_id: number,
    category_id: number,
    name: string,
    extra: Partial<CountriesCatalogStream> = {}
): CountriesCatalogStream {
    return { stream_id, category_id, name, stream_icon: '', ...extra };
}

function rowsOf(country: TvCountry | undefined) {
    return (country?.rows ?? []).map((row) => [
        row.label.key?.split('.').pop() ?? row.label.text,
        row.channels.map((channel) => channel.title),
    ]);
}

describe('buildCountriesTv', () => {
    const countries = buildCountriesTv(
        [
            { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
            { category_id: 2, category_name: '|ES| ✪ LALIGA+ PPV' },
            { category_id: 3, category_name: '|LAT| ✪ MEXICO' },
            { category_id: 4, category_name: '|LAT|  ✪ ARGENTINA' },
            { category_id: 6, category_name: '|LAT| ✪ BRAZIL' },
            { category_id: 7, category_name: '|AR| ✪ MBC' },
            { category_id: 9, category_name: '|UK| ✪ NEWS' },
            { category_id: 10, category_name: '|US| ✪ SPORTS' },
            { category_id: 11, category_name: '|IT| ✪ SPORT' },
        ],
        [
            stream(1, 1, '|ES| La 1 ᵁᴴᴰ'),
            stream(2, 1, '|ES| La 1 ᴴᴰ'),
            stream(3, 1, '|ES| Antena 3 ᵁᴴᴰ'),
            stream(4, 2, '|ES| LALIGA+ PPV 1'),
            stream(5, 2, 'ES | No Event'),
            stream(6, 3, '|MX| CANAL 5 ᵁᴴᴰ'),
            stream(7, 4, '|ARG| TELEFE'),
            stream(8, 4, '|ARG| TELEFE ᴴᴰ'),
            stream(9, 4, '|ARG| C5N'),
            stream(11, 6, '|BR| GLOBO'),
            stream(12, 7, '|AR| MBC 1'),
            stream(14, 9, '|UK| SKY NEWS', { is_adult: 1 }),
            stream(15, 10, '|US| ESPN', { stream_icon: 'espn.png' }),
            stream(16, 11, '|IT| RAI SPORT'),
        ],
        NOW
    );

    it('lists the kept countries in the page’s order', () => {
        expect(countries.map((country) => country.definition.id)).toEqual([
            'ar',
            'es',
            'us',
        ]);
    });

    it('counts a channel’s copies once and drops empty slots', () => {
        const [argentina, spain] = countries;
        expect(rowsOf(spain)).toEqual([['MAIN', ['La 1', 'Antena 3']]]);
        expect(spain.channelCount).toBe(2);
        expect(rowsOf(argentina)).toEqual([['MAIN', ['Telefe', 'C5N']]]);
        expect(argentina.rows[0].channels[0].copies).toHaveLength(2);
    });

    it('keeps the logo and the category a copy plays from', () => {
        expect(countries[2].rows[0].channels[0].copies[0]).toEqual({
            streamId: 15,
            categoryId: '10',
            title: 'ESPN',
            icon: 'espn.png',
            quality: null,
        });
    });

    it('drops the event feeds whose match is over, by the panel’s clock', () => {
        const [spain] = buildCountriesTv(
            [
                { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
                { category_id: 2, category_name: '|ES| ✪ DAZN EVENT' },
            ],
            [
                stream(1, 1, '|ES| La 1 ᵁᴴᴰ'),
                stream(
                    2,
                    2,
                    'Next | 2026-10-18 | 13:00 (GMT) | Ngozi City vs. Bumamuru | Ligue A - Burundi | ES'
                ),
                stream(3, 2, 'Live | Ajax - PSV | Eredivisie femenina | ES', {
                    added: String(Date.parse('2026-10-18T10:19:00Z') / 1000),
                }),
                stream(
                    4,
                    2,
                    'Live | SC Cambuur - AZ Alkmaar | Eredivisie | ES',
                    { added: String(Date.parse('2026-10-18T17:20:00Z') / 1000) }
                ),
                stream(
                    5,
                    2,
                    'Next | 2026-10-18 | 19:00 (GMT) | Burgos CF - CE Sabadell | LALIGA HYPERMOTION | ES'
                ),
            ],
            NOW
        );
        expect(rowsOf(spain)).toEqual([
            ['MAIN', ['La 1']],
            ['EVENTS', ['SC Cambuur - AZ Alkmaar', 'Burgos CF - CE Sabadell']],
        ]);
    });

    it('lists nothing for a catalog without Spanish or English groups', () => {
        expect(
            buildCountriesTv(
                [{ category_id: 1, category_name: '|IT| ✪ SPORT' }],
                [stream(1, 1, '|IT| RAI 1')],
                NOW
            )
        ).toEqual([]);
    });
});

describe('buildCountriesTv on a real panel', () => {
    const countries = buildCountriesTv(
        SNAPSHOT_CATEGORIES.map(([category_id, category_name]) => ({
            category_id,
            category_name,
        })),
        SNAPSHOT_STREAMS.map(([stream_id, category_id, name, logo]) => ({
            stream_id,
            category_id,
            name,
            stream_icon: logo ? `logo-${stream_id}.png` : null,
        })),
        NOW
    );
    const byId = (id: string) =>
        countries.find((country) => country.definition.id === id);
    const rowIds = (id: string) => byId(id)?.rows.map((row) => row.id);

    it('starts with Argentina, then Spain, the UK and the US', () => {
        expect(countries.map((country) => country.definition.id)).toEqual([
            'ar',
            'es',
            'gb',
            'us',
        ]);
    });

    it('opens Argentina on its flagships, its kinds in rows', () => {
        const rows = rowsOf(byId('ar'));
        expect(rows.map(([label]) => label)).toEqual([
            'MAIN',
            'SPORTS',
            'Liga Profesional',
            'NEWS',
            'MOVIES',
            'KIDS',
            'DOCUMENTARY',
            'MUSIC',
        ]);
        expect(rows[0][1].slice(0, 4)).toEqual([
            'Telefe',
            'America TV',
            'TV Publica',
            'Net TV',
        ]);
        expect(rows[1][1]).toEqual(
            expect.arrayContaining(['ESPN', 'TyC Sports', 'FOX Sports 1'])
        );
        expect(rows[3][1]).toEqual(
            expect.arrayContaining(['C5N', 'TN', 'A24'])
        );
    });

    it('drops Spain’s nameless pay-per-view slots and its repeats', () => {
        const ids = rowIds('es') ?? [];
        // LaLiga+ PPV 1…30 name no match: the row is gone.
        expect(ids).not.toContain('es:1922');
        const spain = byId('es') as TvCountry;
        const titles = spain.rows.reduce<string[]>(
            (all, row) => all.concat(row.channels.map((entry) => entry.key)),
            []
        );
        expect(new Set(titles).size).toBe(titles.length);
        const la1 = spain.rows[0].channels.find(
            (entry) => entry.title === 'La 1'
        );
        // Its UHD and HD copies, and the 4K group's copies.
        expect(la1?.copies.length).toBeGreaterThanOrEqual(3);
    });

    it('folds Ireland into the United Kingdom', () => {
        const rows = byId('gb')?.rows ?? [];
        expect(rows.map((row) => row.id)).toContain('gb:1089');
        expect(rows.find((row) => row.id === 'gb:1089')?.label.key).toBe(
            'WORKSPACE.COUNTRIES.ROWS.IRELAND'
        );
    });

    it('names the US local stations by network', () => {
        const pbs = byId('us')?.rows.find((row) => row.id === 'us:778');
        expect(pbs?.label).toEqual({
            key: 'WORKSPACE.COUNTRIES.ROWS.LOCAL',
            text: '',
            params: { network: 'PBS' },
        });
    });

    it('leaves out the other languages and Latin America', () => {
        const names = countries.reduce<string[]>(
            (all, country) =>
                all.concat(
                    country.rows.reduce<string[]>(
                        (titles, row) =>
                            titles.concat(row.channels.map((c) => c.title)),
                        []
                    )
                ),
            []
        );
        expect(names.some((name) => /^\|?(MX|AR|IT)\b/.test(name))).toBe(false);
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
        ['|UK| ✪ OXING EVENT', 'gb', 'Boxing Event'],
        ['|UK| ✪ IRELAND', 'gb', 'Ireland'],
        ['|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT', 'ar', 'Liga Profesional'],
    ])('reads "%s" as "%s"', (name, id, label) => {
        expect(categoryLabel(name, country(id))).toBe(label);
    });

    it.each([
        ['|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ', 'es'],
        ['|UK| ✪ UK ᵁᴴᴰ/ᴴᴰ', 'gb'],
        ['|LAT|  ✪ ARGENTINA', 'ar'],
    ])('reads "%s" as the country’s own group', (name, id) => {
        expect(categoryLabel(name, country(id))).toBeNull();
    });
});
