import type { AudioLanguagePreference } from '@iptvnator/shared/interfaces';
import type {
    PlayerController,
    PlayerControlsState,
} from '../player-controls/player-controls.model';
import {
    preferredAudioTrack,
    preferredSubtitleTrack,
} from './track-preference';

/**
 * Applies the audio language to a web player's tracks once per playback:
 * the preferred audio track as soon as the file lists more than one, then
 * the subtitles for it (Spanish ones under original audio). Once applied,
 * the user's own choices in the player stand. Embedded MPV picks its
 * tracks itself (`selectsLanguageTracks`), and live TV is left alone.
 */
export class PlayerTrackPreferences {
    private controller: PlayerController | null = null;
    private key: string | null = null;
    private audioDone = false;
    private subtitlesDone = false;
    private chosenAudioId: number | null = null;

    apply(
        controller: PlayerController,
        state: PlayerControlsState,
        key: string,
        preference: AudioLanguagePreference
    ): void {
        if (controller !== this.controller || key !== this.key) {
            this.controller = controller;
            this.key = key;
            this.audioDone = false;
            this.subtitlesDone = false;
            this.chosenAudioId = null;
        }
        if (controller.selectsLanguageTracks || state.isLive) {
            return;
        }
        if (!this.audioDone && state.audioTracks.length > 1) {
            this.audioDone = true;
            const audio = preferredAudioTrack(state.audioTracks, preference);
            this.chosenAudioId = audio?.id ?? null;
            if (audio && !audio.selected) {
                controller.commands.setAudioTrack(audio.id);
            }
        }
        if (this.subtitlesDone || state.subtitleTracks.length === 0) {
            return;
        }
        this.subtitlesDone = true;
        const audio =
            state.audioTracks.find(
                (track) => track.id === this.chosenAudioId
            ) ??
            state.audioTracks.find((track) => track.selected) ??
            (state.audioTracks.length === 1 ? state.audioTracks[0] : null);
        const subtitle = preferredSubtitleTrack(
            state.subtitleTracks,
            audio,
            preference
        );
        if (subtitle === 'off') {
            controller.commands.setSubtitleTrack(-1);
        } else if (subtitle && !subtitle.selected) {
            controller.commands.setSubtitleTrack(subtitle.id);
        }
    }
}
