import { Page } from '@playwright/test';
import {
    addXtreamPortal,
    closeElectronApp,
    expect,
    goToDashboard,
    launchElectronApp,
    resetMockServers,
    test,
    waitForXtreamWorkspaceReady,
} from './electron-test-fixtures';

/**
 * The pointer below the hero: it bleeds up behind the top bar, so the
 * window's top corner is over it (and hovering it pauses the rotation).
 */
async function moveOffHero(page: Page): Promise<void> {
    const height = page.viewportSize()?.height ?? 800;
    await page.mouse.move(1, height - 2);
}

/** Index of the dot marked `aria-current`, i.e. the slide on screen. */
async function activeDotIndex(page: Page): Promise<number> {
    return page
        .getByTestId('dashboard-hero-dot')
        .evaluateAll((dots) =>
            dots.findIndex((dot) => dot.getAttribute('aria-current') === 'true')
        );
}

test.describe('Dashboard hero rotation', () => {
    // The unit tests dispatch `animationend` by hand. This drives the real
    // CSS timer animation of the active indicator, whose `animationend`
    // must reach the span's handler.
    test('advances when the indicator timer ends and holds while hovered', async ({
        dataDir,
        request,
    }) => {
        await resetMockServers(request, ['xtream']);
        const app = await launchElectronApp(dataDir);
        const page = app.mainWindow;

        try {
            // Xtream "recently added" titles alone give the hero several slides.
            await addXtreamPortal(page);
            await waitForXtreamWorkspaceReady(page);
            await goToDashboard(page);

            const hero = page.getByTestId('dashboard-hero');
            await expect(hero).toBeVisible();
            await expect
                .poll(() => page.getByTestId('dashboard-hero-dot').count())
                .toBeGreaterThanOrEqual(2);
            // Keep the pointer off the hero: hovering it pauses the rotation.
            await moveOffHero(page);
            // A short interval so the test does not wait out 6 s per slide.
            await hero.evaluate((element) =>
                (element as HTMLElement).style.setProperty(
                    '--hero-rotation-ms',
                    '600ms'
                )
            );

            const first = await activeDotIndex(page);
            expect(first).toBeGreaterThanOrEqual(0);
            await expect
                .poll(() => activeDotIndex(page), { timeout: 10_000 })
                .not.toBe(first);

            // The pointer inside the hero holds the slide.
            await hero.hover();
            const paused = await activeDotIndex(page);
            // Several intervals: a running timer would have advanced by now.
            await page.waitForTimeout(2_000);
            expect(await activeDotIndex(page)).toBe(paused);

            await moveOffHero(page);
            await expect
                .poll(() => activeDotIndex(page), { timeout: 10_000 })
                .not.toBe(paused);
        } finally {
            await closeElectronApp(app);
        }
    });
});
