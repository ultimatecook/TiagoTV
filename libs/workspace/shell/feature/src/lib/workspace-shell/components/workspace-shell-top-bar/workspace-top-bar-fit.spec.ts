import {
    initialWorkspaceTopBarDensity,
    readWorkspaceTopBarWidths,
    resolveWorkspaceTopBarDensity,
    workspaceTopBarCapsuleWidth,
    WorkspaceTopBarWidths,
} from './workspace-top-bar-fit';

/**
 * The bar as measured in Chromium at 100 % (CSS px): the six Spanish tabs
 * (319px of labels), 22px of leading padding, 46px circles 14px apart.
 */
function widths(overrides: Partial<WorkspaceTopBarWidths> = {}) {
    return {
        bar: 900,
        padStart: 22,
        // The lights' room: the clearance (90) less the padding.
        leading: 68,
        // Buscar, Ajustes and the profile circle.
        trailing: 172,
        trailingSearchOpen: 326,
        searchOpen: false,
        labels: 319,
        tabCount: 6,
        tabGaps: 20,
        capsuleChrome: 12,
        ...overrides,
    } satisfies WorkspaceTopBarWidths;
}

describe('workspace top bar fit', () => {
    it('sizes the capsule from its labels at each spacing', () => {
        expect(workspaceTopBarCapsuleWidth(widths(), 'regular')).toBe(591);
        expect(workspaceTopBarCapsuleWidth(widths(), 'compact')).toBe(495);
    });

    it('keeps the full spacing on a wide window where everything fits', () => {
        expect(
            resolveWorkspaceTopBarDensity(widths({ bar: 1556 }), 1600)
        ).toBe('regular');
    });

    it('takes the compact spacing below 1180px, and where the full one does not fit', () => {
        expect(
            resolveWorkspaceTopBarDensity(widths({ bar: 1072 }), 1100)
        ).toBe('compact');
        // Wide, but seven circles and Back beside the full capsule.
        expect(
            resolveWorkspaceTopBarDensity(
                widths({ bar: 1180, leading: 114, trailing: 412 }),
                1180
            )
        ).toBe('compact');
    });

    // The audit's collisions: 900 CSS px wide (100 % at 900pt), a channel
    // list with the lights, Back, the page's two circles, the downloads
    // circle, Buscar, Ajustes and the profile.
    it('takes two rows only when even the compact row does not fit', () => {
        expect(resolveWorkspaceTopBarDensity(widths(), 900)).toBe('compact');
        expect(
            resolveWorkspaceTopBarDensity(
                widths({ leading: 114, trailing: 292 }),
                900
            )
        ).toBe('stacked');
        // 110 % at 900pt: 818 CSS px.
        expect(
            resolveWorkspaceTopBarDensity(widths({ bar: 818 }), 818)
        ).toBe('compact');
        expect(
            resolveWorkspaceTopBarDensity(
                widths({ bar: 818, leading: 114 }),
                818
            )
        ).toBe('stacked');
    });

    it('always takes two rows at 760px and below', () => {
        expect(
            resolveWorkspaceTopBarDensity(widths({ bar: 2000 }), 760)
        ).toBe('stacked');
        expect(initialWorkspaceTopBarDensity(390)).toBe('stacked');
        expect(initialWorkspaceTopBarDensity(1024)).toBe('compact');
        expect(initialWorkspaceTopBarDensity(1440)).toBe('regular');
    });

    it('lets the capsule scroll beside an open search field before it stacks', () => {
        const open = widths({ searchOpen: true });
        // The folded row fits; with the field open the capsule keeps 160px.
        expect(resolveWorkspaceTopBarDensity(open, 900)).toBe('compact');
        // A field that leaves the capsule less than that takes two rows.
        expect(
            resolveWorkspaceTopBarDensity(
                { ...open, trailingSearchOpen: 620 },
                900
            )
        ).toBe('stacked');
    });

    it('measures nothing before the bar has a layout', () => {
        const host = document.createElement('div');
        host.innerHTML = `
            <div class="topbar__group--leading"></div>
            <nav class="topbar__tabs"><div class="topbar__tabs-track"></div></nav>
            <div class="topbar__group--trailing"></div>`;
        document.body.append(host);

        // jsdom lays nothing out: the bar is 0px wide.
        expect(readWorkspaceTopBarWidths(host)).toBeNull();
        host.remove();
    });
});
