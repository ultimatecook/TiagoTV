/**
 * The smoke run's browsing suites: Inicio, a platform's page, Series and
 * Películas, a title's page, Deportes and a league's page, Buscar, Mi
 * lista and Ajustes. Each one walks its screen with the remote: the
 * D-pad moves, OK opens, Back returns with the focus where it was.
 */
const HERO_TITLE = '.hero__title';

async function toTab(h, id) {
    await h.press('Backspace');
    await h.page.waitForTimeout(200);
    const ok = await h.pressUntil('ArrowLeft', /\| Inicio$/, 9);
    if (id === 'home') {
        return ok;
    }
    return h.pressUntil('ArrowRight', new RegExp(`\\| ${id}$`), 9);
}

export async function homeSuite(h) {
    const { page, press, check, shot } = h;
    await page.waitForSelector('.card--platform', { timeout: 20000 });
    // Far rows hold no cards until they come near: wait for the Top 10's
    // "Cargando…" to give way to its titles.
    await page.waitForFunction(() => !document.querySelector('.row--top10 .card--status'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const home = await page.evaluate(() => ({
        hero: (document.querySelector('.hero--home .hero__title') || {}).textContent || '',
        eyebrow: (document.querySelector('.hero--home .hero__eyebrow') || {}).textContent || '',
        platforms: [...document.querySelectorAll('.card--platform img')].map((img) => img.getAttribute('alt')),
        leagues: document.querySelectorAll('.card--league').length,
        events: document.querySelectorAll('.event').length,
        headings: [...document.querySelectorAll('.page--home .heading__title')].map((el) => el.textContent),
    }));
    check('Inicio: hero with a recent title', !!home.hero && /AÑADIDO RECIENTEMENTE|SEGUIR VIENDO/i.test(home.eyebrow), `${home.eyebrow} · ${home.hero}`);
    check('Inicio: platforms the source carries (Prime from its MULTI category)', home.platforms.indexOf('Prime Video') >= 0 && home.platforms.indexOf('Netflix') === 0, home.platforms.join(', '));
    check('Inicio: league cards', home.leagues >= 6, String(home.leagues));
    check('Inicio: the desktop\'s sections in order', /Plataformas,Deportes,Eventos de hoy,Top 10 películas hoy,Series para ti/.test(home.headings.join(',')), home.headings.join(' | '));
    check('Inicio: today\'s events', home.events >= 3, String(home.events));
    await shot('01-inicio');

    await press('ArrowDown');
    check('down: the hero\'s button', /Más info|Continuar/.test(await h.focused()), await h.focused());
    await press('ArrowDown');
    check('down: Netflix\'s card', /card--platform/.test(await h.focusedClass()));
    await shot('02-inicio-plataformas');
    await press('ArrowRight');
    await press('Enter');
    await page.waitForSelector('.platform-page .hero__title', { timeout: 15000 });
    await page.waitForTimeout(1200);
    const platform = await page.evaluate(() => ({
        rows: [...document.querySelectorAll('.platform-page .heading__title')].map((el) => el.textContent),
        look: document.querySelector('.platform-page').className,
    }));
    check('OK opens Prime Video\'s page', /look--prime/.test(platform.look) && platform.rows.indexOf('Lo más nuevo') >= 0, platform.rows.join(' | '));
    await shot('03-plataforma-prime');
    await press('Backspace');
    check('Back returns to Prime\'s card', /card--platform/.test(await h.focusedClass()) && (await page.evaluate(() => document.querySelector('.focused img').alt)) === 'Prime Video');
    await press('ArrowRight');
    await press('ArrowLeft', 2);
    await press('Enter');
    await page.waitForSelector('.platform-page.look--netflix', { timeout: 15000 });
    await page.waitForFunction(() => /Top 10 en Netflix/.test(document.body.innerText), null, { timeout: 15000 });
    await press('ArrowDown', 2);
    await shot('04-plataforma-netflix');
    check('Netflix\'s page: Top 10 en Netflix', true);
    await press('Backspace');

    await press('ArrowDown');
    check('down: the league cards', /card--league/.test(await h.focusedClass()));
    await press('Enter');
    await page.waitForSelector('.league-page .card--channel', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.table__row').length > 10, null, { timeout: 15000 });
    const league = await page.evaluate(() => ({
        pill: document.querySelector('.league-pill').textContent,
        channels: document.querySelectorAll('.league-page .card--channel').length,
        featured: (document.querySelector('.featured') || {}).textContent || '',
    }));
    check('OK opens LaLiga\'s page: its channels', league.channels >= 2 && /LaLiga/.test(league.pill), `${league.channels} · ${league.pill}`);
    check('LaLiga: featured match and standings', /Real Madrid/.test(league.featured), league.featured.slice(0, 60));
    await shot('05-liga-laliga');
    await press('ArrowDown');
    await page.waitForTimeout(500);
    await shot('06-liga-laliga-tabla');
    await press('Backspace');
    check('Back returns to the league card', /card--league/.test(await h.focusedClass()));
    await press('ArrowDown');
    await shot('07-inicio-eventos');
    await h.pressUntil('ArrowDown', /card--top10/, 12);
    await shot('08-inicio-top10');
    await h.pressUntil('ArrowDown', /Empezar/, 4);
    await shot('09-inicio-series');
    check('Inicio: "Series para ti" offers Empezar T1 · E1', /Empezar T1 · E1/.test(await h.focused()));
}

export async function catalogSuite(h) {
    const { page, press, check, shot } = h;
    check('bar reaches Series', await toTab(h, 'Series'));
    await page.waitForSelector('.page--series .card--landscape', { timeout: 20000 });
    await page.waitForTimeout(1000);
    await shot('10-series');
    await press('ArrowDown', 2);
    await press('ArrowRight');
    await page.waitForTimeout(900);
    const featured = await page.evaluate(() => ({
        hero: document.querySelector('.page--series .hero__title').textContent,
        card: document.querySelector('.focused .art__title').textContent,
    }));
    check('Novedades: the focused title shows in the hero', featured.hero === featured.card, `${featured.hero} / ${featured.card}`);
    await press('ArrowDown');
    const rows = await page.evaluate(() => [...document.querySelectorAll('.page--series .row--posters .heading__title')].map((el) => el.textContent));
    check('Series: a row per genre', rows.indexOf('Acción') >= 0 && rows.indexOf('Drama') >= 0, rows.join(' | '));
    await shot('11-series-generos');
    const poster = await h.focused();
    await press('Enter');
    await page.waitForSelector('.detail .detail__title', { timeout: 10000 });
    await page.waitForSelector('.episode', { timeout: 15000 });
    await page.waitForTimeout(600);
    const detail = await page.evaluate(() => ({
        title: document.querySelector('.detail__title').textContent,
        seasons: document.querySelectorAll('.detail__seasons .chip').length,
        primary: document.querySelector('.button--play').textContent,
    }));
    check('OK opens the series\' page: seasons and episodes', detail.seasons === 2 && poster.indexOf(detail.title) === 0, `${detail.title} · ${detail.seasons}`);
    check('series page: Reproducir T1:E1', /Reproducir/.test(detail.primary), detail.primary);
    await shot('12-titulo-serie');
    await press('ArrowDown', 2);
    check('down: the first episode', /episode/.test(await h.focusedClass()));
    await shot('13-titulo-serie-episodios');
    await press('Enter');
    await page.waitForSelector('.player', { timeout: 10000 });
    await h.waitPlaying();
    check('OK plays the episode', true);
    await press('Backspace');
    await page.waitForTimeout(600);
    check('Back: focus on the episode', /episode/.test(await h.focusedClass()));
    await press('Backspace');
    check('Back: the series poster again', /card--poster/.test(await h.focusedClass()));

    check('bar reaches Películas', await toTab(h, 'Películas'));
    await page.waitForSelector('.page--movie .card--landscape', { timeout: 20000 });
    await page.waitForTimeout(900);
    await shot('14-peliculas');
    await press('ArrowDown');
    await press('ArrowRight');
    await press('Enter');
    await page.waitForSelector('.detail .detail__title', { timeout: 10000 });
    await page.waitForTimeout(900);
    await shot('15-titulo-pelicula');
    await h.pressUntil('ArrowRight', /button--round/, 3);
    await press('Enter');
    check('the heart keeps the movie in Mi lista', await page.evaluate(() => JSON.parse(localStorage.getItem('tiagotv.lite.milista') || '[]').length === 1));
    await press('Backspace');
}

export async function sportsSuite(h) {
    const { page, press, check, shot } = h;
    check('bar reaches Deportes', await toTab(h, 'Deportes'));
    await page.waitForSelector('.page--sports .match-card', { timeout: 20000 });
    await page.waitForTimeout(800);
    const hub = await page.evaluate(() => ({
        title: document.querySelector('.page--sports .page__title').textContent,
        teams: [...document.querySelectorAll('.team-pill__name')].map((el) => el.textContent),
        live: document.querySelectorAll('.match-card').length,
    }));
    check('Deportes: Tus equipos', hub.teams.join(',') === "Real Madrid,Newell's Old Boys,West Ham United", hub.teams.join(', '));
    check('Deportes: En vivo ahora', hub.live >= 3, String(hub.live));
    await shot('16-deportes');
    await h.pressUntil('ArrowDown', /match-card/, 4);
    await shot('17-deportes-envivo');
    await press('Enter');
    await page.waitForSelector('.player', { timeout: 10000 });
    await h.waitPlaying();
    check('OK plays the match', true);
    await press('Backspace');
    await page.waitForTimeout(600);
    check('Back: the match card again', /match-card/.test(await h.focusedClass()));
}

const KEYBOARD = ['abcdefg', 'hijklmn', 'ñopqrst', "uvwxyz'", '1234567', '890'];

function keyAt(char) {
    for (let row = 0; row < KEYBOARD.length; row++) {
        const col = KEYBOARD[row].indexOf(char);
        if (col >= 0) {
            return { row, col };
        }
    }
    return null;
}

async function typeOnKeyboard(h, word, from = { row: 0, col: 0 }) {
    let at = from;
    for (const char of word) {
        const to = keyAt(char);
        const dy = to.row - at.row;
        const dx = to.col - at.col;
        await h.press(dy > 0 ? 'ArrowDown' : 'ArrowUp', Math.abs(dy));
        await h.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(dx));
        await h.press('Enter');
        at = to;
    }
    return at;
}

export async function searchSuite(h) {
    const { page, press, check, shot } = h;
    await press('Backspace');
    check('bar reaches Buscar', await h.pressUntil('ArrowRight', /circle/, 10));
    await press('Enter');
    await page.waitForSelector('.page--search .key', { timeout: 5000 });
    check('OK: the keyboard', (await h.focused()) === 'A', await h.focused());
    await typeOnKeyboard(h, 'real');
    await page.waitForFunction(() => /Real Madrid/.test(document.querySelector('.search__results').innerText), null, { timeout: 20000 });
    check('typing "real" finds Real Madrid', true, await page.textContent('.search__text'));
    await shot('18-buscar');
    await h.pressUntil('ArrowDown', /key--clear/, 8);
    await press('Enter');
    check('Borrar empties the field', (await page.textContent('.search__text')) === 'Equipos, partidos, canales, series…');
    await h.pressUntil('ArrowUp', /\| [A-G]$/, 8);
    await h.pressUntil('ArrowLeft', /\| A$/, 8);
    await typeOnKeyboard(h, 'dar');
    await page.waitForFunction(() => /DARK/.test(document.querySelector('.search__results').innerText), null, { timeout: 30000 });
    await h.pressUntil('ArrowRight', /result/, 10);
    check('right: the results', /result/.test(await h.focusedClass()), await h.focused());
    await shot('19-buscar-resultados');
    await h.pressUntil('ArrowDown', /result.*DARK/, 8);
    await press('Enter');
    await page.waitForSelector('.detail .detail__title', { timeout: 10000 });
    check('OK opens the title found', (await page.textContent('.detail__title')) === 'DARK');
    await press('Backspace');
    check('Back: the result again', /result/.test(await h.focusedClass()));
}

export async function myListSuite(h) {
    const { page, press, check, shot } = h;
    check('bar reaches Mi lista', await toTab(h, 'Mi lista'));
    await page.waitForTimeout(500);
    const cards = await page.evaluate(() => document.querySelectorAll('.page--mylist .card--poster').length);
    check('Mi lista: the movie kept with the heart', cards === 1, String(cards));
    await shot('20-mi-lista');
}

export async function settingsSuite(h) {
    const { page, press, check, shot } = h;
    await h.pressUntil('ArrowRight', /circle/, 4);
    await press('ArrowRight');
    await press('Enter');
    await page.waitForSelector('.page--settings .rail__item', { timeout: 5000 });
    check('OK on Ajustes: its sections', /rail__item/.test(await h.focusedClass()), await h.focused());
    await page.waitForFunction(() => /Activa/.test(document.querySelector('.settings__panel').innerText), null, { timeout: 10000 });
    await shot('21-ajustes-cuenta');
    await press('ArrowDown');
    check('Reproducción shows Fluidez', /Fluidez/.test(await page.textContent('.settings__panel')) && /carga unos segundos por adelantado/.test(await page.textContent('.settings__panel')));
    check('Más estable is the default', (await page.textContent('.segmented__option.is-selected')) === 'Más estable');
    await shot('22-ajustes-reproduccion');
    await press('ArrowRight');
    await h.pressUntil('ArrowRight', /\| Normal$/, 3);
    await press('Enter');
    check('Normal is stored', (await page.evaluate(() => localStorage.getItem('tiagotv.lite.fluidez'))) === 'normal');
    await h.pressUntil('ArrowLeft', /rail__item/, 4);
    await press('ArrowDown');
    await shot('23-ajustes-acerca');
    check('Acerca de: the version', /TiagoTV liviano/.test(await page.textContent('.settings__panel')));
    await press('Backspace');
}
