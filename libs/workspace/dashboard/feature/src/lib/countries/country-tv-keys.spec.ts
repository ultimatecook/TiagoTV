import { liveKeyAction, onLivePage } from './country-tv-keys';

function press(
    key: string,
    target: EventTarget = document.body,
    init: KeyboardEventInit = {}
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    Object.defineProperty(event, 'target', { value: target });
    return event;
}

describe('liveKeyAction', () => {
    it('maps the remote’s keys', () => {
        expect(liveKeyAction(press(' '))).toBe('play');
        expect(liveKeyAction(press('k'))).toBe('play');
        expect(liveKeyAction(press('M'))).toBe('mute');
        expect(liveKeyAction(press('f'))).toBe('fullscreen');
        expect(liveKeyAction(press('ArrowDown'))).toBe('cards');
        expect(liveKeyAction(press('Escape'))).toBe('collapse');
        expect(liveKeyAction(press('a'))).toBeNull();
    });

    it('leaves a focused control its own keys, but not Esc', () => {
        const button = document.createElement('button');
        expect(liveKeyAction(press(' ', button))).toBeNull();
        expect(liveKeyAction(press('ArrowLeft', button))).toBeNull();
        expect(liveKeyAction(press('Escape', button))).toBe('collapse');
        const field = document.createElement('input');
        expect(liveKeyAction(press('f', field))).toBeNull();
    });

    it('leaves modified keys and handled keys alone', () => {
        expect(
            liveKeyAction(press('f', document.body, { metaKey: true }))
        ).toBe(null);
        const handled = press('k');
        handled.preventDefault();
        expect(liveKeyAction(handled)).toBeNull();
    });
});

describe('onLivePage', () => {
    it('takes keys on the page or on nothing in particular', () => {
        const page = document.createElement('section');
        const card = document.createElement('button');
        page.appendChild(card);
        document.body.appendChild(page);
        const elsewhere = document.createElement('input');
        document.body.appendChild(elsewhere);

        expect(onLivePage(press('k', document.body), page)).toBe(true);
        expect(onLivePage(press('k', card), page)).toBe(true);
        expect(onLivePage(press('k', elsewhere), page)).toBe(false);

        page.setAttribute('inert', '');
        expect(onLivePage(press('k', card), page)).toBe(false);
        page.remove();
        elsewhere.remove();
    });
});
