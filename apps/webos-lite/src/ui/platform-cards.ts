import {
    languagesLabel,
    type PlatformBrandRow,
    type PlatformLook,
    type PlatformTitle,
    type StreamingPlatform,
    type TileDress,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h, picture } from '../core/dom';
import { assetUrl, tmdbSized } from '../data/images';
import { genreLabel, kindLabel } from '../data/title-meta';
import { platformMark, type TitleCardModel } from './cards';
import { lookOf } from './platform-looks';

/**
 * A platform page's tiles, as the desktop's title cards draw them per
 * look (platform-title-card): 16:9 artwork or a poster, the platform's
 * corner badge (Netflix's N, Prime Video's check), the languages, the
 * name on the artwork (Netflix, Hulu's large row) or under it, with
 * "Serie · Drama" where the platform writes it (Apple TV, Hulu); the
 * Top 10's outlined places; Disney+'s brand tiles. The card is the
 * artwork (the focus ring follows it), the name hangs under; sizes
 * match styles/platforms.css.
 */
export const TILE = {
    landscape: { width: 400, gap: 22 },
    landscapeLarge: { width: 560, gap: 24 },
    poster: { width: 220, gap: 22 },
    posterLarge: { width: 300, gap: 24 },
    ranked: { width: 470, gap: 18 },
    brand: { width: 330, gap: 27 },
} as const;

export function tileSize(dress: TileDress): { readonly width: number; readonly gap: number } {
    if (dress.tile === 'landscape') {
        return dress.large ? TILE.landscapeLarge : TILE.landscape;
    }
    return dress.large ? TILE.posterLarge : TILE.poster;
}

/** The row variant (its height in platforms.css) a dress needs. */
export function tileVariant(dress: TileDress): string {
    return `tiles-${dress.tile}${dress.large ? '-large' : ''}${dress.caption ? '-cap' : ''}`;
}

/** The platform's mark as its look writes it: Netflix's red N, else the logo. */
export function brandMark(platform: StreamingPlatform | null, look: PlatformLook, className: string): HTMLElement | null {
    if (look === 'netflix') {
        return h('span', { className: `${className} mark mark--n`, text: 'N' });
    }
    return platformMark(platform, className);
}

function tileBadge(look: PlatformLook): HTMLElement | null {
    const badge = lookOf(look).badge;
    if (badge === 'n') {
        return h('span', { className: 'tile__n', text: 'N' });
    }
    return badge === 'check' ? h('i', 'tile__check') : null;
}

/** "Serie · Drama". */
function subLine(title: PlatformTitle): string {
    const genre = title.genres[0];
    return genre ? `${kindLabel(title.kind)} · ${genreLabel(genre)}` : kindLabel(title.kind);
}

/** A title's tile in the look's dress. */
export function platformTile(model: TitleCardModel, dress: TileDress, look: PlatformLook): HTMLElement {
    const title = model.title;
    const landscape = dress.tile === 'landscape';
    const art =
        landscape && title.backdrop
            ? tmdbSized(title.backdrop, dress.large ? 'w780' : 'w500')
            : tmdbSized(title.poster, dress.large ? 'w500' : 'w342');
    const sub = dress.sub ? subLine(title) : null;
    const classes = [`card--tile tile--${dress.tile}`];
    if (dress.large) {
        classes.push('is-large');
    }
    if (landscape && !title.backdrop) {
        classes.push('is-poster-art');
    }
    return h(
        'div',
        classes.join(' '),
        h(
            'div',
            'tile__art',
            picture(art, 'tile__pic', dress.caption ? '' : title.title),
            tileBadge(look),
            h('span', { className: 'tile__lang', text: languagesLabel(title) }),
            dress.caption
                ? h(
                      'div',
                      'tile__caption',
                      h('span', { className: 'tile__caption-name', text: title.title }),
                      sub ? h('span', { className: 'tile__sub', text: sub }) : null
                  )
                : null
        ),
        dress.caption ? null : h('div', { className: 'tile__name', text: title.title }),
        dress.caption || !sub ? null : h('div', { className: 'tile__sub', text: sub })
    );
}

/** Netflix's Top 10: the place in a tall outlined number, the poster tucked over its right edge. */
export function rankedTile(model: TitleCardModel, rank: number, look: PlatformLook): HTMLElement {
    const title = model.title;
    return h(
        'div',
        'card--top10 card--ranked',
        h('span', { className: 'top10__rank display', text: String(rank) }),
        h(
            'div',
            'top10__poster tile__art',
            picture(tmdbSized(title.poster, 'w342'), 'tile__pic', title.title),
            tileBadge(look),
            h('span', { className: 'tile__lang', text: languagesLabel(title) })
        )
    );
}

const DISNEY_LOGO = './assets/platforms/disney-plus.svg';

/** Each brand's mark, written as the desktop writes it (no brand ships a logo but Disney+'s). */
function brandFace(row: PlatformBrandRow): HTMLElement {
    switch (row.brand.id) {
        case 'disney':
            return h('img', { className: 'brand__disney', attrs: { src: assetUrl(DISNEY_LOGO) ?? '', alt: row.brand.name } });
        case 'marvel':
            return h('span', { className: 'brand__marvel display', text: 'Marvel' });
        case 'star-wars':
            return h('span', 'brand__star-wars', 'Star', h('br'), 'Wars');
        case 'national-geographic':
            return h('span', 'brand__natgeo', h('i', 'brand__frame'), h('span', null, 'National', h('br'), 'Geographic'));
        default:
            return h('span', { className: 'brand__pixar', text: 'Pixar' });
    }
}

/** Disney+'s brand tile: the mark on a dark raised tile. */
export function brandTile(row: PlatformBrandRow): HTMLElement {
    return h('div', `card--brand brand--${row.brand.id}`, brandFace(row));
}
