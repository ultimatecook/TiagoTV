import {
    readRecentSearches,
    RECENT_SEARCHES_KEY,
    RECENT_SEARCHES_MAX,
    withRecentSearch,
    writeRecentSearches,
} from './search-recents';

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: jest.fn((key: string) => values.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => {
            values.set(key, value);
        }),
        removeItem: jest.fn((key: string) => {
            values.delete(key);
        }),
    };
}

describe('recent searches', () => {
    it('puts the newest term first, once, whatever its case', () => {
        expect(
            withRecentSearch(['West Ham', 'DAZN LaLiga'], '  dazn   laliga ')
        ).toEqual(['dazn laliga', 'West Ham']);
        expect(withRecentSearch(['West Ham'], '   ')).toEqual(['West Ham']);
    });

    it(`keeps at most ${RECENT_SEARCHES_MAX}`, () => {
        let recent: string[] = [];
        for (let index = 0; index < RECENT_SEARCHES_MAX + 3; index++) {
            recent = withRecentSearch(recent, `term ${index}`);
        }
        expect(recent).toHaveLength(RECENT_SEARCHES_MAX);
        expect(recent[0]).toBe(`term ${RECENT_SEARCHES_MAX + 2}`);
    });

    it('round-trips through storage and clears it when empty', () => {
        const storage = memoryStorage();
        writeRecentSearches(storage, ['Newell’s', 'The Bear']);
        expect(readRecentSearches(storage)).toEqual(['Newell’s', 'The Bear']);

        writeRecentSearches(storage, []);
        expect(storage.removeItem).toHaveBeenCalledWith(RECENT_SEARCHES_KEY);
        expect(readRecentSearches(storage)).toEqual([]);
    });

    it('reads nothing from a broken or missing storage', () => {
        expect(readRecentSearches(null)).toEqual([]);
        expect(
            readRecentSearches(
                memoryStorage({ [RECENT_SEARCHES_KEY]: '{not json' })
            )
        ).toEqual([]);
        expect(
            readRecentSearches(
                memoryStorage({ [RECENT_SEARCHES_KEY]: '["ok", 3, ""]' })
            )
        ).toEqual(['ok']);
        const throwing = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
            removeItem: () => undefined,
        };
        expect(readRecentSearches(throwing)).toEqual([]);
        expect(() => writeRecentSearches(throwing, ['x'])).not.toThrow();
    });
});
