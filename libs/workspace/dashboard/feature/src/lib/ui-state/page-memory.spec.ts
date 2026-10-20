import {
    isNumber,
    pageMemoryState,
    recallPageChoice,
    rememberPageChoice,
} from './page-memory';

describe('page memory', () => {
    afterEach(() => history.replaceState(null, ''));

    it('keeps a choice on the current entry, with the router’s keys', () => {
        history.replaceState({ navigationId: 4, ɵrouterPageId: 2 }, '');
        const entries = history.length;

        rememberPageChoice('sports-day', 1);
        rememberPageChoice('scroll:row', 800);

        expect(history.length).toBe(entries);
        expect(history.state).toEqual({
            navigationId: 4,
            ɵrouterPageId: 2,
            tvPageMemory: { 'sports-day': 1, 'scroll:row': 800 },
        });
        expect(recallPageChoice('sports-day', isNumber)).toBe(1);
        expect(recallPageChoice('scroll:row', isNumber)).toBe(800);
    });

    it('recalls nothing on a new entry, or a value it does not accept', () => {
        expect(recallPageChoice('sports-day', isNumber)).toBeUndefined();

        rememberPageChoice('sports-day', 'tomorrow');
        expect(recallPageChoice('sports-day', isNumber)).toBeUndefined();

        history.replaceState({ navigationId: 9 }, '');
        expect(recallPageChoice('sports-day', isNumber)).toBeUndefined();
    });

    it('hands the memory to a navigation that replaces the entry', () => {
        expect(pageMemoryState()).toEqual({});

        rememberPageChoice('search-scope', 'series');

        expect(pageMemoryState()).toEqual({
            tvPageMemory: { 'search-scope': 'series' },
        });
    });

    it('keeps the page working when the browser refuses an update', () => {
        const replace = jest
            .spyOn(history, 'replaceState')
            .mockImplementation(() => {
                throw new Error('SecurityError');
            });

        expect(() => rememberPageChoice('sports-day', 1)).not.toThrow();
        replace.mockRestore();
    });
});
