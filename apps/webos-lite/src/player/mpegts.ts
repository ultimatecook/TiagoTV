import type { MpegtsLike } from './engine';

/**
 * mpegts.js (vendored ES5 build) loads only when a channel needs it: most
 * channels play in webOS's own pipeline, and its 270 KB would slow the
 * start-up of every session.
 */
let pending: Promise<MpegtsLike | null> | null = null;

interface MpegtsWindow {
    mpegts?: MpegtsLike;
}

export function loadMpegts(): Promise<MpegtsLike | null> {
    const host = window as unknown as MpegtsWindow;
    if (host.mpegts) {
        return Promise.resolve(host.mpegts);
    }
    if (!pending) {
        pending = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'vendor/mpegts.js';
            script.onload = () => resolve(host.mpegts ?? null);
            script.onerror = () => {
                pending = null;
                resolve(null);
            };
            document.head.appendChild(script);
        });
    }
    return pending;
}

/** Whether MSE can play H.264/AAC, which mpegts.js remuxes TS into. */
export function mseSupported(): boolean {
    const source = (window as unknown as { MediaSource?: typeof MediaSource }).MediaSource;
    return (
        !!source &&
        typeof source.isTypeSupported === 'function' &&
        source.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')
    );
}
