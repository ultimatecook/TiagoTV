import { store, type JsonStore } from '../core/storage';
import type { XtreamCredentials } from './client';

/**
 * The account the viewer typed on the TV, kept in the TV's localStorage
 * only (never in the package, never in a log), and the remembered
 * country. (How streams open is "Fluidez", player/fluidez.ts; an older
 * stored `format` is ignored.)
 */
const SOURCE_KEY = 'tiagotv-lite:source:v1';
const PREFS_KEY = 'tiagotv-lite:prefs:v1';

export interface Preferences {
    readonly country: string | null;
}

function isCredentials(value: unknown): value is XtreamCredentials {
    const v = value as XtreamCredentials | null;
    return (
        !!v &&
        typeof v.server === 'string' &&
        typeof v.username === 'string' &&
        typeof v.password === 'string' &&
        v.server !== '' &&
        v.username !== ''
    );
}

export function loadSource(from: JsonStore = store): XtreamCredentials | null {
    const value = from.read<unknown>(SOURCE_KEY, null);
    return isCredentials(value) ? value : null;
}

export function saveSource(source: XtreamCredentials, to: JsonStore = store): boolean {
    return to.write(SOURCE_KEY, {
        server: source.server,
        username: source.username,
        password: source.password,
    });
}

export function forgetSource(from: JsonStore = store): void {
    from.remove(SOURCE_KEY);
}

export function loadPrefs(from: JsonStore = store): Preferences {
    const value = from.read<Partial<Preferences>>(PREFS_KEY, {});
    return {
        country: typeof value.country === 'string' ? value.country : null,
    };
}

export function savePrefs(change: Partial<Preferences>, to: JsonStore = store): Preferences {
    const next = { ...loadPrefs(to), ...change };
    to.write(PREFS_KEY, next);
    return next;
}
