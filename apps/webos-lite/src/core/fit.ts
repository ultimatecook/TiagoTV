/**
 * The layout is drawn for 1920×1080 (every size in the stylesheets is a
 * pixel of that canvas); the screen scales it to fit, whole and centred:
 * a 720p stick shows it smaller, a 4K panel whose browser reports its
 * full width larger, and a screen of another shape (16:10, a projector's
 * odd mode) gets it letterboxed, nothing cut. The LG TV and the Android
 * WebView (its viewport meta, PageViewport) report 1920×1080 and draw it
 * as is.
 */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/** The transform that fits the canvas into `width`×`height`, or '' when it fits as it is. */
export function fitTransform(width: number, height: number): string {
    const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    if (!(scale > 0) || !isFinite(scale)) {
        return '';
    }
    const left = Math.round((width - DESIGN_WIDTH * scale) / 2);
    const top = Math.round((height - DESIGN_HEIGHT * scale) / 2);
    if (Math.abs(scale - 1) < 0.001 && left === 0 && top === 0) {
        return '';
    }
    return `translate(${left}px, ${top}px) scale(${Math.round(scale * 10000) / 10000})`;
}

/** Fits `root` now and whenever the screen changes: a resize, a turn, another pixel density. */
export function installFit(root: HTMLElement): void {
    const fit = () => {
        root.style.transform = fitTransform(window.innerWidth || DESIGN_WIDTH, window.innerHeight || DESIGN_HEIGHT);
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    // A density change (a 4K panel switching modes) fires no resize on
    // every engine: watch the density too, one query at a time.
    const watchDensity = () => {
        if (typeof window.matchMedia !== 'function') {
            return;
        }
        const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        const onChange = () => {
            query.removeListener(onChange);
            fit();
            watchDensity();
        };
        query.addListener(onChange);
    };
    watchDensity();
}
