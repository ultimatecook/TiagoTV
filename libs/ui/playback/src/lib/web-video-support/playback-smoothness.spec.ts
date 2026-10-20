import { TestBed } from '@angular/core/testing';
import {
    createHlsBufferConfig,
    createMpegTsBufferConfig,
    PLAYBACK_SMOOTHNESS,
} from './playback-smoothness';

describe('playback smoothness buffers', () => {
    it('keeps the stock mpegts.js and hls.js config in "normal"', () => {
        expect(createMpegTsBufferConfig('normal', true)).toEqual({});
        expect(createMpegTsBufferConfig('normal', false)).toEqual({});
        expect(createHlsBufferConfig('normal')).toEqual({});
    });

    it('buffers more on a live MPEG-TS stream in "Más estable"', () => {
        expect(createMpegTsBufferConfig('stable', true)).toEqual({
            enableStashBuffer: true,
            stashInitialSize: 1536 * 1024,
            liveBufferLatencyChasing: false,
            liveSync: false,
            lazyLoad: false,
        });
    });

    it('keeps lazy loading on a VOD MPEG-TS stream in "Más estable"', () => {
        const config = createMpegTsBufferConfig('stable', false);

        expect(config).toEqual(
            expect.objectContaining({
                enableStashBuffer: true,
                stashInitialSize: 1536 * 1024,
            })
        );
        expect(config).not.toHaveProperty('lazyLoad');
    });

    it('raises the hls.js buffer goal and live distance in "Más estable"', () => {
        expect(createHlsBufferConfig('stable')).toEqual({
            maxBufferLength: 60,
            liveSyncDurationCount: 4,
        });
    });

    it('reads as "normal" outside a web player view', () => {
        expect(TestBed.inject(PLAYBACK_SMOOTHNESS)()).toBe('normal');
    });
});
