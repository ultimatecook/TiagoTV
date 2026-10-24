import { existsSync, readFileSync, statSync } from 'fs';
import { dirname } from 'path';
import { EMBEDDED_MPV_ADD_SUBTITLE_TEXT } from '@iptvnator/shared/interfaces';

const mockHandle = jest.fn();
const mockAddSubtitle = jest.fn(() => ({ id: 'session-1' }));
jest.mock('electron', () => ({ ipcMain: { handle: mockHandle } }));
jest.mock('../services/embedded-mpv-native.service', () => ({
    embeddedMpvNativeService: { addSubtitle: mockAddSubtitle },
}));

import {
    addEmbeddedMpvSubtitleText,
    registerEmbeddedMpvSubtitleTextHandler,
    removeEmbeddedMpvSubtitleTexts,
    subtitleTextFileName,
} from './embedded-mpv-subtitle-text';

describe('Embedded MPV downloaded subtitles', () => {
    afterEach(() => {
        removeEmbeddedMpvSubtitleTexts();
        jest.clearAllMocks();
    });

    it('names the file after the label, safely', () => {
        expect(subtitleTextFileName('Español · OpenSubtitles.vtt', 1)).toBe(
            '1-Español OpenSubtitles.vtt'
        );
        expect(subtitleTextFileName('../../etc/passwd', 2)).toBe(
            '2-.. .. etc passwd.vtt'
        );
        expect(subtitleTextFileName('movie.srt', 3)).toBe('3-movie.srt');
        expect(subtitleTextFileName(undefined, 4)).toBe('4-subtitles.vtt');
    });

    it('writes a private temp file and adds it to the session', () => {
        addEmbeddedMpvSubtitleText('session-1', 'Español.vtt', 'WEBVTT\n');

        const [sessionId, path] = mockAddSubtitle.mock.calls[0] as unknown as [
            string,
            string,
        ];
        expect(sessionId).toBe('session-1');
        expect(readFileSync(path, 'utf-8')).toBe('WEBVTT\n');
        if (process.platform !== 'win32') {
            expect(statSync(path).mode & 0o777).toBe(0o600);
            expect(statSync(dirname(path)).mode & 0o777).toBe(0o700);
        }

        removeEmbeddedMpvSubtitleTexts();
        expect(existsSync(path)).toBe(false);
    });

    it('refuses empty text and logs only the message through IPC', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation();
        registerEmbeddedMpvSubtitleTextHandler();
        const [channel, handler] = mockHandle.mock.calls[0];

        expect(channel).toBe(EMBEDDED_MPV_ADD_SUBTITLE_TEXT);
        expect(() =>
            handler({}, 'session-1', 'secret-name.vtt', '  ')
        ).toThrow();
        expect(mockAddSubtitle).not.toHaveBeenCalled();
        expect(JSON.stringify(error.mock.calls)).not.toContain('secret-name');
        error.mockRestore();
    });
});
