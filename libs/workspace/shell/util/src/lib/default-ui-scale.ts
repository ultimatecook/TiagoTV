import { type EnvironmentProviders, provideAppInitializer } from '@angular/core';
import {
    ZOOM_LEVEL_DEFAULT,
    ZOOM_LEVEL_MIN,
    ZOOM_LEVEL_STEP,
    type ZoomLevelAction,
} from '@iptvnator/shared/interfaces';

/**
 * TiagoTV's default UI scale (see `docs/architecture/workspace-shell.md`,
 * "Zoom level"). The redesign uses the design handoff's sizes 1:1, but the
 * user approved the prototype seen at zoom .8, so every screen came out
 * 1.25× too big. Instead of shrinking each page, the Electron build starts
 * at app zoom level −1 (≈83 %) — once, and only for a user who never
 * changed the zoom: it goes through the zoom shortcuts' own bridge, so the
 * level persists like a user's choice and Cmd/Ctrl and +/−/0 still move it.
 */
export const DEFAULT_UI_SCALE_STORAGE_KEY = 'tiagotv:ui-scale-default:v1';
/** Two shortcut steps out: 1.2^−1 ≈ 83 %. */
export const DEFAULT_UI_ZOOM_LEVEL =
    ZOOM_LEVEL_DEFAULT - 2 * ZOOM_LEVEL_STEP;

/** The preload's zoom bridge: steps the frame's level, returns the new one. */
export interface UiScaleZoomBridge {
    adjustZoomLevel(action: ZoomLevelAction): number;
}

export interface UiScaleFlagStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export type DefaultUiScaleOutcome =
    /** The level was the default: now `DEFAULT_UI_ZOOM_LEVEL`. */
    | 'applied'
    /** The user had chosen a level: left as it was. */
    | 'kept'
    /** Done on an earlier start. */
    | 'done-before'
    /** No zoom bridge (browser build) or no storage for the flag. */
    | 'unavailable';

/**
 * Sets the default UI scale once ever. The bridge has no getter, so it
 * probes: one step out lands on −0.5 only from level 0 (never changed) —
 * then one more step makes it −1; from any other level the probe is undone
 * with a step in. A probe that lands on the minimum may not have moved
 * (the level already sat there), so it is not undone. The flag is written
 * before the probe: a start that fails half-way never runs it twice, and
 * without storage for the flag nothing runs (it would re-run every start
 * and undo a user's Cmd/Ctrl+0).
 */
export function applyDefaultUiScale(
    bridge: Partial<UiScaleZoomBridge> | null | undefined,
    storage: UiScaleFlagStore | null
): DefaultUiScaleOutcome {
    if (typeof bridge?.adjustZoomLevel !== 'function' || !storage) {
        return 'unavailable';
    }
    const zoom = bridge as UiScaleZoomBridge;
    try {
        if (storage.getItem(DEFAULT_UI_SCALE_STORAGE_KEY) !== null) {
            return 'done-before';
        }
        storage.setItem(DEFAULT_UI_SCALE_STORAGE_KEY, String(Date.now()));
    } catch {
        return 'unavailable';
    }
    try {
        const probed = zoom.adjustZoomLevel('out');
        if (probed === ZOOM_LEVEL_DEFAULT - ZOOM_LEVEL_STEP) {
            zoom.adjustZoomLevel('out');
            return 'applied';
        }
        if (probed > ZOOM_LEVEL_MIN) {
            zoom.adjustZoomLevel('in');
        }
    } catch {
        // The frame refused the write: the level on screen is unchanged.
    }
    return 'kept';
}

/**
 * Runs `applyDefaultUiScale` at startup, once the document is parsed: the
 * preload restores the stored level on `DOMContentLoaded` (its listener,
 * added at preload start, runs before this one), and the probe must read
 * that level, not the per-URL default before it.
 */
export function provideDefaultUiScale(): EnvironmentProviders {
    return provideAppInitializer(() => {
        const run = () =>
            applyDefaultUiScale(
                typeof window === 'undefined' ? null : window.electron,
                localStorageOrNull()
            );
        if (typeof document !== 'undefined' && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    });
}

function localStorageOrNull(): UiScaleFlagStore | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}
