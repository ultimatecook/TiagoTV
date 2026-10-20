import type { Fluidez } from './fluidez';

/**
 * The ways to open a stream, in the order the TV tries them. webOS plays
 * MPEG-TS and HLS in its own media pipeline, so a live channel opens in
 * `<video>` as `.m3u8` or `.ts` (the order depends on "Fluidez"), and only
 * then through mpegts.js (Media Source Extensions), which costs CPU.
 *
 *   stable  HLS → TS → TS over MSE (segments buffered ahead: steadier);
 *   normal  TS → HLS → TS over MSE (starts sooner).
 */
export type Engine = 'native' | 'mpegts';

export interface Candidate {
    readonly url: string;
    readonly engine: Engine;
    readonly label: string;
    /**
     * A `<source type>` for the native pipeline (LG's mediaOption);
     * without one the URL is the video's `src`.
     */
    readonly type?: string;
    /** How long the attempt may take to show a picture. */
    readonly timeoutMs?: number;
}

export interface LiveSourceOptions {
    /** Whether mpegts.js can play here (MSE with H.264/AAC). */
    readonly mse: boolean;
    /** The HLS `<source type>` carrying LG's mediaOption, if any. */
    readonly hlsType?: string | null;
}

/** HLS needs its playlist and a segment or two before the first frame. */
export const HLS_TIMEOUT_MS = 15000;
export const TS_TIMEOUT_MS = 12000;

export function liveCandidates(
    urlOf: (extension: 'ts' | 'm3u8') => string,
    fluidez: Fluidez,
    options: LiveSourceOptions
): Candidate[] {
    const ts: Candidate = { url: urlOf('ts'), engine: 'native', label: 'TS', timeoutMs: TS_TIMEOUT_MS };
    const hls: Candidate = {
        url: urlOf('m3u8'),
        engine: 'native',
        label: 'HLS',
        timeoutMs: HLS_TIMEOUT_MS,
        ...(options.hlsType ? { type: options.hlsType } : {}),
    };
    const list = fluidez === 'stable' ? [hls, ts] : [ts, hls];
    if (options.mse) {
        list.push({ url: urlOf('ts'), engine: 'mpegts', label: 'TS · MSE', timeoutMs: TS_TIMEOUT_MS });
    }
    return list;
}

/** Movies and episodes play as files (mp4, mkv) in `<video>`. */
export function fileCandidates(url: string): Candidate[] {
    return [{ url, engine: 'native', label: 'VOD' }];
}

export type StreamFailure = 'busy' | 'missing' | 'other';

/**
 * What an HTTP status on a stream means. Xtream panels refuse a stream
 * beyond the account's connections with 401, 403, 429, 458 or 509 (the
 * panel's choice); 404 and 410 are a channel that is gone.
 */
export function classifyStatus(status: number | null | undefined): StreamFailure {
    if (!status) {
        return 'other';
    }
    if (status === 404 || status === 410) {
        return 'missing';
    }
    return (status >= 400 && status < 500) || status === 509 ? 'busy' : 'other';
}
