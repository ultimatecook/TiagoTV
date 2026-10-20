import { resolveEmbeddedMpvSessionOptionArguments } from './embedded-mpv-extra-options.util';
import {
    EMBEDDED_MPV_STABLE_OPTIONS,
    normalizePlaybackSmoothness,
    prefersHdCopies,
    resolveEmbeddedMpvSessionExtraOptions,
} from './playback-smoothness.util';

describe('playback smoothness', () => {
    it('defaults to "Más estable" unless "normal" was chosen', () => {
        expect(normalizePlaybackSmoothness(undefined)).toBe('stable');
        expect(normalizePlaybackSmoothness(null)).toBe('stable');
        expect(normalizePlaybackSmoothness('fast')).toBe('stable');
        expect(normalizePlaybackSmoothness('stable')).toBe('stable');
        expect(normalizePlaybackSmoothness('normal')).toBe('normal');
    });

    it('prefers HD copies only in "Más estable"', () => {
        expect(prefersHdCopies(undefined)).toBe(true);
        expect(prefersHdCopies('stable')).toBe(true);
        expect(prefersHdCopies('normal')).toBe(false);
    });

    describe('embedded MPV session options', () => {
        it('adds nothing in "normal": the user lines pass through', () => {
            expect(resolveEmbeddedMpvSessionExtraOptions('', 'normal')).toBe(
                ''
            );
            expect(
                resolveEmbeddedMpvSessionExtraOptions(
                    ' --hwdec = no \n\ncache-secs=5',
                    'normal'
                )
            ).toBe('hwdec=no\ncache-secs=5');
        });

        it('adds the stability options in "Más estable"', () => {
            expect(resolveEmbeddedMpvSessionExtraOptions('', 'stable')).toBe(
                EMBEDDED_MPV_STABLE_OPTIONS.join('\n')
            );
            expect(
                resolveEmbeddedMpvSessionExtraOptions(undefined, 'stable')
            ).toContain('cache-pause-wait=3');
        });

        it('lets a user line win over the stability option with its key', () => {
            const text = resolveEmbeddedMpvSessionExtraOptions(
                '--hwdec=no\ncache-pause-wait = 1\nvolume-max=150',
                'stable'
            );

            expect(text.split('\n')).toEqual([
                'hwdec=no',
                'cache-pause-wait=1',
                'volume-max=150',
                'cache=yes',
                'demuxer-readahead-secs=20',
                'demuxer-max-bytes=150MiB',
                'demuxer-max-back-bytes=50MiB',
                'cache-pause-initial=yes',
            ]);
            // What main hands the engine: one value per key, the user's.
            const args = resolveEmbeddedMpvSessionOptionArguments(text);
            expect(args.filter((arg) => arg.startsWith('hwdec='))).toEqual([
                'hwdec=no',
            ]);
            expect(
                args.filter((arg) => arg.startsWith('cache-pause-wait='))
            ).toEqual(['cache-pause-wait=1']);
        });

        it('leaves hwdec to the Linux engine, which decodes in software', () => {
            const text = resolveEmbeddedMpvSessionExtraOptions(
                '',
                'stable',
                'linux'
            );

            expect(text).not.toContain('hwdec');
            expect(text).toContain('cache-pause-wait=3');
            expect(
                resolveEmbeddedMpvSessionExtraOptions('', 'stable', 'darwin')
            ).toContain('hwdec=auto-safe');
        });

        it('never limits the read-ahead with cache-secs', () => {
            expect(
                EMBEDDED_MPV_STABLE_OPTIONS.some((line) =>
                    line.startsWith('cache-secs=')
                )
            ).toBe(false);
        });
    });
});
