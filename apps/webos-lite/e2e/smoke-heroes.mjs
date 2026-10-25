/**
 * The heroes' rule, checked on the screen: a slide shows only over a real
 * backdrop, never a poster, and a title without one, or whose backdrop is
 * a broken link (fake-catalog.mjs: NO_BACKDROP, BROKEN_BACKDROP), is
 * never featured: not on Inicio, Series, Películas or a platform's page.
 * A title's page without a backdrop shows no banner image at all.
 */
import { BROKEN_BACKDROP, NO_BACKDROP } from './fake-catalog.mjs';

/** Titles no hero may feature. */
export const LEFT_OUT = NO_BACKDROP.concat(BROKEN_BACKDROP);

/** What the hero in `scope` shows (null when hidden): its title, backdrop and any poster. */
export function heroState(h, scope) {
    return h.page.evaluate((selector) => {
        const hero = document.querySelector(`${selector} .hero`);
        if (!hero || hero.style.display === 'none') {
            return null;
        }
        const image = hero.querySelector('.hero__image');
        const posters = [...hero.querySelectorAll('img')].filter((img) => /\/poster\//.test(img.getAttribute('src') || '')).length;
        return {
            title: (hero.querySelector('.hero__title') || {}).textContent || '',
            backdrop: image ? image.getAttribute('data-src') || '' : '',
            posters: posters + hero.querySelectorAll('.hero__keyart, .hero__poster, .pic').length,
        };
    }, scope);
}

/** Waits for the hero's backdrop to load (a broken one leaves meanwhile). */
async function settled(h, scope) {
    await h.page
        .waitForFunction(
            (selector) => {
                const hero = document.querySelector(`${selector} .hero`);
                const image = hero && hero.querySelector('.hero__image');
                return !image || hero.style.display === 'none' || image.classList.contains('is-loaded');
            },
            scope,
            { timeout: 4000 }
        )
        .catch(() => undefined);
}

/**
 * Every slide of the hero in `scope`, walked with the remote from the
 * focused hero button (right past the last button turns the slide) until
 * it comes round to the first; the focus ends on the first slide.
 */
export async function walkHero(h, scope, presses = 18) {
    const slides = [];
    for (let i = 0; i < presses; i++) {
        await settled(h, scope);
        const state = await heroState(h, scope);
        if (!state) {
            break;
        }
        const last = slides[slides.length - 1];
        if (!last || last.title !== state.title) {
            if (slides.length > 1 && state.title === slides[0].title) {
                break;
            }
            slides.push(state);
        }
        const inHero = await h.page.evaluate((selector) => !!document.querySelector(`${selector} .hero .focused`), scope);
        if (!inHero) {
            break;
        }
        await h.press('ArrowRight');
    }
    return slides;
}

/** The checks on a walked hero: each slide over a backdrop, none left out featured. */
export function checkSlides(h, label, slides) {
    const titles = slides.map((slide) => slide.title);
    h.check(`${label}: every slide over a backdrop, no poster`, slides.length > 0 && slides.every((slide) => !!slide.backdrop && !/\/poster\//.test(slide.backdrop) && slide.posters === 0), titles.join(' | '));
    h.check(`${label}: no title without a backdrop featured`, titles.every((title) => LEFT_OUT.indexOf(title) < 0), titles.join(' | '));
}

/**
 * Películas' "Novedades": focusing each card features it in the hero
 * when it has a backdrop; a title without one leaves the hero as it was.
 * Ends with the focus on the card of `NO_BACKDROP`'s first movie found.
 */
export async function walkNovedades(h, scope, count = 12) {
    const { page, press } = h;
    const seen = [];
    let missing = null;
    for (let i = 0; i < count; i++) {
        await page.waitForTimeout(700);
        await settled(h, scope);
        const card = await focusedCard(h);
        const hero = await heroState(h, scope);
        seen.push({ card, hero });
        if (missing === null && NO_BACKDROP.indexOf(card) >= 0) {
            missing = i;
        }
        if (i < count - 1) {
            await press('ArrowRight');
        }
    }
    await press('ArrowLeft', count - 1 - (missing === null ? count - 1 : missing));
    return { seen, missing: missing === null ? null : seen[missing].card };
}

/** The focused card's title. */
export function focusedCard(h) {
    return h.page.evaluate(() => (document.querySelector('.focused .art__title') || {}).textContent || '');
}

/** A title's page without a backdrop: no banner image (never its poster). */
export function detailBanner(h) {
    return h.page.evaluate(() => {
        const image = document.querySelector('.detail .detail__backdrop');
        return { src: image ? image.getAttribute('src') || '' : '', shown: !!image && image.classList.contains('is-loaded') };
    });
}
