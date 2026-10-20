import { signal } from '@angular/core';

/** Quiet this long while a channel plays, and the overlay goes. */
export const OVERLAY_IDLE_MS = 2000;
/** A mouse move this soon after the overlay was sent away keeps it away. */
export const SETTLE_MS = 700;

/**
 * "En vivo"'s overlay as a TV app shows it: on screen while anything
 * happens, gone after a few quiet seconds while a channel plays, back on
 * the next mouse move or key. It stays while `canHide` says no: nothing
 * plays, keyboard focus is inside it, the pointer rests on it, the
 * country menu is open.
 */
export class OverlayIdle {
    readonly visible = signal(true);
    private timer: ReturnType<typeof setTimeout> | null = null;
    private hiddenAt = -Infinity;

    constructor(
        private readonly canHide: () => boolean,
        private readonly delayMs = OVERLAY_IDLE_MS
    ) {}

    /** Something happened: on screen, and the quiet time starts again. */
    wake(): void {
        this.visible.set(true);
        this.restart();
    }

    /**
     * The mouse moved: as `wake`, except just after the overlay was sent
     * away (the hand still on the mouse that clicked).
     */
    nudge(): void {
        if (Date.now() - this.hiddenAt >= SETTLE_MS) {
            this.wake();
        }
    }

    /** Esc, or a click on the picture: off screen now, if it may go. */
    hide(): void {
        this.clear();
        if (this.canHide()) {
            this.visible.set(false);
            this.hiddenAt = Date.now();
        }
    }

    /** Call when `canHide` may have changed. */
    update(): void {
        if (this.canHide()) {
            this.restart();
        } else {
            this.clear();
            this.visible.set(true);
        }
    }

    destroy(): void {
        this.clear();
    }

    private restart(): void {
        this.clear();
        this.timer = setTimeout(() => {
            this.timer = null;
            if (this.canHide()) {
                this.visible.set(false);
            }
        }, this.delayMs);
    }

    private clear(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
