/**
 * The few icons the TV draws, as inline SVG (no icon font to load):
 * search, settings, play, info, heart, check, back, backspace.
 */
export type IconName = 'search' | 'settings' | 'play' | 'info' | 'heart' | 'heart-on' | 'check' | 'back' | 'backspace' | 'space';

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const PATHS: Readonly<Record<IconName, string>> = {
    search: `<circle cx="11" cy="11" r="7" ${STROKE}/><path d="M20.5 20.5l-4.6-4.6" ${STROKE}/>`,
    settings:
        `<circle cx="12" cy="12" r="3.2" ${STROKE}/>` +
        `<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" ${STROKE}/>`,
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
    info: `<circle cx="12" cy="12" r="9.2" ${STROKE}/><path d="M12 11v5.5" ${STROKE}/><circle cx="12" cy="7.6" r="1.2" fill="currentColor"/>`,
    heart: `<path d="M12 20.3l-1.3-1.2C6 14.9 3 12.2 3 8.8 3 6.1 5.1 4 7.8 4c1.5 0 3 .7 4.2 1.9C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6.1 21 8.8c0 3.4-3 6.1-7.7 10.3z" ${STROKE}/>`,
    'heart-on':
        '<path d="M12 20.3l-1.3-1.2C6 14.9 3 12.2 3 8.8 3 6.1 5.1 4 7.8 4c1.5 0 3 .7 4.2 1.9C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6.1 21 8.8c0 3.4-3 6.1-7.7 10.3z" fill="currentColor"/>',
    check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${STROKE}/>`,
    back: `<path d="M15 5l-7 7 7 7" ${STROKE}/>`,
    backspace: `<path d="M21 5H9l-6 7 6 7h12z" ${STROKE}/><path d="M17 9.5l-5 5M12 9.5l5 5" ${STROKE}/>`,
    space: `<path d="M4 10v4h16v-4" ${STROKE}/>`,
};

/** A `<span class="icon">` holding the icon, sized by its CSS. */
export function icon(name: IconName, className = ''): HTMLElement {
    const span = document.createElement('span');
    span.className = `icon${className ? ` ${className}` : ''}`;
    span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`;
    return span;
}
