/**
 * "En vivo"'s keys, as a TV's remote: Space or K plays and pauses, M
 * mutes, F goes full screen, L adds the channel to Mi lista or takes it
 * off, an arrow brings the overlay's cards under focus, Esc closes the
 * country menu or the overlay. A key a focused control handles itself (a
 * card's arrows and L, a field's typing) stays its; Enter still presses
 * the focused button, Space no longer does: after a click on a card or a
 * control, Space pauses as on a TV.
 */
export type LiveKeyAction =
    'play' | 'mute' | 'fullscreen' | 'favorite' | 'cards' | 'collapse';

const ACTIONS: Readonly<Record<string, LiveKeyAction>> = {
    ' ': 'play',
    k: 'play',
    K: 'play',
    m: 'mute',
    M: 'mute',
    f: 'fullscreen',
    F: 'fullscreen',
    l: 'favorite',
    L: 'favorite',
    ArrowLeft: 'cards',
    ArrowRight: 'cards',
    ArrowUp: 'cards',
    ArrowDown: 'cards',
    Escape: 'collapse',
};

const INTERACTIVE =
    'a[href], button, input, select, summary, textarea, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="textbox"], [role="combobox"], [role="option"], [role^="menuitem"]';
/**
 * Where a letter, or a space, is typed. A button or a card has no letter
 * keys of its own: F on the full screen button just pressed (it keeps the
 * focus) still leaves full screen, and Space on it pauses.
 */
const TYPING =
    'input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]';

export function liveKeyAction(event: KeyboardEvent): LiveKeyAction | null {
    if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
    ) {
        return null;
    }
    const action = ACTIONS[event.key] ?? null;
    if (action === 'collapse') {
        return action;
    }
    const target = event.target as Element | null;
    const own = event.key.length === 1 ? TYPING : INTERACTIVE;
    return target?.closest?.(own) ? null : action;
}

/**
 * Whether a key is the page's: pressed on it or on nothing in particular
 * (the body), not in a dialog, a field of the top bar, or while the page
 * is behind an inert layer.
 */
export function onLivePage(event: KeyboardEvent, page: HTMLElement): boolean {
    if (page.closest('[inert]')) {
        return false;
    }
    const target = event.target as Node | null;
    return (
        !target ||
        target === document.body ||
        target === document.documentElement ||
        target === document ||
        page.contains(target)
    );
}
