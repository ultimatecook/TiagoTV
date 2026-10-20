/**
 * Subtitle files the provider lists for a title (SubRip .srt or WebVTT
 * .vtt): downloaded as text, parsed here into cues, and drawn by the
 * player over the video (ui/track-menu.ts), the same way as a file's
 * embedded tracks. Positioning and styling blocks are dropped; tags
 * (<i>, <font>, {\an8}) are removed, line breaks kept. The desktop's
 * parser (external-subtitle-cues.util.ts) works the same way.
 */
export interface Cue {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

/** "00:01:02,500" (SRT), "01:02.500" or "00:01:02.500" (VTT). */
const TIME = /(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;
const TIMING = new RegExp(`^\\s*(${TIME.source})\\s*-->\\s*(${TIME.source})`);

function seconds(value: string): number | null {
    const match = TIME.exec(value.trim());
    if (!match) {
        return null;
    }
    const millis = Number((match[4] + '00').slice(0, 3));
    return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + millis / 1000;
}

/** A cue's text without markup, its line breaks kept. */
export function plainCueText(text: string): string {
    return clean([text]);
}

function clean(lines: readonly string[]): string {
    return lines
        .join('\n')
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

/** The cues of an SRT or VTT file, by start time; bad blocks skipped. */
export function parseSubtitles(content: string): Cue[] {
    const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
    const cues: Cue[] = [];
    let index = 0;
    while (index < lines.length) {
        const timing = TIMING.exec(lines[index]);
        index++;
        if (!timing) {
            continue;
        }
        const text: string[] = [];
        while (index < lines.length && lines[index].trim() !== '') {
            text.push(lines[index]);
            index++;
        }
        const start = seconds(timing[1]);
        const end = seconds(timing[6]);
        const shown = clean(text);
        if (start !== null && end !== null && end > start && shown) {
            cues.push({ start, end, text: shown });
        }
    }
    return cues.sort((a, b) => a.start - b.start);
}

/** The texts on screen at `time` (cues sorted by start). */
export function cuesAt(cues: readonly Cue[], time: number): string[] {
    const shown: string[] = [];
    // The last cue starting at or before `time`, then back over overlaps.
    let low = 0;
    let high = cues.length - 1;
    let last = -1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        if (cues[middle].start <= time) {
            last = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    for (let i = last; i >= 0 && i > last - 8; i--) {
        if (cues[i].end > time) {
            shown.unshift(cues[i].text);
        }
    }
    return shown;
}
