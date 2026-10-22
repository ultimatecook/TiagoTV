import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LazySnackBar, SettingsStore } from '@iptvnator/services';
import { VodEmbeddedMpvAvailability } from '../web-player-view/vod-embedded-mpv';
import {
    diagnosticTargetPlayer,
    EMBEDDED_MPV_TARGET,
    type DiagnosticPlayerTarget,
} from '../web-player-view/web-player-recovery-policy';

/** How long the "… is now your player" note stays. */
const CONFIRMATION_MS = 3500;

/**
 * The error screen's player buttons save their player as the default: the
 * same `player` setting Settings → Playback → Video player writes, so the
 * next stream starts on it. "Only this time" skips this.
 */
@Injectable({ providedIn: 'root' })
export class PlayerChoiceService {
    private readonly settings = inject(SettingsStore);
    private readonly snackBar = inject(LazySnackBar);
    private readonly translate = inject(TranslateService);
    /** This machine can play in Embedded MPV (Electron with the runtime). */
    readonly embeddedMpvAvailable = inject(VodEmbeddedMpvAvailability)
        .available;

    async remember(target: DiagnosticPlayerTarget): Promise<void> {
        const player = diagnosticTargetPlayer(target);
        if (this.settings.player?.() !== player) {
            try {
                await this.settings.updateSettings({ player });
            } catch {
                // The store keeps the choice for this session and flags it.
            }
        }
        const message = this.translate.instant(
            'PLAYBACK_DIAGNOSTICS.PLAYER_SAVED',
            { player: this.playerName(target) }
        );
        void this.snackBar.open(message, undefined, {
            duration: CONFIRMATION_MS,
        });
    }

    playerName(target: DiagnosticPlayerTarget): string {
        switch (target) {
            case EMBEDDED_MPV_TARGET:
                return this.translate.instant(
                    'PLAYBACK_DIAGNOSTICS.EMBEDDED_MPV_NAME'
                );
            case 'videojs':
                return 'Video.js';
            case 'html5':
                return 'HTML5';
            case 'artplayer':
                return 'ArtPlayer';
            case 'mpv':
                return 'MPV';
            case 'vlc':
                return 'VLC';
        }
    }
}
