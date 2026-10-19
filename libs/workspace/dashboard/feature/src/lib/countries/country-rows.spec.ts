import { findCountryDefinition, type CountryDefinition } from './countries';
import type { CountryChannelGroup } from './country-channels';
import {
    buildCountryRows,
    rowLabel,
    type FiledCategory,
    type TvRow,
} from './country-rows';

const AR = findCountryDefinition('ar') as CountryDefinition;
const GB = findCountryDefinition('gb') as CountryDefinition;
let nextStream = 1;

function channel(title: string, quality: 'HD' | null = null) {
    const key = `${title.toLowerCase()}|`;
    return {
        key,
        title,
        subtitle: null,
        icons: [],
        copies: [
            {
                streamId: nextStream++,
                categoryId: '1',
                title,
                icon: null,
                quality,
            },
        ],
    } satisfies CountryChannelGroup;
}

function category(
    id: string,
    label: string | null,
    titles: readonly string[],
    irish = false
): FiledCategory {
    return {
        id,
        label,
        irish,
        channels: titles.map((title) => channel(title)),
    };
}

function summary(rows: readonly TvRow[]) {
    return rows.map((row) => [
        row.label.key?.split('.').pop() ?? row.label.text,
        row.channels.map((entry) => entry.title),
    ]);
}

describe('buildCountryRows', () => {
    it('splits a main group into its kinds, the flagships first', () => {
        const rows = buildCountryRows(AR, [
            category('493', null, [
                'FX',
                'Garage',
                'ESPN',
                'C5N',
                'Telefe',
                'TN',
                'TyC Sports',
                'Canal 26',
                'ESPN 2',
                'America TV',
                'HBO',
                'AMC',
                'Cartoon Network',
            ]),
            category('1232', 'Liga Profesional', [
                'Liga 1',
                'Liga 2',
                'Liga 3',
                'Liga 4',
            ]),
        ]);

        expect(summary(rows)).toEqual([
            // One cartoon channel and no kids' row: it stays.
            ['MAIN', ['Telefe', 'America TV', 'Garage', 'Cartoon Network']],
            ['SPORTS', ['ESPN', 'TyC Sports', 'ESPN 2']],
            ['Liga Profesional', ['Liga 1', 'Liga 2', 'Liga 3', 'Liga 4']],
            ['NEWS', ['C5N', 'TN', 'Canal 26']],
            ['MOVIES', ['FX', 'HBO', 'AMC']],
        ]);
        expect(rows.map((row) => row.id)).toEqual([
            'ar:main',
            'ar:sports',
            'ar:1232',
            'ar:news',
            'ar:movies',
        ]);
    });

    it('orders kinds: sports, events, news, movies, kids… copies last', () => {
        const rows = buildCountryRows(GB, [
            category('1', 'Timeshift or +1', [
                'ITV+1',
                'E4+1',
                'More4+1',
                'Dave+1',
            ]),
            category('2', 'Kids', ['Nick', 'Sky Kids', 'Baby TV', 'CBBC']),
            category('3', 'News', ['Sky News', 'CNN', 'BBC News', 'GB News']),
            category('4', 'DAZN Event', ['A - B', 'C - D', 'E - F', 'G - H']),
            category('5', 'Sports', ['Premier Sports 1', 'TNT Sports 1']),
            category('6', 'Entertainment', ['ITV 1', 'BBC One', 'Dave']),
        ]);

        expect(rows.map((row) => row.tier)).toEqual([
            'main',
            'sports',
            'events',
            'news',
            'kids',
            'copies',
        ]);
        expect(rows[0].channels.map((entry) => entry.title)).toEqual([
            'BBC One',
            'ITV 1',
            'Dave',
        ]);
    });

    it('pools small categories into their kind’s own row', () => {
        const rows = buildCountryRows(GB, [
            category('10', 'Sports', ['Sky Sports Main Event', 'TNT Sports 1']),
            category('11', 'Cricket Live', ['Cricket 1', 'Cricket 2']),
            category('12', 'Hub Sports', ['Hub 1', 'Hub 2', 'Hub 3', 'Hub 4']),
            category('13', 'Super League + Event', ['Super League 1']),
            category('14', 'Live Event', ['Event A', 'Event B']),
        ]);

        expect(summary(rows)).toEqual([
            [
                'SPORTS',
                [
                    'Sky Sports Main Event',
                    'TNT Sports 1',
                    'Cricket 1',
                    'Cricket 2',
                ],
            ],
            ['Hub Sports', ['Hub 1', 'Hub 2', 'Hub 3', 'Hub 4']],
            ['EVENTS', ['Super League 1', 'Event A', 'Event B']],
        ]);
    });

    it('gives Ireland a row of its own among the main channels', () => {
        const rows = buildCountryRows(GB, [
            category('442', 'Entertainment', ['ITV 1', 'Channel 4']),
            category('1089', 'Ireland', ['RTE One', 'RTE Two', 'TG4'], true),
        ]);

        expect(summary(rows)).toEqual([
            ['MAIN', ['ITV 1', 'Channel 4']],
            ['IRELAND', ['RTE One', 'RTE Two', 'TG4']],
        ]);
        expect(rows[1].id).toBe('gb:1089');
    });

    it('shows a channel once, in its first row, with every copy', () => {
        const [main, uhd] = [
            category('1', null, ['La 1', 'Antena 3', 'Cuatro', 'La Sexta']),
            category('2', '4K', ['La 1', 'Antena 3', 'Telemadrid', 'Cuatro']),
        ];
        const rows = buildCountryRows(
            findCountryDefinition('es') as CountryDefinition,
            [main, uhd]
        );

        expect(summary(rows)).toEqual([
            ['MAIN', ['La 1', 'Antena 3', 'Cuatro', 'La Sexta']],
            ['4K', ['Telemadrid']],
        ]);
        expect(rows[0].channels[0].copies.map((copy) => copy.streamId)).toEqual(
            [
                main.channels[0].copies[0].streamId,
                uhd.channels[0].copies[0].streamId,
            ]
        );
    });
});

describe('rowLabel', () => {
    it('names local stations by their network', () => {
        expect(rowLabel('Local - NBC')).toEqual({
            key: 'WORKSPACE.COUNTRIES.ROWS.LOCAL',
            text: '',
            params: { network: 'NBC' },
        });
        expect(rowLabel('Local - Misc').key).toBe(
            'WORKSPACE.COUNTRIES.ROWS.LOCAL_OTHER'
        );
        expect(rowLabel('Timeshift or +1').key).toBe(
            'WORKSPACE.COUNTRIES.ROWS.TIMESHIFT'
        );
        expect(rowLabel('DAZN La Liga')).toEqual({
            key: null,
            text: 'DAZN La Liga',
        });
    });
});
