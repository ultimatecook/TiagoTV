import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The Home's and the platform pages' sideways rows run on through the
 * page's gutters to the content's edges on both sides: the start bleed
 * follows the page's `--rail-bleed` (its gutter) as the end bleed does, so
 * a scrolled row reaches the window's left edge with the sidebar hidden,
 * and the sidebar's edge with it shown, while the first card rests on the
 * gutter. A fixed 12px start bleed cut the cards a gutter short of it.
 */
const ROWS: ReadonlyArray<readonly [file: string, selector: string]> = [
    ['platforms/ui/platforms-rail.component.scss', '.platforms__row {'],
    ['platforms/ui/platform-row.component.scss', '.row__track {'],
    ['sports/ui/sports-rail.component.scss', '.sports__row {'],
    ['sports/ui/live-channels-rail.component.scss', '.channels__row {'],
    ['sports/ui/live-matches-rail.component.ts', '.matches__row {'],
    ['countries/ui/country-tv-row.component.scss', '.row__track {'],
];

/** The row's declarations up to its scrolling, whitespace collapsed. */
function rowGeometry(file: string, selector: string): string {
    const source = readFileSync(resolve(__dirname, file), 'utf8');
    const start = source.indexOf(selector);
    const end = source.indexOf('overflow-x: auto', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source
        .slice(start, end)
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ');
}

describe('sideways rows', () => {
    it.each(ROWS)('%s bleeds to the content edge on the left', (file, sel) => {
        const geometry = rowGeometry(file, sel);

        expect(geometry).toContain(
            '--rail-bleed-start: max(12px, var(--rail-bleed, 4px));'
        );
        expect(geometry).toMatch(/padding: [^;]* var\(--rail-bleed-start\);/);
        expect(geometry).toMatch(
            /margin: [^;]* calc\(-1 \* var\(--rail-bleed-start\)\);/
        );
        expect(geometry).toContain(
            'scroll-padding-left: var(--rail-bleed-start);'
        );
    });
});
