import type { PlayerTrack } from '../player-controls/player-controls.model';
import {
    matchesSubtitleLanguage,
    preferredAudioTrack,
    preferredSubtitleTrack,
} from './track-preference';

const track = (
    id: number,
    label: string,
    extra: Partial<PlayerTrack> = {}
): PlayerTrack => ({ id, label, selected: false, ...extra });

describe('audio language track choice', () => {
    const dualAudio = [
        track(1, 'Español', { language: 'spa', selected: true }),
        track(2, 'English', { language: 'eng' }),
    ];

    it('original: English over the Spanish dub the file starts on', () => {
        expect(preferredAudioTrack(dualAudio, 'original')?.id).toBe(2);
    });

    it('original: the first non-Spanish track when there is no English one', () => {
        expect(
            preferredAudioTrack(
                [
                    track(1, 'Castellano'),
                    track(2, 'Audio 2', { language: 'jpn' }),
                ],
                'original'
            )?.id
        ).toBe(2);
    });

    it('español: the Spanish track; one track or all Spanish: no change', () => {
        expect(preferredAudioTrack(dualAudio, 'es')?.id).toBe(1);
        expect(preferredAudioTrack([dualAudio[0]], 'original')).toBeNull();
        expect(
            preferredAudioTrack(
                [track(1, 'es'), track(2, 'Spanish (Latin America)')],
                'original'
            )
        ).toBeNull();
    });

    it('original: Spanish subtitles, a full track before a forced one', () => {
        const subtitles = [
            track(10, 'Spanish (Forced)', { language: 'spa' }),
            track(11, 'English', { language: 'eng' }),
            track(12, 'Español', { language: 'spa' }),
        ];

        expect(
            preferredSubtitleTrack(subtitles, dualAudio[1], 'original')
        ).toBe(subtitles[2]);
        // Audio unknown (one untagged track): still Spanish subtitles.
        expect(preferredSubtitleTrack(subtitles, null, 'original')).toBe(
            subtitles[2]
        );
        expect(preferredSubtitleTrack([subtitles[0]], null, 'original')).toBe(
            subtitles[0]
        );
    });

    it('original: leaves the subtitles alone when the audio is Spanish anyway', () => {
        expect(
            preferredSubtitleTrack(
                [track(12, 'Español')],
                dualAudio[0],
                'original'
            )
        ).toBeNull();
    });

    it('español: turns a full subtitle off on Spanish audio, keeps forced ones', () => {
        const shownFull = [track(12, 'Español', { selected: true })];
        const shownForced = [
            track(10, 'Español (forzados)', { selected: true }),
        ];

        expect(preferredSubtitleTrack(shownFull, dualAudio[0], 'es')).toBe(
            'off'
        );
        expect(
            preferredSubtitleTrack(shownForced, dualAudio[0], 'es')
        ).toBeNull();
        expect(
            preferredSubtitleTrack(shownFull, dualAudio[1], 'es')
        ).toBeNull();
    });

    it('matches subtitle tracks to OpenSubtitles languages', () => {
        expect(matchesSubtitleLanguage(track(1, 'Español'), 'es')).toBe(true);
        expect(
            matchesSubtitleLanguage(track(1, 'x', { language: 'es-419' }), 'ea')
        ).toBe(true);
        expect(
            matchesSubtitleLanguage(track(1, 'Spanish (Forced)'), 'es')
        ).toBe(false);
        expect(matchesSubtitleLanguage(track(1, 'English'), 'en')).toBe(true);
        expect(
            matchesSubtitleLanguage(
                track(1, 'x', { language: 'pt-BR' }),
                'pt-BR'
            )
        ).toBe(true);
        expect(matchesSubtitleLanguage(track(1, 'English'), 'es')).toBe(false);
    });
});
