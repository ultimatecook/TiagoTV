import type { App } from './app';
import { activity, setActivity } from './core/activity';
import { imageQueueSize } from './core/image-queue';
import { actionOf, isDirection, KEY } from './core/keys';
import { nav } from './core/nav';
import { redact } from './core/redact';
import { requestLog } from './core/request-log';
import { kickRequestQueue, requestQueueSize, requestQueueState } from './core/request-queue';
import { ScreenStack } from './core/screens';
import { activeTimers } from './core/timers';
import { PlayerEngine } from './player/engine';
import { loadMpegts } from './player/mpegts';
import { installNativeBackdrop, installNativeKeys, nativeBridge } from './player/native-bridge';
import { NativeMedia } from './player/native-media';
import { PlayerScreen } from './screens/player-screen';
import { SetupScreen } from './screens/setup';
import { confirmDialog } from './ui/dialog';
import { stagePlaying } from './ui/stage';
import { startApp } from './wiring';
import { isAccountBusy } from './xtream/account';
import { TIMEOUTS, XtreamClient, type XtreamCredentials } from './xtream/client';
import { loadSource, saveSource } from './xtream/source';

/**
 * TiagoTV liviano: the TV app's start. It wires the screens (wiring.ts),
 * the remote's keys (and the Magic Remote's pointer) and the single video
 * element, or the Android app's native player in its place
 * (player/native-bridge.ts).
 */

const DESIGN_WIDTH = 1920;

interface PalmWindow {
    PalmSystem?: { platformBack?: () => void };
}

/** The Android app's bridge, injected before the page runs; null on LG. */
const bridge = nativeBridge();

/** Back on the root screen: the TV's own way out of an app. */
function exitApp(): void {
    const palm = (window as unknown as PalmWindow).PalmSystem;
    if (bridge) {
        bridge.exit();
    } else if (palm && typeof palm.platformBack === 'function') {
        palm.platformBack();
    } else {
        window.close();
    }
}

/** The layout is drawn for 1920×1080; a 720p TV scales it down. */
function fitToScreen(root: HTMLElement): void {
    const scale = (window.innerWidth || DESIGN_WIDTH) / DESIGN_WIDTH;
    root.style.transform = Math.abs(scale - 1) > 0.01 ? `scale(${scale})` : '';
}

function closestFocusable(target: EventTarget | null, scope: HTMLElement): HTMLElement | null {
    let node = target as HTMLElement | null;
    while (node && node !== scope.parentElement) {
        if (node.classList && node.classList.contains('f')) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

function boot(): void {
    const root = document.getElementById('app') as HTMLElement;
    fitToScreen(root);
    window.addEventListener('resize', () => fitToScreen(root));

    let app: App | null = null;
    const stack: ScreenStack = new ScreenStack(root, () =>
        stack.push(
            confirmDialog(stack, {
                title: '¿Salir de TiagoTV?',
                confirm: 'Salir',
                cancel: 'Cancelar',
                onConfirm: exitApp,
            })
        )
    );
    // The app's only video element: every stream plays in it. On Android
    // the native player plays instead, behind the page, and a stand-in
    // takes the element's place.
    const native = bridge ? new NativeMedia(bridge) : null;
    const video = native ? native.el : document.createElement('video');
    video.className = native ? video.className : 'player__video';
    const engine = new PlayerEngine(video, {
        loadMpegts,
        delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
        isBusy: () =>
            app ? app.client.account().then(isAccountBusy) : Promise.resolve(false),
        ...(native ? { native } : {}),
    });
    if (native) {
        (window as unknown as { __tiagotvNativeEvent: NativeMedia['handle'] }).__tiagotvNativeEvent = (event) =>
            native.handle(event);
        installNativeKeys();
        installNativeBackdrop();
    }

    const setup = (initial: XtreamCredentials | null) =>
        new SetupScreen({ initial, save: saveSource, onSaved: start });

    function start(credentials: XtreamCredentials): void {
        app = startApp(new XtreamClient(credentials), {
            stack,
            engine,
            openSetup: () => stack.push(setup(loadSource())),
            exit: exitApp,
        });
    }

    document.addEventListener(
        'keydown',
        (event) => {
            const action = actionOf(event.keyCode);
            if (!action) {
                return;
            }
            const focused = nav.focused;
            const typing =
                !!focused && focused.tagName === 'INPUT' && document.activeElement === focused;
            if (typing && (action === 'left' || action === 'right' || event.keyCode === KEY.BACKSPACE)) {
                return;
            }
            event.preventDefault();
            const top = stack.top;
            if (top && top.onKey && top.onKey(action)) {
                return;
            }
            if (action === 'back') {
                stack.back();
            } else if (isDirection(action)) {
                if (!nav.move(action) && action === 'up') {
                    nav.enterBar();
                }
            } else if (action === 'ok') {
                nav.activate();
            }
        },
        true
    );

    // The Magic Remote's pointer: hovering focuses, clicking is OK.
    root.addEventListener('mouseover', (event) => {
        const top = stack.top;
        const el = top ? closestFocusable(event.target, top.el) : null;
        if (el && el !== nav.focused) {
            nav.focus(el, true);
        }
    });
    root.addEventListener('click', (event) => {
        const top = stack.top;
        const el = top ? closestFocusable(event.target, top.el) : null;
        if (el) {
            nav.focus(el, true);
            if (el.tagName !== 'INPUT') {
                nav.activate();
            }
        }
    });

    // "fullscreen" holds the request queue and the images: it is only true
    // while the player is the screen on top, whatever closed or covered it.
    stack.onChange = () => {
        if (activity() === 'fullscreen' && !(stack.top instanceof PlayerScreen)) {
            setActivity(stagePlaying() ? 'preview' : 'idle');
        }
    };

    // Sent to the background (the TV's Home button): the stream must not
    // keep the account's only connection. Back in front, the queue goes on.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && stack.top instanceof PlayerScreen) {
            stack.pop();
        }
        if (!document.hidden) {
            stack.onChange?.();
            kickRequestQueue();
        }
    });

    // For ares-inspect and the smoke run: what runs in the background, how
    // the latest streams opened and requests went (labels only, never a URL).
    (window as unknown as { __tiagotv: object }).__tiagotv = {
        timers: activeTimers,
        activity,
        images: imageQueueSize,
        requests: requestQueueSize,
        queue: () => requestQueueState(),
        log: () => requestLog().slice(),
        // The smoke run shortens the provider's timeouts to test them.
        setTimeouts: (change: Partial<typeof TIMEOUTS>) => Object.assign(TIMEOUTS, change),
        attempts: () => engine.attempts.slice(),
        opened: () => engine.opened,
    };

    window.addEventListener('error', (event) => {
        const secrets = app ? app.client.secrets : [];
        console.error(`TiagoTV: ${redact(String(event.message), secrets)}`);
    });

    const source = loadSource();
    if (source) {
        start(source);
    } else {
        stack.reset(setup(null));
    }
}

boot();
