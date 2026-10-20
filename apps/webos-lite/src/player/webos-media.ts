/**
 * LG's `mediaOption` for HLS on webOS (webostv.developer.lge.com,
 * "mediaOption Parameters"): a JSON object, URI-encoded into the type of
 * the video's `<source>`. Only documented fields are used:
 *
 *   mediaTransportType "HLS"                  the HLS player (also the
 *                                              default for an .m3u8);
 *   option.adaptiveStreaming.bps.start         the bit rate a multi-
 *                                              variant playlist starts
 *                                              at (webOS 3.0 and later).
 *
 * Starting below the top variant gets the first frames on screen without
 * a stall on an uneven connection; the TV's player climbs from there.
 * LG documents no buffer-size option for webOS 4.
 *
 * Guarded: only on webOS, and an HLS attempt with the option that fails
 * turns it off for the session (the next ones use a plain `src`).
 */
const START_BPS = 1500000;
const HLS_MIME = 'application/vnd.apple.mpegurl';

interface PalmWindow {
    PalmSystem?: unknown;
}

let disabled = false;

export function isWebOS(): boolean {
    const palm = (window as unknown as PalmWindow).PalmSystem;
    return !!palm || /Web0S|webOS/.test(navigator.userAgent);
}

export function hlsMediaOptionType(webos = isWebOS()): string | null {
    if (disabled || !webos) {
        return null;
    }
    const options = {
        mediaTransportType: 'HLS',
        option: { adaptiveStreaming: { bps: { start: START_BPS } } },
    };
    return `${HLS_MIME};mediaOption=${encodeURI(JSON.stringify(options))}`;
}

/** An attempt with the option failed: plain `src` from now on. */
export function disableMediaOption(): void {
    disabled = true;
}

export function mediaOptionDisabled(): boolean {
    return disabled;
}
