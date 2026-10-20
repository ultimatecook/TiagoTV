/**
 * The smoke run's harness: the fixtures (a WebM clip every stream plays,
 * one with two audio tracks, English and Spanish, for the episodes, a
 * small H.264 TS segment for the HLS playlists), the fake panel, the
 * browser with Chrome 53's missing built-ins removed (and with
 * `audioTracks`, which webOS has and desktop Chromium keeps behind a
 * flag; in-band subtitle tracks come from inband-tracks.js), and the helpers the
 * suites drive the app with: the remote's keys only (arrows, Enter = OK,
 * Backspace = Back, Page Up/Down = CH+/CH-).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { crestSvg, espnStandings, slugOf } from './fake-espn.mjs';
import { startFakeXtream } from './fake-xtream.mjs';

const SHIM = readFileSync(fileURLToPath(new URL('./chrome53-shim.js', import.meta.url)), 'utf8');
const INBAND = readFileSync(fileURLToPath(new URL('./inband-tracks.js', import.meta.url)), 'utf8');

function chromiumPath() {
    const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
    return candidates.find((path) => existsSync(path));
}

function makeFixtures() {
    const dir = mkdtempSync(join(tmpdir(), 'tiagotv-lite-smoke-'));
    const clip = join(dir, 'clip.webm');
    const segment = join(dir, 'seg.ts');
    const dual = join(dir, 'dual.webm');
    execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
        '-t', '30', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '400k',
        '-c:a', 'libvorbis', '-f', 'webm', '-reserve_index_space', '50000', '-cues_to_front', '1', clip,
    ]);
    execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
        '-f', 'lavfi', '-i', 'sine=frequency=660:sample_rate=48000',
        '-t', '30', '-map', '0:v', '-map', '1:a', '-map', '2:a',
        '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '400k', '-c:a', 'libvorbis',
        '-metadata:s:a:0', 'language=eng', '-metadata:s:a:1', 'language=spa',
        '-f', 'webm', '-reserve_index_space', '50000', '-cues_to_front', '1', dual,
    ]);
    execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=25',
        '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-f', 'mpegts', segment,
    ]);
    return { dir, clip, segment, dual };
}

export async function openHarness({ shots, headed = false }) {
    const fixtures = makeFixtures();
    const panel = await startFakeXtream({ media: fixtures.clip, segment: fixtures.segment, episodeMedia: fixtures.dual });
    const browser = await chromium.launch({
        executablePath: chromiumPath(),
        headless: !headed,
        args: ['--autoplay-policy=no-user-gesture-required', '--enable-blink-features=AudioVideoTracks'],
    });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Resource errors are expected (a dead logo, refused streams); script errors are not.
    page.on('console', (message) => {
        if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
            errors.push(message.text());
        }
    });
    await page.addInitScript(SHIM);
    await page.addInitScript(INBAND);
    // Nothing leaves the machine: ESPN's standings and its team logos (the
    // crests) come from fixtures; every other outside request (TheSportsDB,
    // the player cut-outs) is refused, as an unreachable host would be.
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
        const url = route.request().url();
        if (url.includes('site.api.espn.com')) {
            return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(espnStandings(slugOf(url))) });
        }
        if (url.includes('a.espncdn.com')) {
            return route.fulfill({ contentType: 'image/svg+xml', body: crestSvg(url) });
        }
        return route.abort();
    });

    const results = [];
    const check = (name, ok, detail = '') => {
        results.push({ name, ok, detail });
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const press = async (key, times = 1) => {
        for (let i = 0; i < times; i++) {
            await page.keyboard.press(key);
            await page.waitForTimeout(150);
        }
        await page.waitForTimeout(280);
    };
    const focused = () =>
        page.evaluate(() => {
            const el = document.querySelector('.focused');
            return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
        });
    const focusedClass = () => page.evaluate(() => (document.querySelector('.focused') || {}).className || '');
    const text = () => page.evaluate(() => document.body.innerText);
    const stats = async () => (await fetch(`${panel.url}/__stats`)).json();
    const streamsSince = async (from) => (await stats()).streams.slice(from);
    const waitPlaying = () =>
        page.waitForFunction(
            () => {
                const video = document.querySelector('video');
                return !!video && video.currentTime > 0.4 && !video.paused;
            },
            null,
            { timeout: 20000 }
        );
    const tv = () =>
        page.evaluate(() => ({
            timers: window.__tiagotv.timers(),
            activity: window.__tiagotv.activity(),
            attempts: window.__tiagotv.attempts(),
        }));
    const shot = (name) => page.screenshot({ path: join(shots, `${name}.png`) });
    /** Presses `key` until focus matches `test` (a regex on its text or class). */
    const pressUntil = async (key, test, max = 12) => {
        for (let i = 0; i < max; i++) {
            const label = `${await focusedClass()} | ${await focused()}`;
            if (test.test(label)) {
                return true;
            }
            await press(key);
        }
        return test.test(`${await focusedClass()} | ${await focused()}`);
    };

    return {
        page,
        panel,
        errors,
        results,
        check,
        press,
        pressUntil,
        focused,
        focusedClass,
        text,
        stats,
        streamsSince,
        waitPlaying,
        tv,
        shot,
        async close() {
            await browser.close();
            await panel.close();
            rmSync(fixtures.dir, { recursive: true, force: true });
        },
    };
}
