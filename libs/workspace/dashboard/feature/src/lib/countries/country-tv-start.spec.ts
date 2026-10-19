import { buildCountriesTv } from './countries-catalog';
import {
    findSelection,
    LAST_CHANNEL_STORAGE_KEY,
    openingSelection,
    readLastChannel,
    rememberLastChannel,
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

describe('openingSelection', () => {
    it('opens on Argentina’s first channel the first time', () => {
        const selection = openingSelection(COUNTRIES, null);
        expect(selection?.country.definition.id).toBe('ar');
        // Telefe leads Argentina's main row.
        expect(streamOf(selection)).toBe(21);
    });

    it('opens on the last channel watched on the page, the very copy', () => {
        expect(streamOf(openingSelection(COUNTRIES, 11))).toBe(11);
        expect(openingSelection(COUNTRIES, 11)?.channel.title).toBe('La 1');
        expect(streamOf(openingSelection(COUNTRIES, 30))).toBe(30);
    });

    it('falls back to Argentina when the last channel is gone', () => {
        expect(streamOf(openingSelection(COUNTRIES, 999))).toBe(21);
    });

    it('opens a country’s route on that country', () => {
        expect(streamOf(openingSelection(COUNTRIES, 20, 'es'))).toBe(10);
        expect(streamOf(openingSelection(COUNTRIES, 12, 'es'))).toBe(12);
        expect(streamOf(openingSelection(COUNTRIES, null, 'us'))).toBe(30);
    });

    it('opens on the first country when Argentina has no channels', () => {
        const others = COUNTRIES.filter(
            (country) => country.definition.id !== 'ar'
        );
        expect(openingSelection(others, null)?.country.definition.id).toBe(
            'es'
        );
        expect(openingSelection([], null)).toBeNull();
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

describe('the last channel watched', () => {
    beforeEach(() => localStorage.clear());

    it('is kept in this browser’s storage', () => {
        expect(readLastChannel(localStorage)).toBeNull();
        rememberLastChannel(localStorage, 21);
        expect(localStorage.getItem(LAST_CHANNEL_STORAGE_KEY)).toBe('21');
        expect(readLastChannel(localStorage)).toBe(21);
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
        expect(() => rememberLastChannel(broken, 1)).not.toThrow();
        expect(readLastChannel(null)).toBeNull();
    });
});
