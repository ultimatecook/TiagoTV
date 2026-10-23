import { onActivity } from '../core/activity';

/**
 * The Android TV app's bridge (apps/androidtv): `window.TiagoTVNative`,
 * a Java object the WebView injects before the page loads. Its methods
 * are synchronous and take only strings, numbers and booleans; it
 * answers through `window.__tiagotvNativeEvent(event)` (native-media.ts
 * turns those into the events the player screen already listens for).
 *
 * The LG build never has it: everything here is inert without it, and
 * the `<video>` path (engine.ts) stays as it is.
 */
export interface NativeBridge {
    /** Opens a stream in the native player, after stopping the previous one. */
    play(url: string, kind: 'hls' | 'ts' | 'file', startAt: number): void;
    pause(): void;
    resume(): void;
    seek(seconds: number): void;
    /** Frees the native player's connection (idempotent). */
    stop(): void;
    setVolume(level: number): void;
    /** "Fluidez": `stable` buffers more, `normal` is the player's default. */
    setProfile(profile: 'stable' | 'normal'): void;
    /** A track id from the `tracks` event; "" turns subtitles off. */
    selectAudio(id: string): void;
    selectSubtitle(id: string): void;
    /** The native subtitles move up while the OSD's progress bar shows. */
    setSubtitlesRaised(raised: boolean): void;
    /** Back on the root screen, confirmed: the app closes. */
    exit(): void;
}

export interface NativeTrackInfo {
    readonly id: string;
    readonly language?: string | null;
    readonly label?: string | null;
    readonly selected?: boolean;
    readonly forced?: boolean;
}

export interface NativeEvent {
    readonly type:
        | 'ready'
        | 'playing'
        | 'waiting'
        | 'paused'
        | 'ended'
        | 'error'
        | 'timeupdate'
        | 'seeked'
        | 'tracks';
    readonly currentTime?: number;
    /** Seconds; null or missing for a live stream. */
    readonly duration?: number | null;
    /** The HTTP status the stream was refused with, when known. */
    readonly status?: number | null;
    readonly audio?: readonly NativeTrackInfo[];
    readonly text?: readonly NativeTrackInfo[];
}

interface NativeWindow {
    TiagoTVNative?: Partial<NativeBridge>;
    __tiagotvNativeEvent?: (event: NativeEvent) => void;
    __tiagotvNativeKey?: (keyCode: number) => boolean;
}

const REQUIRED: readonly (keyof NativeBridge)[] = ['play', 'stop', 'pause', 'resume', 'seek', 'exit'];

/** The bridge, when the page runs in the Android app. */
export function nativeBridge(host: object = window): NativeBridge | null {
    const bridge = (host as NativeWindow).TiagoTVNative;
    if (!bridge || typeof bridge !== 'object') {
        return null;
    }
    return REQUIRED.every((name) => typeof bridge[name] === 'function') ? (bridge as NativeBridge) : null;
}

/**
 * The Activity hands the remote's keys the WebView does not deliver
 * (Back, CH+/CH-, the media keys) to the page as the key codes the LG
 * remote sends (core/keys.ts), and finishes only when the page did not
 * take Back (true means taken).
 */
export function installNativeKeys(host: object = window): void {
    (host as NativeWindow).__tiagotvNativeKey = (keyCode: number) => {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'keyCode', { get: () => keyCode });
        Object.defineProperty(event, 'which', { get: () => keyCode });
        document.dispatchEvent(event);
        return event.defaultPrevented;
    };
}

/**
 * The native player draws behind the page (the WebView is transparent):
 * while a stream is held, the room and the stage let it through
 * (player.css, `html.is-native-video`).
 */
export function installNativeBackdrop(root: HTMLElement = document.documentElement): void {
    onActivity((activity) => {
        root.classList.toggle('is-native-video', activity !== 'idle');
    });
}
