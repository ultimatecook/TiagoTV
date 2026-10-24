import { ipcMain } from 'electron';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    EMBEDDED_MPV_ADD_SUBTITLE_TEXT,
    type EmbeddedMpvSession,
} from '@iptvnator/shared/interfaces';
import { embeddedMpvNativeService } from '../services/embedded-mpv-native.service';
import { MAX_SUBTITLE_BYTES } from './opensubtitles.events';

/**
 * Subtitles the renderer holds as text (downloaded from OpenSubtitles) for
 * Embedded MPV, which loads subtitles from files (`sub-add`): each one is
 * written to a private (0700 directory, 0600 file) temp folder of this run
 * and added like a picked file, so a reconnect re-adds it. The folder goes
 * at shutdown; another run's leftovers sit in the OS temp folder, which the
 * OS clears.
 */
let folder: string | null = null;
let counter = 0;

/** A safe file name: the label's letters and digits, `.srt` or `.vtt`. */
export function subtitleTextFileName(name: unknown, index: number): string {
    const raw = typeof name === 'string' ? name : '';
    const extension = /\.srt$/i.test(raw) ? 'srt' : 'vtt';
    const base =
        raw
            .replace(/\.(srt|vtt)$/i, '')
            .replace(/[^\p{L}\p{N} ._()-]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80) || 'subtitles';
    return `${index}-${base}.${extension}`;
}

export function addEmbeddedMpvSubtitleText(
    sessionId: string,
    name: string,
    content: string
): EmbeddedMpvSession | null {
    if (
        typeof sessionId !== 'string' ||
        typeof content !== 'string' ||
        !content.trim() ||
        content.length > MAX_SUBTITLE_BYTES
    ) {
        throw new Error('The subtitle text is not usable.');
    }
    folder ??= mkdtempSync(join(tmpdir(), 'tiagotv-subtitles-'));
    counter += 1;
    const path = join(folder, subtitleTextFileName(name, counter));
    writeFileSync(path, content, { encoding: 'utf-8', mode: 0o600 });
    return embeddedMpvNativeService.addSubtitle(sessionId, path);
}

export function registerEmbeddedMpvSubtitleTextHandler(): void {
    ipcMain.handle(
        EMBEDDED_MPV_ADD_SUBTITLE_TEXT,
        (_event, sessionId: string, name: string, content: string) => {
            try {
                return addEmbeddedMpvSubtitleText(sessionId, name, content);
            } catch (error) {
                // The message only: the text and its name stay out of logs.
                console.error(
                    '[Embedded MPV] Adding a downloaded subtitle failed:',
                    error instanceof Error ? error.message : 'unknown error'
                );
                throw error;
            }
        }
    );
}

export function removeEmbeddedMpvSubtitleTexts(): void {
    if (folder) {
        rmSync(folder, { recursive: true, force: true });
        folder = null;
    }
}
