import type { PlayerSubtitleFile } from '../player-controls/player-controls.model';
import type { VideoJsTextTrack } from './vjs-player.types';

/** The part of a Video.js player that adds a remote text track. */
export interface VjsRemoteTextTrackPlayer {
    addRemoteTextTrack?: (
        options: Record<string, unknown>,
        manualCleanup?: boolean
    ) => unknown;
}

/**
 * Downloaded subtitles (OpenSubtitles) on Video.js: each WebVTT text
 * becomes a remote text track from a blob address, which Video.js removes
 * itself when the source changes; the addresses are released with the
 * source.
 */
export class VjsExternalSubtitles {
    private urls: string[] = [];

    constructor(private readonly player: VjsRemoteTextTrackPlayer) {}

    /** The added track, or null when Video.js could not take it. */
    add(file: PlayerSubtitleFile): VideoJsTextTrack | null {
        if (
            file.format !== 'vtt' ||
            typeof this.player.addRemoteTextTrack !== 'function' ||
            typeof URL.createObjectURL !== 'function'
        ) {
            return null;
        }
        const url = URL.createObjectURL(
            new Blob([file.content], { type: 'text/vtt' })
        );
        this.urls.push(url);
        try {
            const element = this.player.addRemoteTextTrack(
                {
                    kind: 'subtitles',
                    src: url,
                    srclang: file.language ?? '',
                    label: file.name,
                },
                false
            ) as { track?: VideoJsTextTrack } | undefined;
            return element?.track ?? null;
        } catch {
            return null;
        }
    }

    clear(): void {
        for (const url of this.urls) {
            URL.revokeObjectURL?.(url);
        }
        this.urls = [];
    }
}
