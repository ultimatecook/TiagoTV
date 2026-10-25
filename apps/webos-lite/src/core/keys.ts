/**
 * The LG remote's keys (webOS sends key codes; `key` is unreliable on
 * Chrome 53 TVs), plus their desktop equivalents for testing in a browser:
 * arrows, Enter, Backspace/Escape as Back, Page Up/Down as channel keys.
 */
export type Action =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'ok'
    | 'back'
    | 'play'
    | 'pause'
    | 'playPause'
    | 'stop'
    | 'channelUp'
    | 'channelDown'
    | 'forward'
    | 'rewind'
    | 'info';

export const KEY = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACKSPACE: 8,
    ESCAPE: 27,
    BACK: 461,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    PLAY: 415,
    PAUSE: 19,
    PLAY_PAUSE: 179,
    STOP: 413,
    FORWARD: 417,
    REWIND: 412,
    INFO: 457,
} as const;

const ACTIONS: Readonly<Record<number, Action>> = {
    [KEY.LEFT]: 'left',
    [KEY.UP]: 'up',
    [KEY.RIGHT]: 'right',
    [KEY.DOWN]: 'down',
    [KEY.ENTER]: 'ok',
    [KEY.BACK]: 'back',
    [KEY.BACKSPACE]: 'back',
    [KEY.ESCAPE]: 'back',
    [KEY.PAGE_UP]: 'channelUp',
    [KEY.PAGE_DOWN]: 'channelDown',
    [KEY.PLAY]: 'play',
    [KEY.PAUSE]: 'pause',
    [KEY.PLAY_PAUSE]: 'playPause',
    [KEY.STOP]: 'stop',
    [KEY.FORWARD]: 'forward',
    [KEY.REWIND]: 'rewind',
    [KEY.INFO]: 'info',
};

export function actionOf(keyCode: number): Action | null {
    return ACTIONS[keyCode] ?? null;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export function isDirection(action: Action): action is Direction {
    return (
        action === 'up' ||
        action === 'down' ||
        action === 'left' ||
        action === 'right'
    );
}
