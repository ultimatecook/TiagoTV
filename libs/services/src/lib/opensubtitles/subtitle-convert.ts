/**
 * OpenSubtitles hands out SRT files. The players take WebVTT (a web
 * player's text track; mpv reads both), so a download is converted once and
 * cached as WebVTT: the `WEBVTT` header, `.` instead of `,` in the cue
 * timings, and SRT's ASS-style position tags (`{\an8}`) removed, which a
 * browser would otherwise show as text.
 */
const TIMING =
    /^(\s*(?:\d{1,3}:)?\d{1,2}:\d{1,2})[,.](\d{1,3})(\s*-->\s*(?:\d{1,3}:)?\d{1,2}:\d{1,2})[,.](\d{1,3})(.*)$/;
const ASS_TAG = /\{\\[^}]*\}/g;

export function srtToVtt(srt: string): string {
    const text = srt.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    if (/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(text)) {
        return text;
    }
    const lines = text.split('\n').map((line) => {
        const timing = TIMING.exec(line);
        if (timing) {
            return `${timing[1]}.${timing[2].padEnd(3, '0')}${timing[3]}.${timing[4].padEnd(3, '0')}`;
        }
        return line.replace(ASS_TAG, '');
    });
    return `WEBVTT\n\n${lines.join('\n').trim()}\n`;
}

/** Whether a downloaded file holds at least one cue timing. */
export function hasSubtitleCues(content: string): boolean {
    return content
        .split(/\r\n?|\n/)
        .some((line) => TIMING.test(line));
}
