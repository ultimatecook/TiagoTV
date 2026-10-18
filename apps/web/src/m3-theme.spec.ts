import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A custom property that reads another one is resolved where it is declared,
// so a token derived from a per-theme colour has to be declared again inside
// `.dark-theme`; inherited from `html`, it would keep the light value there.
const THEME = readFileSync(
    resolve(process.cwd(), 'apps/web/src/m3-theme.scss'),
    'utf8'
)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');

/** The body of the brace block that opens at `start` (an index of `{`). */
function block(source: string, start: number): string {
    let depth = 0;
    for (let index = start; index < source.length; index++) {
        if (source[index] === '{') depth++;
        if (source[index] === '}' && --depth === 0) {
            return source.slice(start + 1, index);
        }
    }
    throw new Error('Unbalanced braces in m3-theme.scss');
}

/** Light declarations (the `html` block minus `.dark-theme`) and dark ones. */
function themeContexts(): { light: string; dark: string } {
    const darkStart = THEME.indexOf('.dark-theme {');
    const htmlStart = THEME.lastIndexOf('html {', darkStart);
    expect(darkStart).toBeGreaterThan(-1);
    expect(htmlStart).toBeGreaterThan(-1);

    const html = block(THEME, THEME.indexOf('{', htmlStart));
    const dark = block(THEME, THEME.indexOf('{', darkStart));
    return { light: html.replace(dark, ''), dark };
}

describe('m3-theme watch-progress token', () => {
    // Light progress follows the selection colour; TiagoTV's dark theme
    // draws it in the brand red, as streaming apps do.
    it('declares --app-progress-color in both themes', () => {
        const { light, dark } = themeContexts();
        const selection = /--app-selection-color:\s*#[0-9a-f]{6};/i;

        for (const context of [light, dark]) {
            expect(context).toMatch(selection);
        }
        expect(light).toMatch(
            /--app-progress-color:\s*var\(--app-selection-color\);/
        );
        expect(dark).toMatch(/--app-progress-color:\s*var\(--app-brand-red\);/);
        expect(light.match(selection)?.[0]).not.toBe(
            dark.match(selection)?.[0]
        );
    });
});

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((start) => {
        const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}

/** `top` at `percent`% over an opaque `base`, as color-mix(in srgb) does. */
function mix(top: string, percent: number, base: string): string {
    return `#${[1, 3, 5]
        .map((start) => {
            const over = parseInt(top.slice(start, start + 2), 16);
            const under = parseInt(base.slice(start, start + 2), 16);
            return Math.round((over * percent + under * (100 - percent)) / 100)
                .toString(16)
                .padStart(2, '0');
        })
        .join('')}`;
}

function hexToken(context: string, name: string): string {
    const value = new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(
        context
    )?.[1];
    expect(value).toBeDefined();
    return (value ?? '').toLowerCase();
}

/**
 * The strong selection surface as a colour over a percentage: a
 * color-mix of the selection colour, or (on the dark glass) a
 * translucent rgba() overlay.
 */
function strongSelection(
    context: string,
    selection: string
): { color: string; percent: number } {
    const mixed =
        /--app-selection-surface-strong:\s*color-mix\(\s*in srgb,\s*var\(--app-selection-color\)\s*(\d+)%/.exec(
            context
        );
    if (mixed) {
        return { color: selection, percent: Number(mixed[1]) };
    }
    return (
        rgbaToken(context, '--app-selection-surface-strong') ?? {
            color: selection,
            percent: Number.NaN,
        }
    );
}

/** An rgba() token as its colour and its opacity in percent. */
function rgbaToken(
    context: string,
    name: string
): { color: string; percent: number } | null {
    const rgba = new RegExp(
        `${name}:\\s*rgba\\(\\s*(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\s*\\)`
    ).exec(context);
    if (!rgba) {
        return null;
    }
    const color = `#${[rgba[1], rgba[2], rgba[3]]
        .map((channel) => Number(channel).toString(16).padStart(2, '0'))
        .join('')}`;
    return { color, percent: Number(rgba[4]) * 100 };
}

/**
 * A surface as the opaque colour it shows: the dark glass leaves the rail
 * and header transparent over the shell, and lays hover overlays on the
 * content.
 */
function surfaceColor(context: string, name: string): string {
    if (new RegExp(`${name}:\\s*transparent;`).test(context)) {
        return hexToken(context, '--app-shell-bg');
    }
    const overlay = rgbaToken(context, name);
    if (overlay) {
        return mix(
            overlay.color,
            overlay.percent,
            hexToken(context, '--app-content-bg')
        );
    }
    return hexToken(context, name);
}

describe('m3-theme focus ring token', () => {
    // The ring sits 2px outside the focused element, on whatever the element
    // sits on: an app surface, or one tinted by the selection colour.
    const surfaces = [
        '--app-shell-bg',
        '--app-rail-bg',
        '--app-header-bg',
        '--app-content-bg',
        '--app-widget-bg',
        '--app-widget-header-bg',
        '--app-card-hover-bg',
    ];

    it('declares a ring with at least 3:1 on every surface in both themes', () => {
        const { light, dark } = themeContexts();

        for (const [theme, context] of Object.entries({ light, dark })) {
            const ring = hexToken(context, '--app-focus-ring');
            const selection = hexToken(context, '--app-selection-color');
            const strong = strongSelection(context, selection);
            expect(strong.percent).toBeGreaterThan(0);

            for (const surface of surfaces) {
                const base = surfaceColor(context, surface);
                for (const background of [
                    base,
                    mix(strong.color, strong.percent, base),
                ]) {
                    expect({
                        theme,
                        surface,
                        background,
                        ratio: contrast(ring, background) >= 3,
                    }).toEqual({ theme, surface, background, ratio: true });
                }
            }
        }
    });
});
