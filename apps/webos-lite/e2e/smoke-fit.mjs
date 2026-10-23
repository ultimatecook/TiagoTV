/**
 * The fit check: the app, drawn for 1920×1080, on screens of other sizes
 * (src/core/fit.ts): a 720p stick, a 4K panel whose browser reports its
 * full width, a 16:10 screen. The canvas must fit the screen whole and
 * centred, and the focus ring must still follow the remote, on screen.
 */
import { toTab } from './smoke-browse.mjs';

const SIZES = [
    ['720p', 1280, 720],
    ['4k', 3840, 2160],
    ['16-10', 1280, 800],
];

export async function fitSuite(h) {
    const { page, press, check, shot } = h;
    await toTab(h, 'home');
    if (await page.$('.dialog')) {
        await press('Backspace');
    }
    const near = (a, b) => Math.abs(a - b) <= 2;
    for (const [name, width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(500);
        const box = await page.evaluate(() => {
            const rect = document.getElementById('app').getBoundingClientRect();
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, vw: window.innerWidth, vh: window.innerHeight };
        });
        const scale = Math.min(width / 1920, height / 1080);
        const fits =
            near(box.width, 1920 * scale) &&
            near(box.height, 1080 * scale) &&
            box.left >= -1 &&
            box.top >= -1 &&
            box.left + box.width <= width + 1 &&
            box.top + box.height <= height + 1;
        const centred = near(box.left, (width - box.width) / 2) && near(box.top, (height - box.height) / 2);
        check(`${name} (${width}×${height}): the canvas fits the screen whole, centred`, fits && centred, JSON.stringify(box));
        const before = await h.focused();
        await press('ArrowDown');
        const ring = await page.evaluate(() => {
            const el = document.querySelector('.focused');
            if (!el) {
                return null;
            }
            const rect = el.getBoundingClientRect();
            return {
                text: el.textContent.replace(/\s+/g, ' ').trim(),
                shadow: getComputedStyle(el).boxShadow,
                inside: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
            };
        });
        check(
            `${name}: the focus ring follows the remote, on screen`,
            !!ring && ring.text !== before && ring.shadow !== 'none' && ring.inside,
            JSON.stringify(ring)
        );
        await shot(`fit-${name}`);
        await press('ArrowUp');
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    check('back at 1920×1080 the canvas is drawn as it is', (await page.evaluate(() => document.getElementById('app').style.transform)) === '');
    // Leaves the focus on the hero, off the bar, as the suites before it do.
    await press('ArrowDown');
}
