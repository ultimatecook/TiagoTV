#!/usr/bin/env node
/**
 * The Android smoke run: the built app (dist/webos-lite) with the Android
 * app's bridge faked in (fake-native.js stands in for apps/androidtv's
 * NativeBridge and PlayerHost), against the same local fake panel as the
 * LG run, driven with the remote's keys. What it checks is the page's
 * side of the bridge (player/native-bridge.ts, native-media.ts): the
 * candidates' order and the one connection through the bridge, the
 * transparent backdrop, busy and stalled streams, Fluidez, the native
 * subtitle and audio tracks in the menus beside the provider's files,
 * and Back and exit as the Activity hands them over.
 *
 *   node apps/webos-lite/e2e/smoke-android.mjs [--shots <dir>] [--headed]
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACCOUNT } from './fake-catalog.mjs';
import { openHarness } from './harness.mjs';
import { toTab } from './smoke-browse.mjs';
import {
    cueText,
    openDark,
    openList,
    pick,
    trackButtons,
    trackItems,
    waitCue,
} from './smoke-tracks.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = join(ROOT, 'dist', 'webos-lite');
const FAKE_NATIVE = readFileSync(
    fileURLToPath(new URL('./fake-native.js', import.meta.url)),
    'utf8'
);

function arg(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
}

const calls = (h) => h.page.evaluate(() => window.__fakeNative.calls.slice());
const resetCalls = (h) => h.page.evaluate(() => window.__fakeNative.reset());
/** The bridge calls that open or close a stream, in order. */
const streamCalls = async (h) =>
    (await calls(h)).filter((call) => /^(play|stop|setProfile)/.test(call));
const attempts = (h) => h.page.evaluate(() => window.__tiagotv.attempts());
const waitNativePlaying = (h) =>
    h.page.waitForFunction(
        () => {
            const state = window.__fakeNative.state();
            return state.attached && !state.paused && state.time > 0.4;
        },
        null,
        { timeout: 20000 }
    );
const backdrop = (h) =>
    h.page.evaluate(() => {
        const color = (el) =>
            el ? getComputedStyle(el).backgroundColor : 'missing';
        return {
            flagged:
                document.documentElement.classList.contains('is-native-video'),
            html: color(document.documentElement),
            app: color(document.querySelector('.app')),
            shellImage: document.querySelector('.shell')
                ? getComputedStyle(document.querySelector('.shell'))
                      .backgroundImage
                : 'missing',
            stage: color(document.querySelector('.stage')),
            player: color(document.querySelector('.player')),
        };
    });

async function loginSuite(h) {
    const { page, press, check, panel } = h;
    await page.goto(pathToFileURL(join(DIST, 'index.html')).href);
    await page.waitForSelector('.setup__input.focused');
    await page.keyboard.type(panel.url.replace('http://', ''));
    await press('Enter');
    await page.keyboard.type(ACCOUNT.username);
    await press('Enter');
    await page.keyboard.type(ACCOUNT.password);
    await press('Enter');
    await page.waitForSelector('.setup__status.is-ok');
    await page.waitForSelector('.shell .tab.focused', { timeout: 5000 });
    const wired = await page.evaluate(() => ({
        video: !!document.querySelector('video'),
        events: typeof window.__tiagotvNativeEvent,
        keys: typeof window.__tiagotvNativeKey,
    }));
    check(
        'the bridge is found: no <video>, the event and key hooks installed',
        !wired.video &&
            wired.events === 'function' &&
            wired.keys === 'function',
        JSON.stringify(wired)
    );
    check(
        'the backdrop is opaque while nothing plays',
        !(await backdrop(h)).flagged
    );
}

async function liveSuite(h) {
    const { page, press, check, shot } = h;
    await toTab(h, 'home');
    if (await page.$('.dialog')) {
        // Back on Inicio asks to exit: stay.
        await press('Backspace');
    }
    check(
        'bar reaches En vivo',
        await h.pressUntil('ArrowRight', /\| En vivo$/, 6),
        await h.focused()
    );
    await press('Enter');
    await page.waitForSelector('.page--live .card--channel', {
        timeout: 20000,
    });
    await resetCalls(h);
    await press('Enter');
    await waitNativePlaying(h);
    check(
        'Más estable: HLS first (refused here), then TS',
        (await attempts(h)).slice(-2).join(' ') === 'HLS:failed TS:playing',
        (await attempts(h)).join(' ')
    );
    let list = await streamCalls(h);
    check(
        'the bridge: profile and HLS, stop, profile and TS',
        list.join(' ') ===
            'setProfile:stable play:hls:0 stop setProfile:stable play:ts:0',
        list.join(' ')
    );
    let seen = await backdrop(h);
    check(
        'the room and the stage let the native picture through',
        seen.flagged &&
            seen.html === 'rgba(0, 0, 0, 0)' &&
            seen.app === 'rgba(0, 0, 0, 0)' &&
            seen.shellImage === 'none' &&
            seen.stage === 'rgba(0, 0, 0, 0)',
        JSON.stringify(seen)
    );
    await shot('a1-en-vivo-nativo');

    await press('Enter');
    await page.waitForSelector('.player', { timeout: 5000 });
    await page.waitForTimeout(500);
    seen = await backdrop(h);
    check(
        'full screen: the same stream, the player transparent',
        (await streamCalls(h)).length === 5 &&
            seen.player === 'rgba(0, 0, 0, 0)' &&
            !!(await page.$('.player .player__video--native')),
        JSON.stringify(seen)
    );
    await press('Enter');
    await page.waitForTimeout(300);
    check(
        'the OSD raises the native subtitles',
        (await calls(h)).includes('setSubtitlesRaised:true')
    );
    await shot('a2-reproductor-nativo');

    await resetCalls(h);
    await press('PageUp');
    await waitNativePlaying(h);
    list = await streamCalls(h);
    check(
        'CH+: stop at once, then the next channel (HLS, TS)',
        list.join(' ') ===
            'stop setProfile:stable play:hls:0 stop setProfile:stable play:ts:0',
        list.join(' ')
    );

    await page.evaluate(() => window.__fakeNative.fail(458));
    await press('PageUp');
    await page.waitForFunction(
        () => /en uso en otro dispositivo/.test(document.body.innerText),
        null,
        { timeout: 25000 }
    );
    check('a stream refused with 458: the busy message', true);
    await page.evaluate(() => window.__fakeNative.fail(0));
    await press('Enter');
    await waitNativePlaying(h);
    check('OK retries after busy', true);

    await page.evaluate(() => window.__fakeNative.stall(true));
    await page.waitForFunction(
        () => /Reconectando/.test(document.body.innerText),
        null,
        { timeout: 30000 }
    );
    check('a frozen picture: the stall watch reconnects', true);
    await page.evaluate(() => window.__fakeNative.stall(false));
    await waitNativePlaying(h);
    check('after the reconnect it plays again', true);

    await page.evaluate(() =>
        localStorage.setItem('tiagotv.lite.fluidez', 'normal')
    );
    await resetCalls(h);
    await press('PageUp');
    await waitNativePlaying(h);
    list = await streamCalls(h);
    check(
        'Fluidez Normal: TS first, the normal profile',
        list.join(' ') === 'stop setProfile:normal play:ts:0',
        list.join(' ')
    );
    await page.evaluate(() =>
        localStorage.setItem('tiagotv.lite.fluidez', 'stable')
    );

    await resetCalls(h);
    await press('Backspace');
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(600);
    const kept = await page.evaluate(
        () =>
            window.__fakeNative.state().attached &&
            !!document.querySelector('.stage .player__video--native')
    );
    check(
        'Back: the stream goes on in the stage, nothing stopped',
        kept && (await streamCalls(h)).length === 0
    );
    await press('Backspace');
    await press('ArrowLeft');
    await page.waitForTimeout(800);
    check(
        'leaving En vivo stops the native player, the backdrop returns',
        (await streamCalls(h)).join(' ') === 'stop' &&
            !(await backdrop(h)).flagged,
        (await streamCalls(h)).join(' ')
    );
}

async function episodeSuite(h) {
    const { page, press, check, shot } = h;
    check("DARK's first episode", await openDark(h), await h.focused());
    await resetCalls(h);
    await press('Enter');
    await page.waitForSelector('.player', { timeout: 10000 });
    await waitNativePlaying(h);
    await page
        .waitForFunction(
            () =>
                window.__fakeNative.calls.some((call) =>
                    call.startsWith('selectSubtitle:t:')
                ),
            null,
            { timeout: 8000 }
        )
        .catch(() => undefined);
    check(
        'E1: the embedded Spanish track chosen natively on English audio',
        (await calls(h)).includes('selectSubtitle:t:1:1'),
        (await calls(h)).join(' ')
    );
    check('E1: the page draws no cue of its own', (await cueText(h)) === '');
    await press('ArrowDown');
    const shown = await trackButtons(h);
    check(
        'Down: Subtítulos: Español | Audio: Inglés',
        shown.join(' | ') === 'Subtítulos: Español | Audio: Inglés',
        shown.join(' | ')
    );
    await press('Enter');
    await page.waitForSelector('.tracks .tracks__item', { timeout: 3000 });
    const items = await trackItems(h);
    check(
        "the list: the file's tracks, then the provider's files",
        items.join(',') === 'Desactivados,Inglés,*Español,Español 2,Inglés 2',
        items.join(', ')
    );
    await shot('a3-subtitulos-nativos');
    await pick(h, 'Español 2');
    check(
        'a provider file: the native track cleared, the page draws the lines',
        (await waitCue(h, /¿Dónde está\? Línea/)) &&
            (await calls(h)).includes('selectSubtitle:'),
        await cueText(h)
    );

    await openList(h, 1);
    const tracks = await trackItems(h);
    check(
        'Audio: both tracks by language',
        tracks.join(',') === '*Inglés,Español',
        tracks.join(', ')
    );
    await pick(h, 'Español');
    await page.waitForTimeout(500);
    await press('ArrowDown');
    const after = await trackButtons(h);
    check(
        'Audio → Español: switched natively, in place',
        (await calls(h)).includes('selectAudio:a:0:1') &&
            after.join(' | ') === 'Subtítulos: Español 2 | Audio: Español',
        after.join(' | ')
    );
    check(
        'one stream for the episode',
        (await streamCalls(h))
            .filter((call) => call.startsWith('play'))
            .join(' ') === 'play:file:0',
        (await streamCalls(h)).join(' ')
    );
    await press('ArrowUp');
    await resetCalls(h);
    await press('Backspace');
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(400);
    check(
        'Back closes the player and stops the native stream',
        (await streamCalls(h)).join(' ') === 'stop',
        (await streamCalls(h)).join(' ')
    );
    await press('Backspace');
}

async function keysSuite(h) {
    const { page, press, check } = h;
    await toTab(h, 'home');
    if (await page.$('.dialog')) {
        await press('Backspace');
    }
    const taken = await page.evaluate(() => window.__tiagotvNativeKey(461));
    await page.waitForTimeout(300);
    check(
        'Back from the Activity on Inicio: taken, the exit dialog opens',
        taken === true && /Salir de TiagoTV/.test(await h.text())
    );
    check(
        'the remote reaches Salir',
        await h.pressUntil('ArrowLeft', /\| Salir$/, 3)
    );
    await resetCalls(h);
    await press('Enter');
    await page.waitForTimeout(300);
    check(
        'Salir asks the app to close',
        (await calls(h)).includes('exit') && !(await page.$('.dialog'))
    );
    check(
        'CH+ from the Activity is taken too',
        (await page.evaluate(() => window.__tiagotvNativeKey(33))) === true
    );
    check(
        'an unknown key is not',
        (await page.evaluate(() => window.__tiagotvNativeKey(999))) === false
    );
}

async function main() {
    const shots = arg(
        '--shots',
        join(ROOT, 'dist', 'webos-lite-smoke-android')
    );
    mkdirSync(shots, { recursive: true });
    if (!existsSync(join(DIST, 'index.html'))) {
        throw new Error('Build first: pnpm nx build webos-lite');
    }
    const h = await openHarness({
        shots,
        headed: process.argv.includes('--headed'),
        initScripts: [FAKE_NATIVE],
    });
    try {
        for (const suite of [loginSuite, liveSuite, episodeSuite, keysSuite]) {
            await suite(h);
        }
        h.check(
            'no page errors',
            h.errors.length === 0,
            h.errors.slice(0, 3).join(' | ')
        );
    } catch (error) {
        console.error(
            'focus:',
            await h.focusedClass().catch(() => ''),
            '|',
            await h.focused().catch(() => '')
        );
        console.error(
            'screen:',
            (await h.text().catch(() => '')).slice(0, 300).replace(/\s+/g, ' ')
        );
        console.error(
            'bridge:',
            (await calls(h).catch(() => [])).slice(-12).join(' ')
        );
        console.error('errors:', h.errors.join(' | '));
        await h.shot('failure').catch(() => undefined);
        throw error;
    } finally {
        await h.close();
    }
    const failed = h.results.filter((result) => !result.ok);
    console.log(
        `\n${h.results.length - failed.length}/${h.results.length} checks passed; screenshots in ${shots}`
    );
    if (failed.length > 0) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
