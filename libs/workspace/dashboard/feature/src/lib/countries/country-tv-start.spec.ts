import { buildCountriesTv } from './countries-catalog';
import {
    COUNTRY_CHANNELS_STORAGE_KEY,
    COUNTRY_STORAGE_KEY,
    countrySelection,
    findSelection,
    LAST_CHANNEL_STORAGE_KEY,
    NO_MEMORY,
    openingSelection,
    readLastChannel,
    readMemory,
    rememberCountry,
    rememberSelection,
    type TvMemory,
    type TvSelection,
} from './country-tv-start';

const COUNTRIES = buildCountriesTv(
    [
        { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
        { category_id: 2, category_name: '|LAT|  ✪ ARGENTINA' },
        { category_id: 3, category_name: '|US| ✪ NEWS' },
    ],
    [
        { stream_id: 10, category_id: 1, name: '|ES| La 1 ᵁᴴᴰ' },
        { stream_id: 11, category_id: 1, name: '|ES| La 1 ᴴᴰ' },
        { stream_id: 12, category_id: 1, name: '|ES| Antena 3' },
        { stream_id: 20, category_id: 2, name: '|ARG| C5N' },
        { stream_id: 21, category_id: 2, name: '|ARG| TELEFE' },
        { stream_id: 30, category_id: 3, name: '|US| CNN' },
    ],
    new Date('2026-10-18T18:00:00Z')
);

const streamOf = (selection: ReturnType<typeof openingSelection>) =>
    selection?.copy.streamId ?? null;
const last = (lastChannel: number | null): TvMemory => ({
    ...NO_MEMORY,
    lastChannel,
});
const country = (id: string) =>
    COUNTRIES.find(
        (entry) => entry.definition.id === id
    ) as (typeof COUNTRIES)[number];

describe('openingSelection', () => {
    it('opens on Argentina’s first channel the first time', () => {
        const selection = openingSelection(COUNTRIES, NO_MEMORY);
        expect(selection?.country.definition.id).toBe('ar');
        // Telefe leads Argentina's main row.
        expect(streamOf(selection)).toBe(21);
    });

    it('opens on the last channel watched on the page, the very copy', () => {
        expect(streamOf(openingSelection(COUNTRIES, last(11)))).toBe(11);
        expect(openingSelection(COUNTRIES, last(11))?.channel.title).toBe(
            'La 1'
        );
        expect(streamOf(openingSelection(COUNTRIES, last(30)))).toBe(30);
    });

    it('falls back to Argentina when the last channel is gone', () => {
        expect(streamOf(openingSelection(COUNTRIES, last(999)))).toBe(21);
    });

    it('opens a country’s route on that country', () => {
        expect(streamOf(openingSelection(COUNTRIES, last(20), 'es'))).toBe(10);
        expect(streamOf(openingSelection(COUNTRIES, last(12), 'es'))).toBe(12);
        expect(streamOf(openingSelection(COUNTRIES, last(null), 'us'))).toBe(
            30
        );
    });

    it('opens on the country chosen last, on its own last channel', () => {
        const memory: TvMemory = {
            lastChannel: 21,
            country: 'es',
            channels: { es: 12, ar: 21 },
        };
        expect(streamOf(openingSelection(COUNTRIES, memory))).toBe(12);
        // A country's route still wins.
        expect(streamOf(openingSelection(COUNTRIES, memory, 'ar'))).toBe(21);
        // A chosen country without a channel of its own: its first.
        expect(
            streamOf(openingSelection(COUNTRIES, { ...memory, channels: {} }))
        ).toBe(10);
        // A country gone from the source: the last channel watched.
        expect(
            streamOf(openingSelection(COUNTRIES, { ...memory, country: 'gb' }))
        ).toBe(21);
    });

    it('opens on the first country when Argentina has no channels', () => {
        const others = COUNTRIES.filter(
            (country) => country.definition.id !== 'ar'
        );
        expect(openingSelection(others, NO_MEMORY)?.country.definition.id).toBe(
            'es'
        );
        expect(openingSelection([], NO_MEMORY)).toBeNull();
    });
});

describe('findSelection', () => {
    it('finds the channel and its row from any of its copies', () => {
        const selection = findSelection(COUNTRIES, 11);
        expect(selection?.row.id).toBe('es:main');
        expect(selection?.channel.copies.map((copy) => copy.streamId)).toEqual([
            10, 11,
        ]);
    });
});

describe('countrySelection', () => {
    it('is the country’s last channel, else its first', () => {
        expect(streamOf(countrySelection(country('es'), NO_MEMORY))).toBe(10);
        expect(
            streamOf(
                countrySelection(country('es'), {
                    ...NO_MEMORY,
                    channels: { es: 12 },
                })
            )
        ).toBe(12);
        // The page's last channel, when it was this country's.
        expect(streamOf(countrySelection(country('es'), last(11)))).toBe(11);
        expect(streamOf(countrySelection(country('es'), last(30)))).toBe(10);
    });
});

describe('the page’s memory', () => {
    beforeEach(() => localStorage.clear());

    it('keeps the last channel, its country and each country’s own', () => {
        expect(readMemory(localStorage)).toEqual(NO_MEMORY);
        rememberSelection(
            localStorage,
            findSelection(COUNTRIES, 12) as TvSelection
        );
        rememberSelection(
            localStorage,
            findSelection(COUNTRIES, 21) as TvSelection
        );
        expect(localStorage.getItem(LAST_CHANNEL_STORAGE_KEY)).toBe('21');
        expect(localStorage.getItem(COUNTRY_STORAGE_KEY)).toBe('ar');
        expect(readMemory(localStorage)).toEqual({
            lastChannel: 21,
            country: 'ar',
            channels: { es: 12, ar: 21 },
        });
        rememberCountry(localStorage, 'us');
        expect(readMemory(localStorage).country).toBe('us');
    });

    it('drops what is not a channel', () => {
        localStorage.setItem(
            COUNTRY_CHANNELS_STORAGE_KEY,
            JSON.stringify({ es: 'abc', ar: -1, us: 30 })
        );
        expect(readMemory(localStorage).channels).toEqual({ us: 30 });
        localStorage.setItem(COUNTRY_CHANNELS_STORAGE_KEY, '{oops');
        expect(readMemory(localStorage).channels).toEqual({});
    });

    it('reads nothing from garbage or a storage that throws', () => {
        localStorage.setItem(LAST_CHANNEL_STORAGE_KEY, 'abc');
        expect(readLastChannel(localStorage)).toBeNull();
        const broken = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
        } as unknown as Storage;
        expect(readLastChannel(broken)).toBeNull();
        expect(readMemory(broken)).toEqual(NO_MEMORY);
        expect(() =>
            rememberSelection(
                broken,
                findSelection(COUNTRIES, 12) as TvSelection
            )
        ).not.toThrow();
        expect(readLastChannel(null)).toBeNull();
    });
});
