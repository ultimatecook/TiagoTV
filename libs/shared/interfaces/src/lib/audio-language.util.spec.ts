import {
    DEFAULT_AUDIO_LANGUAGE,
    embeddedMpvAudioLanguageOptions,
    isEnglishLanguage,
    isSpanishLanguage,
    normalizeAudioLanguage,
} from './audio-language.util';
import { resolveEmbeddedMpvSessionOptionArguments } from './embedded-mpv-extra-options.util';
import { resolveEmbeddedMpvSessionExtraOptions } from './playback-smoothness.util';

describe('audio language', () => {
    it('defaults to original, also for settings saved before the choice', () => {
        expect(DEFAULT_AUDIO_LANGUAGE).toBe('original');
        expect(normalizeAudioLanguage(undefined)).toBe('original');
        expect(normalizeAudioLanguage(null)).toBe('original');
        expect(normalizeAudioLanguage('EN')).toBe('original');
        expect(normalizeAudioLanguage('original')).toBe('original');
        expect(normalizeAudioLanguage('es')).toBe('es');
    });

    it.each([
        'es',
        'spa',
        'es-419',
        'es_ES',
        'Español',
        'Spanish (Latin America)',
        'Castellano',
        'Latino',
        'ESP',
    ])('reads %p as Spanish', (value) => {
        expect(isSpanishLanguage(value)).toBe(true);
        expect(isEnglishLanguage(value)).toBe(false);
    });

    it.each(['en', 'eng', 'en-US', 'English', 'Inglés'])(
        'reads %p as English',
        (value) => {
            expect(isEnglishLanguage(value)).toBe(true);
            expect(isSpanishLanguage(value)).toBe(false);
        }
    );

    it.each(['', null, undefined, 'jpn', 'Japanese', 'Audio 2', 'estonian'])(
        'reads %p as neither',
        (value) => {
            expect(isSpanishLanguage(value)).toBe(false);
            expect(isEnglishLanguage(value)).toBe(false);
        }
    );

    describe('embedded MPV options', () => {
        const value = (lines: readonly string[], key: string) =>
            lines
                .find((line) => line.startsWith(`${key}=`))
                ?.slice(key.length + 1);

        it('original: English audio first, never Spanish, Spanish subtitles', () => {
            const lines = embeddedMpvAudioLanguageOptions('original');
            const alang = value(lines, 'alang')?.split(',') ?? [];

            expect(alang.slice(0, 2)).toEqual(['en', 'eng']);
            expect(alang).toEqual(expect.arrayContaining(['ja', 'ko', 'fr']));
            expect(alang.some((code) => isSpanishLanguage(code))).toBe(false);
            expect(alang).not.toContain('ca');
            expect(value(lines, 'slang')?.split(',')).toEqual(
                expect.arrayContaining(['es', 'spa', 'es-419'])
            );
            expect(value(lines, 'sid')).toBe('auto');
            expect(value(lines, 'subs-with-matching-audio')).toBe('forced');
        });

        it('español: the Spanish dub, subtitles only when forced', () => {
            const lines = embeddedMpvAudioLanguageOptions('es');

            expect(value(lines, 'alang')?.split(',').slice(0, 3)).toEqual([
                'es',
                'spa',
                'es-419',
            ]);
            expect(value(lines, 'subs-with-matching-audio')).toBe('forced');
        });

        it('merges after the stability options, and the user lines win', () => {
            const text = resolveEmbeddedMpvSessionExtraOptions(
                'alang=jpn\nhwdec=no',
                'stable',
                'darwin',
                'original'
            );
            const args = resolveEmbeddedMpvSessionOptionArguments(text);

            expect(args.filter((arg) => arg.startsWith('alang='))).toEqual([
                'alang=jpn',
            ]);
            expect(args.filter((arg) => arg.startsWith('hwdec='))).toEqual([
                'hwdec=no',
            ]);
            expect(text).toContain('slang=es,spa');
            expect(text).toContain('cache-pause-wait=3');
            expect(text.indexOf('cache=yes')).toBeLessThan(
                text.indexOf('slang=')
            );
        });

        it('adds the track choice in "normal" too', () => {
            expect(
                resolveEmbeddedMpvSessionExtraOptions(
                    '',
                    'normal',
                    'darwin',
                    'es'
                )
                    .split('\n')
                    .map((line) => line.split('=')[0])
            ).toEqual(['alang', 'slang', 'sid', 'subs-with-matching-audio']);
        });

        it('adds nothing for callers that do not pass the setting', () => {
            expect(resolveEmbeddedMpvSessionExtraOptions('', 'normal')).toBe(
                ''
            );
        });
    });
});
