import { InjectionToken } from '@angular/core';
import type { HlsConfig } from 'hls.js';
import type mpegts from 'mpegts.js';
import type { PlaybackSmoothness } from '@iptvnator/shared/interfaces';

/**
 * The "Fluidez" setting as the web engines read it, each time one starts a
 * stream. `WebPlayerViewComponent` provides the user's choice; outside it
 * (the engines' own unit tests) the stock buffering applies.
 */
export const PLAYBACK_SMOOTHNESS = new InjectionToken<() => PlaybackSmoothness>(
    'PLAYBACK_SMOOTHNESS',
    {
        providedIn: 'root',
        factory: () => () => 'normal',
    }
);

/** What mpegts.js gathers before its first append: 1.5 MiB. */
const STABLE_STASH_INITIAL_BYTES = 1536 * 1024;

/**
 * mpegts.js options for "Más estable": a 1.5 MiB first stash instead of
 * 64 KiB, so playback starts on a bigger first append, and a live stream
 * is never sped up or seeked towards its edge (latency chasing and live
 * sync stay off) nor paused for lazy loading. These match mpegts.js 1.8
 * defaults except the stash; they are spelled out so a library update
 * cannot turn them on. `normal` adds nothing.
 */
export function createMpegTsBufferConfig(
    smoothness: PlaybackSmoothness,
    isLive: boolean
): mpegts.Config {
    if (smoothness !== 'stable') {
        return {};
    }
    return {
        enableStashBuffer: true,
        stashInitialSize: STABLE_STASH_INITIAL_BYTES,
        liveBufferLatencyChasing: false,
        liveSync: false,
        ...(isLive ? { lazyLoad: false } : {}),
    };
}

/**
 * hls.js options for "Más estable": at least 60 s buffered ahead instead
 * of 30 (the 600 s ceiling stays), and a live stream starts four target
 * durations behind its edge instead of three. `normal` adds nothing.
 */
export function createHlsBufferConfig(
    smoothness: PlaybackSmoothness
): Partial<HlsConfig> {
    return smoothness === 'stable'
        ? { maxBufferLength: 60, liveSyncDurationCount: 4 }
        : {};
}
