/**
 * A banner (the catalog's hero, a platform page's hero, billboard or
 * carousel) shows a title only over a real backdrop, never its poster: an
 * image this many times wider than tall, as the Home's finder checks.
 */
const LANDSCAPE = 1.2;

/**
 * Whether the image a banner loaded is a backdrop: a provider sometimes
 * names a poster as one. One without an intrinsic size (an SVG) passes.
 */
export function loadedLandscape(event: Event): boolean {
    const image = event.target as HTMLImageElement | null;
    const width = image?.naturalWidth ?? 0;
    const height = image?.naturalHeight ?? 0;
    return width === 0 || height === 0 || width >= height * LANDSCAPE;
}
