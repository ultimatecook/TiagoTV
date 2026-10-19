/**
 * "En vivo"'s keys, as a TV's remote: Space or K plays and pauses, M
 * mutes, F goes full screen, an arrow brings the overlay's cards under
 * focus, Esc closes the country menu or the overlay. A key a focused
 * control handles itself (a card's arrows, a button's Space) stays its.
 */
export type LiveKeyAction =
    'play' | 'mute' | 'fullscreen' | 'cards' | 'collapse';

const ACTIONS: Readonly<Record<string, LiveKeyAction>> = {
    ' ': 'play',
    k: 'play',
    K: 'play',
    m: 'mute',
    M: 'mute',
    f: 'fullscreen',
    F: 'fullscreen',
    ArrowLeft: 'cards',
    ArrowRight: 'cards',
    ArrowUp: 'cards',
    ArrowDown: 'cards',
    Escape: 'collapse',
};

const INTERACTIVE =
    'a[href], button, input, select, summary, textarea, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="textbox"], [role="combobox"], [role="option"], [role^="menuitem"]';

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
    return target?.closest?.(INTERACTIVE) ? null : action;
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
