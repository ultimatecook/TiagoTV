/**
 * A page's own choices (the day on Deportes, a chip, a row's sideways
 * scroll) kept on the browser's history entry: none adds an entry, and
 * each comes back when Back or Forward returns to the entry (or the page
 * reloads), while a new visit starts fresh. The router keeps an entry's
 * other state keys when it returns to it, and a page's own `replaceUrl`
 * navigation carries them in its `state` (`pageMemoryState`).
 */
const KEY = 'tvPageMemory';

type State = Record<string, unknown>;

/** What this history entry remembers under `key`, when `accept` takes it. */
export function recallPageChoice<T>(
    key: string,
    accept: (value: unknown) => value is T
): T | undefined {
    const memory = currentState()?.[KEY];
    if (!memory || typeof memory !== 'object') {
        return undefined;
    }
    const value = (memory as State)[key];
    return accept(value) ? value : undefined;
}

/** Remembers `value` under `key` on this history entry, adding none. */
export function rememberPageChoice(key: string, value: unknown): void {
    const history = browserHistory();
    if (!history) {
        return;
    }
    const state = currentState() ?? {};
    const memory = state[KEY];
    try {
        history.replaceState(
            {
                ...state,
                [KEY]: {
                    ...(memory && typeof memory === 'object' ? memory : {}),
                    [key]: value,
                },
            },
            ''
        );
    } catch {
        // A browser that refuses (too many updates): the choice is not kept.
    }
}

/**
 * The entry's memory, for a navigation that replaces the entry (a search
 * term written to the URL) to pass on as its `state`.
 */
export function pageMemoryState(): State {
    const memory = currentState()?.[KEY];
    return memory && typeof memory === 'object' ? { [KEY]: memory } : {};
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function browserHistory(): History | null {
    try {
        return typeof history === 'undefined' ? null : history;
    } catch {
        return null;
    }
}

function currentState(): State | null {
    const state = browserHistory()?.state as unknown;
    return state && typeof state === 'object' ? (state as State) : null;
}
