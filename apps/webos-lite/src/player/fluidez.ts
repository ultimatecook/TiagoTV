import type { StorageLike } from '../core/storage';

/**
 * "Fluidez" (Ajustes): how live channels open.
 *
 *   stable  "Más estable" (the default): HLS first. The TV's player
 *           downloads a few segments ahead, so an uneven connection
 *           does not cut the picture; it starts a few seconds later.
 *   normal  MPEG-TS first: the stream starts sooner, with less margin.
 *
 * Kept as a plain string in localStorage (`tiagotv.lite.fluidez`); a
 * missing or unknown value reads as `stable`.
 */
export type Fluidez = 'stable' | 'normal';

export const FLUIDEZ_KEY = 'tiagotv.lite.fluidez';

export const FLUIDEZ_LABEL: Readonly<Record<Fluidez, string>> = {
    stable: 'Más estable',
    normal: 'Normal',
};

export const FLUIDEZ_HINT =
    'Más estable carga unos segundos por adelantado para que la imagen no se corte. Normal arranca más rápido.';

function storage(): StorageLike | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/** This session's choice, for a TV whose storage refuses to keep it. */
let chosen: Fluidez | null = null;

export function loadFluidez(from: StorageLike | null = storage()): Fluidez {
    if (chosen !== null) {
        return chosen;
    }
    try {
        return from && from.getItem(FLUIDEZ_KEY) === 'normal' ? 'normal' : 'stable';
    } catch {
        return 'stable';
    }
}

export function saveFluidez(value: Fluidez, to: StorageLike | null = storage()): void {
    chosen = value;
    try {
        to?.setItem(FLUIDEZ_KEY, value);
    } catch {
        // A full or blocked storage: the choice lasts until the app closes.
    }
}
