import { DOCUMENT } from '@angular/common';
import {
    computed,
    Directive,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { MACOS_TRAFFIC_LIGHTS_POSITION } from '@iptvnator/shared/interfaces';

/**
 * The three buttons are 14 pt circles. macOS 26 spaces them 23 pt apart
 * (60 pt in all); earlier releases 20 pt (52 pt).
 */
const LIGHTS_WIDTH = 60;
const LIGHTS_HEIGHT = 14;
/**
 * Window points from the window's left edge to where bar content may start:
 * the lights plus a gap (90 at 22pt in). It also clears the lights of a main
 * process that still places them 16pt in (they end at 76).
 */
const CLEAR_X = MACOS_TRAFFIC_LIGHTS_POSITION.x + LIGHTS_WIDTH + 8;
/** Window points from the top to where the content area may start. */
const CLEAR_Y = MACOS_TRAFFIC_LIGHTS_POSITION.y + LIGHTS_HEIGHT + 14;

/** CSS pixels from the window's top-left corner that clear the lights. */
export interface TrafficLightsClearance {
    readonly x: number;
    readonly y: number;
}

/** A fullscreen window hides the lights: there is nothing to clear. */
const FULLSCREEN_CLEARANCE: TrafficLightsClearance = { x: 0, y: 0 };

/**
 * Set on `<html>` while the window is fullscreen (the web app's
 * `startWindowChrome`, from the main process's window state).
 */
const WINDOW_FULLSCREEN_CLASS = 'window-fullscreen';

/**
 * The page zoom factor. Chromium reports the window in window pixels and the
 * viewport in CSS pixels, so their ratio is the app zoom.
 */
export function pageZoomFactor(
    view: Pick<Window, 'innerWidth' | 'outerWidth'>
): number {
    return view.innerWidth > 0 && view.outerWidth > 0
        ? view.outerWidth / view.innerWidth
        : 1;
}

/**
 * The clearance at `zoomFactor`. App zoom (`webFrame.setZoomLevel`) scales
 * CSS pixels but not the native buttons: zoomed out, the same window points
 * hold more CSS pixels.
 */
export function trafficLightsClearance(
    zoomFactor: number
): TrafficLightsClearance {
    const factor =
        Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
    return { x: CLEAR_X / factor, y: CLEAR_Y / factor };
}

/**
 * Publishes the macOS traffic-light clearance on its host as
 * `--traffic-lights-clear-x` and `--traffic-lights-clear-y`, refreshed on
 * `resize` (Chromium fires it when the zoom changes). The top bar keeps its
 * leading group clear of the lights with the first; without them (off macOS)
 * it falls back to its default layout. In fullscreen (`window-fullscreen` on `<html>`)
 * macOS hides the lights, so both are `0px`.
 */
@Directive({
    selector: '[appTrafficLightsClearance]',
    host: {
        '[style.--traffic-lights-clear-x]': 'clearX()',
        '[style.--traffic-lights-clear-y]': 'clearY()',
    },
})
export class TrafficLightsClearanceDirective {
    /** True where the native traffic lights overlay the window (macOS). */
    readonly enabled = input(false, { alias: 'appTrafficLightsClearance' });

    private readonly document = inject(DOCUMENT);
    private readonly view = this.document.defaultView;
    private readonly zoomFactor = signal(
        this.view ? pageZoomFactor(this.view) : 1
    );
    private readonly fullScreen = signal(this.isWindowFullScreen());
    private readonly clearance = computed(() => {
        if (!this.enabled()) return null;
        return this.fullScreen()
            ? FULLSCREEN_CLEARANCE
            : trafficLightsClearance(this.zoomFactor());
    });
    protected readonly clearX = computed(() => toPx(this.clearance()?.x));
    protected readonly clearY = computed(() => toPx(this.clearance()?.y));

    constructor() {
        effect((onCleanup) => {
            const view = this.view;
            if (!this.enabled() || !view) return;
            const update = () => this.zoomFactor.set(pageZoomFactor(view));
            update();
            view.addEventListener('resize', update);
            onCleanup(() => view.removeEventListener('resize', update));
        });
        effect((onCleanup) => {
            if (!this.enabled() || typeof MutationObserver === 'undefined') {
                return;
            }
            const update = () => this.fullScreen.set(this.isWindowFullScreen());
            update();
            const observer = new MutationObserver(update);
            observer.observe(this.document.documentElement, {
                attributes: true,
                attributeFilter: ['class'],
            });
            onCleanup(() => observer.disconnect());
        });
    }

    private isWindowFullScreen(): boolean {
        return this.document.documentElement.classList.contains(
            WINDOW_FULLSCREEN_CLASS
        );
    }
}

function toPx(value: number | undefined): string | null {
    return value === undefined ? null : `${value}px`;
}
