/**
 * The cards of "En vivo"'s row that are rendered: a country lists up to a
 * couple of thousand channels ("All" in the United States), so the row
 * draws the cards in and near its view only, a few to either side, and
 * holds the others' room. Cards are all one width (`pitch` is a card and
 * its gap), so the window follows from the row's scroll alone.
 */
export interface CardsWindow {
    /** The first card rendered. */
    readonly start: number;
    /** One past the last card rendered. */
    readonly end: number;
}

/** Cards rendered beyond each edge of the view. */
export const OVERSCAN = 4;

export interface RowGeometry {
    readonly scrollLeft: number;
    /** The row's visible width. */
    readonly width: number;
    /** The row's padding before its first card. */
    readonly padding: number;
    /** A card's width and the gap after it. */
    readonly pitch: number;
}

export function cardsWindow(
    row: RowGeometry,
    count: number,
    overscan = OVERSCAN
): CardsWindow {
    if (count <= 0 || row.pitch <= 0) {
        return { start: 0, end: 0 };
    }
    const first = Math.floor(
        Math.max(0, row.scrollLeft - row.padding) / row.pitch
    );
    const shown = Math.ceil(row.width / row.pitch) + 1;
    const start = Math.min(Math.max(0, first - overscan), count - 1);
    return { start, end: Math.min(count, first + shown + overscan) };
}

/**
 * Where the row scrolls to show card `index`: null when it is in view
 * already. `third` puts it a third of the way in (a card the page opens
 * on); `nearest` scrolls it just into view (the arrow keys).
 */
export function revealScroll(
    row: RowGeometry,
    index: number,
    mode: 'nearest' | 'third'
): number | null {
    const left = row.padding + index * row.pitch;
    const card = row.pitch;
    const viewStart = row.scrollLeft + row.padding;
    const viewEnd = row.scrollLeft + row.width - row.padding;
    if (left >= viewStart && left + card <= viewEnd + 1) {
        return null;
    }
    if (mode === 'third') {
        return Math.max(0, left - row.width / 3);
    }
    return left < viewStart
        ? Math.max(0, left - row.padding)
        : left + card - row.width + row.padding;
}
