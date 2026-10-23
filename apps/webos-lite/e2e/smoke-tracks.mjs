/**
 * The smoke run's subtitle and audio suite, on DARK's episodes (Buscar →
 * DARK → T1). Every episode plays a clip with two audio tracks (English,
 * then Spanish); episode 1's info lists the provider's Spanish SRT and
 * English VTT; episode 2 carries embedded tracks (inband-tracks.js);
 * episode 3 has no subtitles at all. The checks: the OSD's buttons, the
 * lists by language, Spanish shown by default on English audio, a pick
 * kept for the next title, an audio switch in place, and never a second
 * stream connection for a switch.
 */
import { toTab, typeOnKeyboard } from './smoke-browse.mjs';

const items = (h) =>
    h.page.evaluate(() =>
        [...document.querySelectorAll('.tracks__item')].map((el) => `${el.classList.contains('is-current') ? '*' : ''}${el.textContent}`)
    );
const cueText = (h) => h.page.evaluate(() => document.querySelector('.cues').innerText.trim());
const waitCue = (h, pattern) =>
    h.page
        .waitForFunction((source) => new RegExp(source).test(document.querySelector('.cues').innerText), pattern.source, { timeout: 12000 })
        .then(() => true, () => false);
const audio = (h) =>
    h.page.evaluate(() => {
        const list = document.querySelector('video').audioTracks;
        return list ? [...Array(list.length).keys()].map((i) => `${list[i].language}:${list[i].enabled ? 'on' : 'off'}`).join(' ') : 'none';
    });
const stored = (h) => h.page.evaluate(() => [localStorage.getItem('tiagotv.lite.subtitles'), localStorage.getItem('tiagotv.lite.audio')].join(' '));
const buttons = (h) =>
    h.page.evaluate(() => [...document.querySelectorAll('.osd__track')].filter((el) => el.offsetWidth > 0).map((el) => el.textContent));

/** From the bar: Buscar → "dar" → DARK's page → its first episode. */
export async function openDark(h) {
    const { page, press } = h;
    await toTab(h, 'home');
    if (await page.$('.dialog')) {
        // Back on Inicio asks to exit: stay.
        await press('Backspace');
    }
    await h.pressUntil('ArrowRight', /circle/, 10);
    await press('Enter');
    await page.waitForSelector('.page--search .key', { timeout: 5000 });
    if (!/DARK/.test(await page.textContent('.search__results'))) {
        await h.pressUntil('ArrowDown', /key--clear/, 8);
        await press('Enter');
        await h.pressUntil('ArrowUp', /\| [A-G]$/, 8);
        await h.pressUntil('ArrowLeft', /\| A$/, 8);
        await typeOnKeyboard(h, 'dar');
        await page.waitForFunction(() => /DARK/.test(document.querySelector('.search__results').innerText), null, { timeout: 30000 });
    }
    await h.pressUntil('ArrowRight', /result/, 10);
    await h.pressUntil('ArrowDown', /result.*DARK/, 8);
    await press('Enter');
    await page.waitForSelector('.detail .episode', { timeout: 15000 });
    await h.pressUntil('ArrowDown', /episode/, 6);
    for (let i = 0; i < 4 && (await page.textContent('.episode.focused .episode__number')) !== '1'; i++) {
        await press('ArrowUp');
    }
    return (await page.textContent('.episode.focused .episode__number')) === '1';
}

/** Down → the buttons; `steps` Right; OK → the list. */
export async function openList(h, steps = 0) {
    await h.press('ArrowDown');
    await h.press('ArrowRight', steps);
    await h.press('Enter');
    await h.page.waitForSelector('.tracks .tracks__title', { timeout: 3000 });
}

/** Up/Down to the row reading `name`, then OK. */
export async function pick(h, name) {
    for (let i = 0; i < 6; i++) {
        const label = await h.focused();
        if (label === name) {
            break;
        }
        const list = await items(h);
        const at = list.findIndex((text) => text.replace('*', '') === label);
        const to = list.findIndex((text) => text.replace('*', '') === name);
        await h.press(to > at ? 'ArrowDown' : 'ArrowUp');
    }
    await h.press('Enter');
}

export { buttons as trackButtons, cueText, items as trackItems, waitCue };

export async function tracksSuite(h) {
    const { page, press, check, shot } = h;
    check('tracks: DARK\'s first episode', await openDark(h), await h.focused());
    let mark = (await h.stats()).streams.length;
    const subtitlesMark = (await h.stats()).subtitles.length;
    const refusedMark = (await h.stats()).refused;
    await press('Enter');
    await page.waitForSelector('.player', { timeout: 10000 });
    // Back must close the player at once: no button takes the focus by itself.
    check('the player opens with nothing focused', await page.evaluate(() => !document.querySelector('.player .focused')), await h.focusedClass());
    await h.waitPlaying();
    const autoSpanish = await waitCue(h, /¿Dónde está\? Línea/);
    check('E1: Spanish subtitles by default on English audio (provider SRT, Windows-1252)', autoSpanish, await cueText(h));
    const downloaded = (await h.stats()).subtitles.slice(subtitlesMark);
    check('E1: only the Spanish SRT downloaded', downloaded.length === 1 && /11\.es\.srt$/.test(downloaded[0]), downloaded.join(', '));

    await press('ArrowDown');
    const shown = await buttons(h);
    check('Down: the OSD\'s Subtítulos and Audio buttons', shown.join(' | ') === 'Subtítulos: Español | Audio: Inglés', shown.join(' | '));
    check('Down: the remote on Subtítulos', /osd__track/.test(await h.focusedClass()));
    await press('Enter');
    await page.waitForSelector('.tracks .tracks__item', { timeout: 3000 });
    const list = await items(h);
    check('the list by language, the current one marked', list.join(',') === 'Desactivados,*Español,Inglés', list.join(', '));
    check('the remote on the current track', (await h.focused()) === 'Español');
    await shot('33-subtitulos-lista');
    await pick(h, 'Desactivados');
    await page.waitForTimeout(400);
    check('Desactivados: no lines, "off" kept', (await cueText(h)) === '' && (await stored(h)).startsWith('off'), `${await cueText(h)} / ${await stored(h)}`);
    check('a pick closes the list', !(await page.$('.tracks .tracks__item')));

    await openList(h);
    await pick(h, 'Inglés');
    check('Inglés: the provider\'s VTT', await waitCue(h, /Where is it\? Line/), await cueText(h));
    await openList(h);
    await pick(h, 'Español');
    check('Español again: its lines, "es" kept', (await waitCue(h, /¿Dónde está\?/)) && (await stored(h)).startsWith('es'), await stored(h));
    await page.waitForTimeout(3600);
    await shot('34-subtitulo-en-pantalla');

    await openList(h, 1);
    const tracks = await items(h);
    check('Audio: both tracks by language', tracks.join(',') === '*Inglés,Español', tracks.join(', '));
    await pick(h, 'Español');
    await page.waitForTimeout(800);
    check('Audio → Español: switched in place', (await audio(h)) === 'eng:off spa:on' && / es$/.test(await stored(h)), `${await audio(h)} / ${await stored(h)}`);
    check('Español subtitles stay (picked by hand)', await waitCue(h, /¿Dónde está\?/), await cueText(h));
    let opened = await h.streamsSince(mark);
    check('switches never open another stream', opened.length === 1 && (await h.stats()).maxOpen <= 1, opened.join(', '));

    // The next title: the kept choices apply (Spanish audio → no Spanish subtitles).
    mark = (await h.stats()).streams.length;
    await press('PageUp');
    await h.waitPlaying();
    await page.waitForFunction(() => window.__inband.modes() !== '', null, { timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    check('E2: Spanish audio kept for the next title', (await audio(h)) === 'eng:off spa:on', await audio(h));
    check('E2: no Spanish subtitles on Spanish audio', (await cueText(h)) === '' && /es:disabled/.test(await page.evaluate(() => window.__inband.modes())), await page.evaluate(() => window.__inband.modes()));
    await openList(h);
    const embedded = await items(h);
    check('E2: the file\'s embedded tracks listed', embedded.join(',') === '*Desactivados,Inglés,Español', embedded.join(', '));
    await press('Backspace');
    await openList(h, 1);
    await pick(h, 'Inglés');
    check('E2: English audio → Spanish embedded subtitles on their own', await waitCue(h, /\[ES\] Línea/), await cueText(h));
    check('E2: only the Spanish track is read', /en:disabled es:hidden/.test(await page.evaluate(() => window.__inband.modes())), await page.evaluate(() => window.__inband.modes()));

    mark = (await h.stats()).streams.length;
    await press('PageUp');
    await h.waitPlaying();
    await page.waitForTimeout(800);
    check('E3: English audio kept', (await audio(h)) === 'eng:on spa:off', await audio(h));
    await press('ArrowDown');
    await press('Enter');
    const empty = await page.evaluate(() => (document.querySelector('.tracks__empty') || {}).textContent || '');
    check('E3: "Sin subtítulos en este archivo"', empty === 'Sin subtítulos en este archivo', empty);
    await shot('35-sin-subtitulos');
    await press('Backspace');
    await press('Backspace');
    check('Back: the list, then the buttons, then still playing', !!(await page.$('.player')) && !(await page.$('.tracks .tracks__title')));
    opened = await h.streamsSince(mark);
    const s = await h.stats();
    check('one stream per episode, never two at once', opened.length === 1 && s.maxOpen <= 1 && s.refused === refusedMark, `${opened.join(', ')} · max ${s.maxOpen} · refused ${s.refused - refusedMark}`);
    await press('Backspace');
    await page.waitForSelector('.player', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(600);
    check('Back closes the player and the stream', (await h.stats()).open === 0);
    await press('Backspace');
}
