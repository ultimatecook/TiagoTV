/**
 * The smoke run's resilience suites: what differs between the fake panel
 * and a real provider on a real TV.
 *
 *   activitySuite    every way out of the player leaves the activity at
 *                    idle (or preview, back on En vivo's stage), so the
 *                    request queue and the images never stay paused;
 *   firstLoadSuite   a "first launch" of the catalog against a panel that
 *                    misbehaves: a category slower than 0.2.1's 30 s
 *                    timeout, one webOS aborts, a live one that never
 *                    answers (no event at all), a list of megabytes, and
 *                    the player opened and closed while it all loads;
 *                    Top 10 and Series para ti fill early all the same;
 *   diagnosticsSuite Ajustes → Diagnóstico lists the requests, without
 *                    the account's user or password;
 *   secondLaunchSuite the next start shows the kept catalog at once and
 *                    asks the panel for none of it (it is not 12 h old).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACCOUNT } from './fake-catalog.mjs';

const FAULTS = readFileSync(fileURLToPath(new URL('./xhr-faults.js', import.meta.url)), 'utf8');
const SLOW_CATEGORY = '2370';
const SLOW_MS = 32000;

const panelCall = (h, path) => fetch(`${h.panel.url}${path}`).then((response) => response.json());
const activity = (h) => h.page.evaluate(() => window.__tiagotv.activity());
const queue = (h) => h.page.evaluate(() => window.__tiagotv.queue());
const log = (h) => h.page.evaluate(() => window.__tiagotv.log());
/** Top 10 has its titles (far rows hold no cards, only their status until filled) and Series para ti its picks. */

/** Back from inside a page reaches the bar; on the bar it would ask to leave. */
async function toBar(h) {
    if (!/\btab\b|circle/.test(await h.focusedClass())) {
        await h.press('Backspace');
    }
}

async function toTab(h, name) {
    await toBar(h);
    await h.pressUntil('ArrowLeft', /\| Inicio$/, 9);
    return name === 'Inicio' ? true : h.pressUntil('ArrowRight', new RegExp(`\\| ${name}$`), 9);
}

/** The TV's Home button: the app goes to the background, and comes back. */
async function background(h, hidden) {
    await h.page.evaluate((value) => {
        if (value) {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        } else {
            delete document.hidden;
        }
        document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    await h.page.waitForTimeout(400);
}

async function openRecent(h) {
    await toTab(h, 'Inicio');
    await h.press('Enter');
    const found = await h.pressUntil('ArrowDown', /card--recent/, 16);
    await h.press('Enter');
    await h.page.waitForSelector('.player', { timeout: 10000 });
    await h.waitPlaying();
    return found;
}

export async function activitySuite(h) {
    const { page, check, press } = h;
    check('a recent channel opens the player', await openRecent(h));
    check('player: activity fullscreen', (await activity(h)) === 'fullscreen');
    await press('Backspace');
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    check('Back: activity idle', (await activity(h)) === 'idle', await activity(h));

    await openRecent(h);
    await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', { bubbles: true });
        Object.defineProperty(event, 'keyCode', { get: () => 413 });
        document.dispatchEvent(event);
    });
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    check('Stop: activity idle', (await activity(h)) === 'idle', await activity(h));

    await openRecent(h);
    await background(h, true);
    check('to the background: the player closes', !(await page.$('.player')));
    check('to the background: activity idle', (await activity(h)) === 'idle', await activity(h));
    await background(h, false);

    check('bar reaches En vivo', await toTab(h, 'En vivo'));
    await press('Enter');
    await page.waitForSelector('.page--live .card--channel', { timeout: 20000 });
    await press('Enter');
    await h.waitPlaying();
    check('stage: activity preview', (await activity(h)) === 'preview', await activity(h));
    await press('Enter');
    await page.waitForSelector('.player', { timeout: 5000 });
    await press('Backspace');
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    check('full screen → Back to the stage: activity preview', (await activity(h)) === 'preview', await activity(h));
    await press('Enter');
    await page.waitForSelector('.player', { timeout: 5000 });
    await background(h, true);
    await page.waitForTimeout(600);
    const left = { player: !!(await page.$('.player')), activity: await activity(h), open: (await h.stats()).open };
    check('stage full screen → background: closed, activity idle', !left.player && left.open === 0 && left.activity === 'idle', JSON.stringify(left));
    await background(h, false);
    check('the queue is not paused', !(await queue(h)).paused);
}

/** Forgets the kept catalog and the sports notes (a first launch), keeps the account. */
async function forgetKept(page) {
    await page.evaluate(() => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        keys.filter((key) => /^tiagotv-lite:(cat|sports):/.test(key)).forEach((key) => localStorage.removeItem(key));
    });
}

export async function firstLoadSuite(h) {
    const { page, check, shot, press } = h;
    await page.addInitScript(FAULTS);
    // Nothing in flight may write a kept copy after it is forgotten.
    await page.waitForFunction(() => { const q = window.__tiagotv.queue(); return q.waiting === 0 && !q.running; }, null, { timeout: 60000 });
    await forgetKept(page);
    await page.evaluate(() => {
        localStorage.setItem('smoke:abort', 'category_id=2001');
        localStorage.setItem('smoke:stuck', 'category_id=13');
    });
    await panelCall(h, `/__slow?category=${SLOW_CATEGORY}&ms=${SLOW_MS}`);
    // The first sports request waits a little: the run shortens the live timeout meanwhile.
    await panelCall(h, '/__slow?category=5&ms=2500');
    await panelCall(h, '/__big?on=1');
    // The aborted list is slow too, so it is still on its way when cut.
    await panelCall(h, '/__slow?category=2001&ms=2000');
    const from = (await h.stats()).calls.length;
    const started = Date.now();
    await page.reload();
    await page.waitForFunction(() => !!window.__tiagotv);
    await page.evaluate(() => window.__tiagotv.setTimeouts({ live: 2500 }));
    await page.waitForSelector('.shell .tab.focused', { timeout: 10000 });

    await page.waitForFunction(
        () => !!document.querySelector('.row--top10') && !document.querySelector('.row--top10 .card--status') && !!document.querySelector('.block--sfy .sfy'),
        null,
        { timeout: 45000 }
    );
    const filledAfter = Date.now() - started;
    const state = await queue(h);
    check('first load: Top 10 and Series para ti fill while categories still load', state.running !== null || state.waiting > 0, `${(filledAfter / 1000).toFixed(1)} s · ${state.waiting} waiting · ${state.running ? state.running.label : '-'}`);
    await h.press('Enter');
    await h.pressUntil('ArrowDown', /card--top10/, 10);
    await shot('29-inicio-primera-carga');

    // The player opens while the slow category loads: the queue waits, then goes on.
    check('player while the catalog loads', await openRecent(h));
    const paused = await queue(h);
    check('player: the queue waits behind it', paused.paused && (await activity(h)) === 'fullscreen', JSON.stringify(paused));
    await press('Backspace');
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    check('player closed: activity idle', (await activity(h)) === 'idle');

    await page.waitForFunction(
        (id) => window.__tiagotv.log().some((r) => /APPLE TV/.test(r.label) && r.action === 'series' && r.result === 'ok') && window.__tiagotv.queue().waiting === 0,
        SLOW_CATEGORY,
        { timeout: SLOW_MS + 30000 }
    );
    const after = await log(h);
    const cut = after.filter((r) => r.result === 'cortada' && /HBO MAX/.test(r.label));
    const firstCut = cut.length ? Math.min(...cut.map((r) => r.at)) : Infinity;
    check('an aborted request settles (cortada) and the queue goes on', cut.length > 0 && after.some((r) => r.result === 'ok' && r.at > firstCut), `${cut.length} aborted`);
    const stuck = after.find((r) => r.result === 'timeout' && /UK PREMIER LEAGUE/.test(r.label));
    check('a request that never reports is given up (timeout) and the queue goes on', !!stuck && (await page.evaluate(() => window.__smokeStuck || 0)) >= 1 && after.some((r) => r.result === 'ok' && r.at > stuck.at), stuck ? `${(stuck.ms / 1000).toFixed(1)} s` : 'none');
    const slow = after.find((r) => /APPLE TV/.test(r.label) && r.action === 'series' && r.result === 'ok');
    check('a category slower than 30 s still loads', !!slow && slow.ms >= 30000, slow ? `${(slow.ms / 1000).toFixed(1)} s` : 'none');
    const calls = (await h.stats()).calls.slice(from);
    const lastCatalog = calls.filter((c) => /^get_(vod_streams|series)$/.test(c.action)).pop();
    check('the queue went on after the player (the last lists loaded)', !!lastCatalog && lastCatalog.at > started, lastCatalog ? `${lastCatalog.action} ${lastCatalog.category}` : 'none');

    const big = after.find((r) => r.action === 'series' && /AMAZON PRIME/.test(r.label) && r.result === 'ok');
    const kept = await page.evaluate(() => {
        let chars = 0;
        let prime = -1;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key) || '';
            if (/^tiagotv-lite:(cat|lists):/.test(key)) {
                chars += key.length + value.length;
            }
            if (/:series:2350$/.test(key)) {
                prime = JSON.parse(value).value.length;
            }
        }
        return { bytes: chars * 2, prime };
    });
    check('a list of megabytes: kept cut to the newest 250, catalog under 2 MB', !!big && big.bytes > 2000000 && kept.prime > 0 && kept.prime <= 250 && kept.bytes < 2 * 1024 * 1024, `${big ? (big.bytes / 1e6).toFixed(1) : '?'} MB answer · ${kept.prime} kept · catalog ${(kept.bytes / 1024).toFixed(0)} KB`);
    await panelCall(h, `/__slow?category=${SLOW_CATEGORY}&ms=0`);
    await panelCall(h, '/__slow?category=5&ms=0');
    await panelCall(h, '/__slow?category=2001&ms=0');
    await panelCall(h, '/__big?on=0');
}

export async function diagnosticsSuite(h) {
    const { page, check, shot, press } = h;
    await toBar(h);
    await h.pressUntil('ArrowRight', /circle/, 10);
    await press('ArrowRight');
    await press('Enter');
    await page.waitForSelector('.page--settings .rail__item', { timeout: 5000 });
    check('Ajustes: Diagnóstico in the rail', await h.pressUntil('ArrowDown', /rail__item.*\| Diagnóstico$/, 4));
    await page.waitForFunction(() => document.querySelectorAll('.diag__entry').length >= 10, null, { timeout: 5000 });
    const shown = await page.evaluate(() => ({
        text: document.body.innerText,
        rows: document.querySelectorAll('.diag__entry').length,
    }));
    check('Diagnóstico: the latest requests', shown.rows >= 10 && /series ·/.test(shown.text) && /cortada|timeout/.test(shown.text), `${shown.rows} rows`);
    check('Diagnóstico: queue, catalog, sports and storage', /Cola de cargas/.test(shown.text) && /títulos/.test(shown.text) && /en vivo ahora/.test(shown.text) && /Datos guardados/.test(shown.text));
    const leaks = [ACCOUNT.username, ACCOUNT.password, 'player_api', 'password=', 'username='].filter((secret) => shown.text.indexOf(secret) >= 0);
    check('Diagnóstico: no user, password or URL on screen', leaks.length === 0, leaks.join(', '));
    await shot('30-ajustes-diagnostico');
    await press('ArrowRight');
    await h.pressUntil('ArrowDown', /diag__entry/, 6);
    await press('ArrowDown', 8);
    const scrolled = await page.evaluate(() => document.querySelector('.diag__content').style.transform);
    check('Diagnóstico: the D-pad walks and scrolls the list', /translate3d\(0px, -\d+px/.test(scrolled), scrolled);
    await shot('31-ajustes-diagnostico-lista');
    await h.pressUntil('ArrowLeft', /rail__item/, 4);
}

export async function secondLaunchSuite(h) {
    const { page, check, shot } = h;
    await page.evaluate(() => {
        localStorage.removeItem('smoke:abort');
        localStorage.removeItem('smoke:stuck');
    });
    // Whatever the panel is asked now answers late: the rows must not wait for it.
    await panelCall(h, '/__slow?category=all&ms=8000');
    const from = (await h.stats()).calls.length;
    const started = Date.now();
    await page.reload();
    await page.waitForFunction(
        () => !!document.querySelector('.row--top10') && !document.querySelector('.row--top10 .card--status') && !!document.querySelector('.block--sfy .sfy'),
        null,
        { timeout: 8000 }
    );
    const after = Date.now() - started;
    check('second launch: the kept catalog shows at once', after < 4000, `${(after / 1000).toFixed(1)} s`);
    await shot('32-inicio-segundo-arranque');
    await page.waitForTimeout(1500);
    const asked = (await h.stats()).calls.slice(from).filter((c) => /^get_(vod_streams|series)$/.test(c.action)).map((c) => c.category);
    // Only the category that failed (aborted) last time has no kept copy.
    check('second launch: no kept list asked again (not 12 h old)', asked.every((id) => id === '2001'), asked.join(', ') || 'none');
    await panelCall(h, '/__slow?category=all&ms=0');
    await h.page.waitForSelector('.shell .tab.focused', { timeout: 10000 });
    // Into the page, as before the reload (the exit suite starts from there).
    await h.press('Enter');
}
