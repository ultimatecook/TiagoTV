import { VjsExternalSubtitles } from './vjs-external-subtitles';

describe('VjsExternalSubtitles', () => {
    const file = {
        name: 'Español · OpenSubtitles',
        format: 'vtt' as const,
        content: 'WEBVTT\n',
        language: 'es',
    };
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    beforeEach(() => {
        URL.createObjectURL = jest.fn(() => 'blob:subtitle-1');
        URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    });

    it('adds a remote WebVTT track Video.js cleans up, and releases its address', () => {
        const track = { kind: 'subtitles', mode: 'disabled' as TextTrackMode };
        const addRemoteTextTrack = jest.fn(() => ({ track }));
        const subtitles = new VjsExternalSubtitles({ addRemoteTextTrack });

        expect(subtitles.add(file)).toBe(track);
        expect(addRemoteTextTrack).toHaveBeenCalledWith(
            {
                kind: 'subtitles',
                src: 'blob:subtitle-1',
                srclang: 'es',
                label: 'Español · OpenSubtitles',
            },
            false
        );

        subtitles.clear();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:subtitle-1');
    });

    it('refuses SRT text and players without remote tracks', () => {
        expect(
            new VjsExternalSubtitles({ addRemoteTextTrack: jest.fn() }).add({
                ...file,
                format: 'srt',
            })
        ).toBeNull();
        expect(new VjsExternalSubtitles({}).add(file)).toBeNull();
    });
});
