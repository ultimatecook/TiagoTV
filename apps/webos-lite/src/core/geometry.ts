import type { Direction } from './keys';

/**
 * The spatial navigation's geometry, without the DOM: which element an
 * arrow key leads to, and how a row of cards scrolls and which of its
 * cards it renders.
 */
export interface Rect {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export interface Candidate<T> {
    readonly rect: Rect;
    readonly item: T;
}

/** Scaling a focused card (1.06) must not hide its neighbours. */
const TOLERANCE = 12;
/** Being out of line costs more than being far. */
const CROSS_WEIGHT = 2;

const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;
const centerX = (r: Rect) => r.left + r.width / 2;
const centerY = (r: Rect) => r.top + r.height / 2;

/** How far `to` lies in `direction` from `from`, or null if it does not. */
function primaryDistance(from: Rect, to: Rect, direction: Direction): number | null {
    let gap: number;
    switch (direction) {
        case 'right':
            gap = to.left - right(from);
            break;
        case 'left':
            gap = from.left - right(to);
            break;
        case 'down':
            gap = to.top - bottom(from);
            break;
        default:
            gap = from.top - bottom(to);
    }
    return gap >= -TOLERANCE ? Math.max(0, gap) : null;
}

/** How far out of line `to` is; zero while the two overlap across. */
function crossDistance(from: Rect, to: Rect, direction: Direction): number {
    const horizontal = direction === 'left' || direction === 'right';
    const [a1, a2, b1, b2] = horizontal
        ? [from.top, bottom(from), to.top, bottom(to)]
        : [from.left, right(from), to.left, right(to)];
    if (b2 > a1 && b1 < a2) {
        // Overlapping: still prefer the one most in line.
        const offset = horizontal
            ? Math.abs(centerY(to) - centerY(from))
            : Math.abs(centerX(to) - centerX(from));
        return offset / 10;
    }
    return b1 >= a2 ? b1 - a2 : a1 - b2;
}

export function bestCandidate<T>(
    from: Rect,
    candidates: readonly Candidate<T>[],
    direction: Direction
): T | null {
    let best: T | null = null;
    let bestScore = Infinity;
    for (const candidate of candidates) {
        const primary = primaryDistance(from, candidate.rect, direction);
        if (primary === null) {
            continue;
        }
        const score =
            primary + CROSS_WEIGHT * crossDistance(from, candidate.rect, direction);
        if (score < bestScore) {
            bestScore = score;
            best = candidate.item;
        }
    }
    return best;
}

/** Horizontal geometry of a row of equal cards. */
export interface RowMetrics {
    readonly count: number;
    /** Card width plus the margin to the next one. */
    readonly pitch: number;
    readonly viewport: number;
}

/**
 * The row's scroll with card `index` focused: the card before it stays in
 * view (to show there is more), and the row never scrolls past its end.
 */
export function rowScroll(index: number, metrics: RowMetrics, lead = 1): number {
    const { count, pitch, viewport } = metrics;
    const max = Math.max(0, count * pitch - viewport);
    const wanted = Math.max(0, index - lead) * pitch;
    return Math.min(max, wanted);
}

/** The cards to render at `scroll`, with a few spare on each side. */
export function renderWindow(
    scroll: number,
    metrics: RowMetrics,
    spare = 3
): { start: number; end: number } {
    const { count, pitch, viewport } = metrics;
    if (count === 0) {
        return { start: 0, end: 0 };
    }
    const first = Math.floor(scroll / pitch);
    const visible = Math.ceil(viewport / pitch) + 1;
    return {
        start: Math.max(0, first - spare),
        end: Math.min(count, first + visible + spare),
    };
}

/** The card under a horizontal position, for entering a row from above. */
export function indexAt(x: number, scroll: number, pitch: number, count: number): number {
    if (count === 0) {
        return 0;
    }
    const index = Math.floor((x + scroll) / pitch);
    return Math.max(0, Math.min(count - 1, index));
}
