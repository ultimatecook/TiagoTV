import { effect, inject, Injectable, signal, untracked } from '@angular/core';

/** The players' shared volume key (HTML5, Video.js and Embedded MPV). */
const VOLUME_KEY = 'volume';

export interface PlayerVolumeRequest {
    /** 0–1. */
    readonly volume: number;
    readonly id: number;
}

/**
 * The app's one volume, set from outside a player: the En vivo and league
 * stages hide the player's own controls and drive it themselves. A web
 * player's `<video>` they set directly; Embedded MPV draws without one, so
 * it follows the requests made here (`EmbeddedMpvPlayerComponent`). The
 * level persists under the key every player already reads at start.
 */
@Injectable({ providedIn: 'root' })
export class PlayerVolumeService {
    private readonly requested = signal<PlayerVolumeRequest | null>(null);
    private nextId = 1;

    /** The latest level asked for; a player applies those newer than it. */
    readonly latest = this.requested.asReadonly();

    /** The saved level, 0–1 (1 when none was saved). */
    stored(): number {
        try {
            const raw = localStorage.getItem(VOLUME_KEY);
            const value = raw === null ? 1 : Number(raw);
            return Number.isFinite(value) ? clampVolume(value) : 1;
        } catch {
            return 1;
        }
    }

    /** Saves the level and asks the playing Embedded MPV for it. */
    request(volume: number): void {
        const value = clampVolume(volume);
        this.save(value);
        this.requested.set({ volume: value, id: this.nextId++ });
    }

    save(volume: number): void {
        try {
            localStorage.setItem(VOLUME_KEY, String(clampVolume(volume)));
        } catch {
            // Storage blocked: the level holds for this session only.
        }
    }
}

export function clampVolume(value: number): number {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

/**
 * A player's side: applies the levels asked for after it mounted (not one
 * asked before, which the saved level already carries). Call in an
 * injection context.
 */
export function followPlayerVolumeRequests(
    apply: (volume: number) => void
): void {
    const volumes = inject(PlayerVolumeService);
    let seen = volumes.latest()?.id ?? 0;
    effect(() => {
        const request = volumes.latest();
        if (!request || request.id <= seen) {
            return;
        }
        seen = request.id;
        untracked(() => apply(request.volume));
    });
}
