#!/usr/bin/env node
/**
 * TiagoTV liviano's smoke run: the built app (dist/webos-lite) from
 * file://, at 1920x1080, in Chromium with Chrome 53's missing built-ins
 * removed (chrome53-shim.js), against the local fake panel
 * (fake-xtream.mjs), driven only with the remote's keys: arrows, Enter
 * (OK), Backspace (Back), Page Up/Down (CH+/CH-). It never leaves the
 * machine: ESPN's standings come from a fixture, other hosts are refused.
 *
 *   node apps/webos-lite/e2e/smoke.mjs [--shots <dir>] [--headed]
 *
 * Desktop Chromium plays neither MPEG-TS nor H.264, so the panel serves a
 * WebM clip for every stream (HLS playlists fail there, as they may on a
 * provider): what the run checks is the app's side — the candidates'
 * order, one connection at a time, zapping, the OSD, Back. The resilience
 * suites (smoke-resilience.mjs) then replay what a real provider and a
 * real TV do to the catalog (slow, aborted, silent and huge answers, the
 * player opened while it loads, a second launch) and Diagnóstico.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACCOUNT } from './fake-catalog.mjs';
import { openHarness } from './harness.mjs';
import { catalogSuite, homeSuite, myListSuite, searchSuite, settingsSuite, sportsSuite } from './smoke-browse.mjs';
import { liveSuite, normalSuite } from './smoke-playback.mjs';
import { activitySuite, diagnosticsSuite, firstLoadSuite, secondLaunchSuite } from './smoke-resilience.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = join(ROOT, 'dist', 'webos-lite');

function arg(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
}

async function setupSuite(h) {
    const { page, press, check, shot, panel, text } = h;
    await page.goto(pathToFileURL(join(DIST, 'index.html')).href);
    await page.waitForSelector('.setup__input.focused');
    check('Chrome 53 shim active', await page.evaluate(() => window.__chrome53Shim === true && typeof Object.entries === 'function'));
    await shot('00-configurar');
    // A wrong password first, then the right one, typed like the
    // on-screen keyboard does and moved along with OK.
    await page.keyboard.type(panel.url.replace('http://', ''));
    await press('Enter');
    await page.keyboard.type(ACCOUNT.username);
    await press('Enter');
    await page.keyboard.type('wrong-pass');
    await press('Enter');
    await page.waitForSelector('.setup__status.is-error');
    const refused = await text();
    check('wrong password is refused', /incorrectos/.test(refused));
    check('password never shown', !refused.includes('wrong-pass') && !refused.includes(ACCOUNT.password));
    await press('ArrowUp');
    check('up from the button reaches the password', await page.evaluate(() => document.activeElement.type === 'password'));
    await page.evaluate(() => {
        document.querySelector('input[type=password]').value = '';
    });
    await page.keyboard.type(ACCOUNT.password);
    await press('Enter');
    await page.waitForSelector('.setup__status.is-ok');
    check('account summary', /Activa/.test(await text()), (await page.textContent('.setup__status')).slice(0, 80));
    await page.waitForSelector('.shell .tab.focused', { timeout: 5000 });
    check('the app opens on Inicio', (await h.focused()) === 'Inicio');
    check('the bar: the desktop\'s tabs in order', (await page.evaluate(() => [...document.querySelectorAll('.shell .tab')].map((el) => el.textContent).join(','))) === 'Inicio,Deportes,Series,Películas,En vivo,Mi lista');
}

async function exitSuite(h) {
    const { press, check, text } = h;
    await press('Backspace');
    await h.pressUntil('ArrowLeft', /\| Inicio$/, 9);
    await press('Backspace');
    check('Back on Inicio asks to exit', /Salir de TiagoTV/.test(await text()));
    await h.shot('28-salir');
    await press('Backspace');
    check('Back closes the dialog', !(await h.page.$('.dialog')));
}

async function main() {
    const shots = arg('--shots', join(ROOT, 'dist', 'webos-lite-smoke'));
    mkdirSync(shots, { recursive: true });
    if (!existsSync(join(DIST, 'index.html'))) {
        throw new Error('Build first: pnpm nx build webos-lite');
    }
    const h = await openHarness({ shots, headed: process.argv.includes('--headed') });
    try {
        for (const suite of [setupSuite, homeSuite, catalogSuite, sportsSuite, liveSuite, searchSuite, myListSuite, settingsSuite, normalSuite, activitySuite, firstLoadSuite, diagnosticsSuite, secondLaunchSuite, exitSuite]) {
            await suite(h);
        }
        h.check('no page errors', h.errors.length === 0, h.errors.slice(0, 3).join(' | '));
    } catch (error) {
        const s = await h.stats().catch(() => null);
        console.error('panel:', JSON.stringify(s && { ...s, api: s.api.length }));
        console.error('focus:', await h.focusedClass().catch(() => ''), '|', await h.focused().catch(() => ''));
        console.error('screen:', (await h.text().catch(() => '')).slice(0, 300).replace(/\s+/g, ' '));
        console.error('errors:', h.errors.join(' | '));
        await h.shot('failure').catch(() => undefined);
        throw error;
    } finally {
        await h.close();
    }
    const failed = h.results.filter((result) => !result.ok);
    console.log(`\n${h.results.length - failed.length}/${h.results.length} checks passed; screenshots in ${shots}`);
    if (failed.length > 0) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
