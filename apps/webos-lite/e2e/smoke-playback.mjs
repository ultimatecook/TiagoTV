/**
 * The smoke run's playback suites, on En vivo: the stage behind the page,
 * full screen with the same stream, zapping, the busy account, a stalled
 * channel, Back, leaving the page; and the TV kept idle while it plays
 * (pages behind display:none, no page timers, no image downloads or
 * catalog requests). "Fluidez" decides HLS or TS first.
 */
// Timers the player itself may hold; any other is a page left running.
const PLAYER_TIMERS = ['osd', 'osd-fade', 'stall-watch', 'zap', 'live-idle'];

export async function toLive(h) {
    await h.press('Backspace');
    await h.pressUntil('ArrowLeft', /\| Inicio$/, 9);
    return h.pressUntil('ArrowRight', /\| En vivo$/, 6);
}

export async function liveSuite(h) {
    const { page, press, check, shot, panel } = h;
    check('bar reaches En vivo', await toLive(h));
    await press('Enter');
    await page.waitForSelector('.page--live .card--channel', { timeout: 20000 });
    const live = await page.evaluate(() => ({
        countries: [...document.querySelectorAll('.live__countries .chip')].map((el) => el.textContent),
        chips: [...document.querySelectorAll('.live__categories .chip')].map((el) => el.textContent),
    }));
    check('En vivo: the four countries', live.countries.join(',') === 'Argentina,España,Reino Unido,Estados Unidos', live.countries.join(', '));
    check('En vivo: category chips', /^Todos/.test(live.chips[0] || ''), live.chips.join(' | '));
    check('OK on the tab: the first channel', /card--channel/.test(await h.focusedClass()), await h.focused());

    let mark = (await h.stats()).streams.length;
    await press('Enter');
    await h.waitPlaying();
    const opened = await h.streamsSince(mark);
    check('Más estable (default): HLS first, then TS', opened.length === 2 && opened[0].endsWith('.m3u8') && opened[1].endsWith('.ts'), opened.join(', '));
    let state = await h.tv();
    check('attempts HLS then TS', state.attempts.slice(-2).join(' ') === 'HLS:failed TS:playing', state.attempts.join(' '));
    const stage = await page.evaluate(() => ({
        inStage: !!document.querySelector('.stage video'),
        playing: !!document.querySelector('.card--channel.is-playing'),
    }));
    check('OK plays in the stage behind the page', stage.inStage && stage.playing);
    check('activity is preview (fewer images at once)', state.activity === 'preview', state.activity);
    await shot('24-en-vivo');

    mark = (await h.stats()).streams.length;
    await press('Enter');
    await page.waitForSelector('.player', { timeout: 5000 });
    await page.waitForTimeout(800);
    check('OK on the playing card: full screen, same stream', (await h.streamsSince(mark)).length === 0 && !!(await page.$('.player video')));
    state = await h.tv();
    const shellShown = await page.evaluate(() => getComputedStyle(document.querySelector('.shell')).display !== 'none');
    check('pages behind the player are display:none', !shellShown);
    check('no page timers while playing', state.timers.every((name) => PLAYER_TIMERS.indexOf(name) >= 0), state.timers.join(', '));
    check('activity is fullscreen (images and requests wait)', state.activity === 'fullscreen');
    await press('Enter');
    check('OK shows the OSD', await page.evaluate(() => document.querySelector('.osd').classList.contains('is-visible')));
    await page.waitForTimeout(400);
    await shot('25-reproductor');
    const osd = () => page.evaluate(() => document.querySelector('.osd__title').textContent);
    const first = await osd();
    await press('ArrowUp');
    await h.waitPlaying();
    const zapped = await osd();
    check('up zaps to the next channel', zapped !== first, zapped);
    await press('PageDown');
    await h.waitPlaying();
    check('CH- zaps back', (await osd()) === first, await osd());
    let s = await h.stats();
    check('one connection at a time', s.maxOpen <= 1 && s.refused === 0, `max open ${s.maxOpen}, refused ${s.refused}`);

    await fetch(`${panel.url}/__busy?on=1`);
    await press('PageUp');
    await page.waitForFunction(() => /en uso en otro dispositivo/.test(document.body.innerText), null, { timeout: 25000 });
    check('busy account message', true);
    await shot('26-reproductor-ocupado');
    await fetch(`${panel.url}/__busy?on=0`);
    await press('Enter');
    await h.waitPlaying();
    check('OK retries after busy', true);

    await fetch(`${panel.url}/__stall?on=1`);
    mark = (await h.stats()).streams.length;
    await press('PageUp');
    await h.waitPlaying();
    await page.waitForFunction(() => /Reconectando/.test(document.body.innerText), null, { timeout: 30000 });
    check('stall: reconnects', true);
    await page.waitForFunction(() => /No se pudo reproducir/.test(document.body.innerText), null, { timeout: 45000 });
    const stalled = (await h.streamsSince(mark)).filter((entry) => entry.endsWith('.ts'));
    check('stall: one reconnect, then the error panel', stalled.length === 2, stalled.join(', '));
    s = await h.stats();
    check('stall: stream closed after giving up', s.open === 0, `open ${s.open}`);
    await fetch(`${panel.url}/__stall?on=0`);
    await press('Enter');
    await h.waitPlaying();
    check('OK retries after a stall', true);

    mark = (await h.stats()).streams.length;
    await press('Backspace');
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(1200);
    const back = await page.evaluate(() => ({ inStage: !!document.querySelector('.stage video'), time: document.querySelector('video').currentTime }));
    await page.waitForTimeout(800);
    const later = await page.evaluate(() => document.querySelector('video').currentTime);
    check('Back: the stream goes on in the stage', back.inStage && later > back.time && (await h.streamsSince(mark)).length === 0);
    check('Back: focus on the playing card', /card--channel.*is-playing|is-playing.*card--channel/.test(await h.focusedClass()), await h.focusedClass());

    await page.waitForFunction(() => document.querySelector('.page--live').classList.contains('is-bare'), null, { timeout: 15000 });
    check('idle: the chrome steps aside', true);
    await shot('27-en-vivo-sin-chrome');
    await press('ArrowLeft');
    check('a key brings it back (and is spent)', !(await page.evaluate(() => document.querySelector('.page--live').classList.contains('is-bare'))) && /is-playing/.test(await h.focusedClass()));

    await press('Backspace');
    await press('ArrowLeft');
    await page.waitForTimeout(800);
    s = await h.stats();
    check('leaving En vivo closes the stream', s.open === 0, `open ${s.open}`);
}

/** After Ajustes → Fluidez → Normal: TS first. */
export async function normalSuite(h) {
    const { page, press, check } = h;
    check('bar reaches En vivo again', await toLive(h));
    await press('Enter');
    await page.waitForSelector('.page--live .card--channel', { timeout: 20000 });
    const mark = (await h.stats()).streams.length;
    await press('Enter');
    await h.waitPlaying();
    const opened = await h.streamsSince(mark);
    check('Normal: TS first', opened.length === 1 && opened[0].endsWith('.ts'), opened.join(', '));
    await press('Backspace');
    await press('ArrowLeft');
    await page.waitForTimeout(800);
    const s = await h.stats();
    check('never more than one connection', s.maxOpen <= 1 && s.open === 0, `max open ${s.maxOpen}, open ${s.open}`);
}
