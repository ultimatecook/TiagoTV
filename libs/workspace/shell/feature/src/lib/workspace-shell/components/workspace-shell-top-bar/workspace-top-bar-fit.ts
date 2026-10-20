/**
 * How the top bar lays out: one row with the full spacing, one row with the
 * compact spacing (narrower tabs and gaps), or two rows (the circles beside
 * Back, then the capsule).
 */
export type WorkspaceTopBarDensity = 'regular' | 'compact' | 'stacked';

/**
 * Each one-row density's tab padding, gap between the bar's three groups
 * and trailing padding (CSS px): the bar's `--topbar-tab-pad`,
 * `--topbar-gap` and `--topbar-pad-end`. The leading padding stays (the
 * lights' room is measured from it).
 */
export const WORKSPACE_TOP_BAR_SPACING = {
    regular: { tabPad: 20, gap: 32, padEnd: 28 },
    compact: { tabPad: 12, gap: 16, padEnd: 20 },
} as const;

/** Viewports narrower than this (CSS px) always take the compact spacing. */
export const WORKSPACE_TOP_BAR_COMPACT_BELOW = 1180;
/** Viewports this wide or narrower (CSS px) always take two rows. */
export const WORKSPACE_TOP_BAR_STACKED_MAX = 760;
/**
 * While Buscar's field is open the capsule may scroll down to this width
 * before the bar takes two rows.
 */
export const WORKSPACE_TOP_BAR_MIN_CAPSULE = 160;

/** What the bar holds, measured in CSS px; see `readWorkspaceTopBarWidths`. */
export interface WorkspaceTopBarWidths {
    /** The bar's border box. */
    readonly bar: number;
    /** Its leading padding. */
    readonly padStart: number;
    /** The leading group (lights' room, Back or "‹ Deportes"). */
    readonly leading: number;
    /** The trailing group with Buscar folded into its circle. */
    readonly trailing: number;
    /** The trailing group with Buscar's field open at its least width. */
    readonly trailingSearchOpen: number;
    readonly searchOpen: boolean;
    /** The tab labels together, without their padding. */
    readonly labels: number;
    readonly tabCount: number;
    /** The gaps between the tabs. */
    readonly tabGaps: number;
    /** The capsule's own padding and border. */
    readonly capsuleChrome: number;
}

/** The capsule's width with every tab showing, at a one-row density. */
export function workspaceTopBarCapsuleWidth(
    widths: WorkspaceTopBarWidths,
    density: 'regular' | 'compact'
): number {
    const { tabPad } = WORKSPACE_TOP_BAR_SPACING[density];
    return (
        widths.capsuleChrome +
        widths.labels +
        widths.tabCount * 2 * tabPad +
        widths.tabGaps
    );
}

/**
 * The density that fits: the full spacing on a wide window (at least
 * `WORKSPACE_TOP_BAR_COMPACT_BELOW`) when every tab shows beside the groups,
 * else the compact one when that fits, else two rows. With Buscar's field
 * open the capsule may scroll (the field never decides on its own that the
 * bar takes two rows) as long as it keeps `WORKSPACE_TOP_BAR_MIN_CAPSULE`.
 * Every measure is the same in each density, so a change of density never
 * changes the answer.
 */
export function resolveWorkspaceTopBarDensity(
    widths: WorkspaceTopBarWidths,
    viewportWidth: number
): WorkspaceTopBarDensity {
    if (viewportWidth <= WORKSPACE_TOP_BAR_STACKED_MAX) {
        return 'stacked';
    }
    const fits = (density: 'regular' | 'compact'): boolean => {
        const { gap, padEnd } = WORKSPACE_TOP_BAR_SPACING[density];
        const sides = widths.padStart + widths.leading + padEnd;
        const gaps = 2 * gap;
        const capsule = workspaceTopBarCapsuleWidth(widths, density);
        const folded = sides + gaps + widths.trailing + capsule;
        const open =
            sides +
            gaps +
            widths.trailingSearchOpen +
            Math.min(capsule, WORKSPACE_TOP_BAR_MIN_CAPSULE);
        return (
            folded <= widths.bar + 0.5 &&
            (!widths.searchOpen || open <= widths.bar + 0.5)
        );
    };
    if (viewportWidth >= WORKSPACE_TOP_BAR_COMPACT_BELOW && fits('regular')) {
        return 'regular';
    }
    return fits('compact') ? 'compact' : 'stacked';
}

/** The density to start with, before the bar is measured. */
export function initialWorkspaceTopBarDensity(
    viewportWidth: number
): WorkspaceTopBarDensity {
    if (viewportWidth <= WORKSPACE_TOP_BAR_STACKED_MAX) {
        return 'stacked';
    }
    return viewportWidth < WORKSPACE_TOP_BAR_COMPACT_BELOW
        ? 'compact'
        : 'regular';
}

/**
 * Measures the bar's parts as the density decision reads them. Null while
 * the bar has no layout (detached, hidden, a test DOM).
 */
export function readWorkspaceTopBarWidths(
    host: HTMLElement
): WorkspaceTopBarWidths | null {
    const view = host.ownerDocument.defaultView;
    const leading = host.querySelector<HTMLElement>('.topbar__group--leading');
    const trailing = host.querySelector<HTMLElement>(
        '.topbar__group--trailing'
    );
    const capsule = host.querySelector<HTMLElement>('.topbar__tabs');
    const track = capsule?.querySelector<HTMLElement>('.topbar__tabs-track');
    const tabs = Array.from(
        capsule?.querySelectorAll<HTMLElement>('.topbar__tab') ?? []
    );
    const bar = host.getBoundingClientRect().width;
    if (!view || !leading || !trailing || !capsule || !track || bar <= 0) {
        return null;
    }
    const px = (value: string) => parseFloat(value) || 0;
    const style = (element: Element) => view.getComputedStyle(element);
    const hostStyle = style(host);
    const capsuleStyle = style(capsule);
    const tabStyle = tabs[0] ? style(tabs[0]) : null;
    const tabPadding = tabStyle
        ? px(tabStyle.paddingLeft) + px(tabStyle.paddingRight)
        : 0;
    const search = trailing.querySelector<HTMLElement>('.topbar__search');
    const searchOpen = !!search?.classList.contains('is-open');
    const circle = trailing.querySelector<HTMLElement>('.topbar__circle');
    const circleWidth = circle?.getBoundingClientRect().width ?? 0;
    const searchMin = search ? px(style(search).minWidth) : 0;
    const groupWidth = (searchWidth: number) =>
        contentWidth(trailing, view, (child) =>
            child === search ? searchWidth : null
        );
    return {
        bar,
        padStart: px(hostStyle.paddingLeft),
        leading: leading.getBoundingClientRect().width,
        trailing: groupWidth(circleWidth),
        trailingSearchOpen: groupWidth(searchMin),
        searchOpen,
        labels: tabs.reduce(
            (sum, tab) => sum + tab.getBoundingClientRect().width - tabPadding,
            0
        ),
        tabCount: tabs.length,
        tabGaps: Math.max(0, tabs.length - 1) * px(style(track).columnGap),
        capsuleChrome:
            px(capsuleStyle.paddingLeft) +
            px(capsuleStyle.paddingRight) +
            px(capsuleStyle.borderLeftWidth) +
            px(capsuleStyle.borderRightWidth),
    };
}

/**
 * A flex row's content: its shown children, their margins and the gaps
 * between them. `override` swaps a child's width (Buscar folded or open).
 */
function contentWidth(
    group: HTMLElement,
    view: Window,
    override: (child: HTMLElement) => number | null
): number {
    const children = Array.from(group.children).filter(
        (child): child is HTMLElement =>
            child instanceof HTMLElement &&
            child.getBoundingClientRect().width > 0
    );
    const gap = parseFloat(view.getComputedStyle(group).columnGap) || 0;
    return children.reduce((sum, child, index) => {
        const style = view.getComputedStyle(child);
        const width = override(child) ?? child.getBoundingClientRect().width;
        const margins =
            (parseFloat(style.marginLeft) || 0) +
            (parseFloat(style.marginRight) || 0);
        return sum + width + margins + (index > 0 ? gap : 0);
    }, 0);
}
