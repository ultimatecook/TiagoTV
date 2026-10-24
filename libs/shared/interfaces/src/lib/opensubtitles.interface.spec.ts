import {
    DEFAULT_OPEN_SUBTITLES_SETTINGS,
    hasOpenSubtitlesKey,
    maskOpenSubtitlesUser,
    normalizeOpenSubtitlesSettings,
} from './opensubtitles.interface';

describe('OpenSubtitles settings', () => {
    it('defaults to an empty account, Spanish, searched automatically', () => {
        expect(normalizeOpenSubtitlesSettings(undefined)).toEqual(
            DEFAULT_OPEN_SUBTITLES_SETTINGS
        );
        expect(DEFAULT_OPEN_SUBTITLES_SETTINGS).toEqual({
            apiKey: '',
            username: '',
            password: '',
            language: 'es',
            secondLanguage: '',
            autoSearch: true,
        });
    });

    it('trims the key and name, keeps the password as typed', () => {
        expect(
            normalizeOpenSubtitlesSettings({
                apiKey: '  key  ',
                username: ' tiago ',
                password: ' pass word ',
            })
        ).toEqual(
            expect.objectContaining({
                apiKey: 'key',
                username: 'tiago',
                password: ' pass word ',
            })
        );
    });

    it('keeps known languages only, and a second one that differs', () => {
        expect(
            normalizeOpenSubtitlesSettings({
                language: 'klingon',
                secondLanguage: 'en',
            })
        ).toEqual(
            expect.objectContaining({ language: 'es', secondLanguage: 'en' })
        );
        expect(
            normalizeOpenSubtitlesSettings({
                language: 'en',
                secondLanguage: 'en',
            }).secondLanguage
        ).toBe('');
        expect(
            normalizeOpenSubtitlesSettings({
                language: 'pt-BR',
                secondLanguage: 'ea',
            })
        ).toEqual(
            expect.objectContaining({ language: 'pt-BR', secondLanguage: 'ea' })
        );
    });

    it('searches automatically unless switched off', () => {
        expect(
            normalizeOpenSubtitlesSettings({ autoSearch: false }).autoSearch
        ).toBe(false);
        expect(
            normalizeOpenSubtitlesSettings({ autoSearch: null }).autoSearch
        ).toBe(true);
    });

    it('needs a key, and masks the account name', () => {
        expect(hasOpenSubtitlesKey({ apiKey: ' ' })).toBe(false);
        expect(hasOpenSubtitlesKey({ apiKey: 'k' })).toBe(true);
        expect(maskOpenSubtitlesUser('tiago')).toBe('t•••o');
        expect(maskOpenSubtitlesUser('ab')).toBe('•••');
        expect(maskOpenSubtitlesUser('')).toBe('');
    });
});
