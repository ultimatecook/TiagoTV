import type {
    CatalogTitle,
    PlatformTitle,
    SportSection,
    StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h, picture } from '../core/dom';
import { queueImage } from '../core/image-queue';
import { assetUrl, tmdbSized } from '../data/images';
import type { LiveChannel } from '../data/live';
import type { RecentChannel } from '../data/recent-channels';
import { hueOf, tint } from './colour';

/**
 * The cards rows lay out, after the desktop's: platform logo cards,
 * league cards with a player cut-out, posters and 16:9 tiles with the
 * platform's logo and the title in Bebas on the artwork, the Top 10's
 * outlined numbers, channel cards. Sizes are fixed per kind (rows compute
 * positions from them) and match cards.css.
 */
export const CARD = {
    platform: { width: 300, gap: 22 },
    league: { width: 300, gap: 22 },
    poster: { width: 220, gap: 22 },
    landscape: { width: 400, gap: 22 },
    top10: { width: 470, gap: 18 },
    channel: { width: 280, gap: 20 },
    recent: { width: 384, gap: 22 },
} as const;

/** A platform's logo (or its name in its colour) for a card or a hero. */
export function platformMark(platform: StreamingPlatform | null, className: string): HTMLElement | null {
    if (!platform) {
        return null;
    }
    const logo = assetUrl(platform.logo);
    if (logo) {
        const tone = platform.logoTone === 'white' ? ' mark--white' : '';
        return h('img', { className: `${className} mark${tone}`, attrs: { src: logo, alt: platform.name } });
    }
    const name = h('span', { className: `${className} mark mark--name`, text: platform.name });
    name.style.color = platform.wordmarkColor;
    return name;
}

/** "Plataformas": the brand's colours, its logo centred. */
export function platformCard(platform: StreamingPlatform): HTMLElement {
    const card = h('div', 'card--platform', platformMark(platform, 'platform__logo'));
    card.style.background = platform.background;
    return card;
}

const LEAGUE_H = 430;

/** The desktop's tint, lit from above, darker toward the floor. */
function leagueBackground(section: SportSection): string {
    const lit = tint(section.tint, '#9fb4ff', 0.18, 0.6);
    const top = tint(section.tint, '#000000', 0.15, 1);
    return `radial-gradient(110% 70% at 50% 18%, ${lit} 0%, rgba(0,0,0,0) 68%), linear-gradient(180deg, ${top} 0%, #05060a 100%)`;
}

/** "Deportes": a player standing on the competition's colour, its logo. */
export function leagueCard(section: SportSection, live: number): HTMLElement {
    const art = h('img', { className: 'league__art', attrs: { alt: '' } });
    art.onerror = () => art.removeAttribute('src');
    const image = assetUrl(section.image);
    if (image) {
        queueImage(art, image);
    }
    // The cut-out's height in card heights, every head at the same place:
    // a tenth of the card over its top (the frame starts 60px above it).
    art.style.height = `${Math.round(LEAGUE_H * section.artHeight)}px`;
    art.style.top = `${Math.round(LEAGUE_H * (0.04 - section.artHeadroom * section.artHeight))}px`;
    art.style.left = `${section.artX}%`;
    const logo = assetUrl(section.logo);
    const card = h(
        'div',
        'card--league',
        h('div', 'league__figure', art),
        h('div', 'league__shade'),
        logo
            ? h('img', { className: 'league__logo', attrs: { src: logo, alt: section.title } })
            : h('span', { className: 'league__label display', text: section.title }),
        live > 0 ? h('span', 'league__live', h('i', 'dot'), String(live)) : null
    );
    const logoEl = card.querySelector('.league__logo') as HTMLElement | null;
    if (logoEl) {
        logoEl.style.height = `${Math.round(84 * section.logoSize)}px`;
    }
    card.style.background = leagueBackground(section);
    return card;
}

export interface TitleCardModel {
    readonly title: PlatformTitle | CatalogTitle;
    readonly platform: StreamingPlatform | null;
    readonly meta?: string;
    /** 0–1 watched, for "Seguir viendo". */
    readonly progress?: number;
}

function progressBar(progress: number | undefined): HTMLElement | null {
    if (!progress || progress <= 0) {
        return null;
    }
    const bar = h('div', 'card__progress-bar');
    bar.style.width = `${Math.round(Math.min(1, progress) * 100)}%`;
    return h('div', 'card__progress', bar);
}

/** A poster: its art, the platform's logo and the title on it, meta under. */
export function posterCard(model: TitleCardModel): HTMLElement {
    const title = model.title;
    return h(
        'div',
        'card--poster',
        h(
            'div',
            'poster__art',
            picture(tmdbSized(title.poster, 'w342'), 'poster__pic', ''),
            h('div', 'art__veil'),
            h('div', 'art__text', platformMark(model.platform, 'art__brand'), h('div', { className: 'art__title display', text: title.title }))
        ),
        progressBar(model.progress),
        model.meta ? h('div', { className: 'card__meta', text: model.meta }) : null
    );
}

/** A 16:9 tile: the backdrop (or the poster), the name on the artwork. */
export function landscapeCard(model: TitleCardModel): HTMLElement {
    const title = model.title;
    const image = title.backdrop ? tmdbSized(title.backdrop, 'w500') : tmdbSized(title.poster, 'w342');
    return h(
        'div',
        `card--landscape${title.backdrop ? '' : ' is-poster'}`,
        picture(image, 'landscape__pic', ''),
        h('div', 'art__veil'),
        h('div', 'art__text', platformMark(model.platform, 'art__brand'), h('div', { className: 'art__title display', text: title.title })),
        progressBar(model.progress)
    );
}

/** "Top 10": the big outlined number beside the poster. */
export function top10Card(model: TitleCardModel, rank: number): HTMLElement {
    return h(
        'div',
        'card--top10',
        h('span', { className: 'top10__rank display', text: String(rank) }),
        h(
            'div',
            'top10__poster',
            picture(tmdbSized(model.title.poster, 'w342'), 'poster__pic', ''),
            h('div', 'art__veil'),
            h(
                'div',
                'art__text',
                platformMark(model.platform, 'art__brand'),
                h('div', { className: 'art__title display', text: model.title.title }),
                model.meta ? h('div', { className: 'art__meta', text: model.meta }) : null
            )
        )
    );
}

/** A channel's thumbnail: its logo, or its name in Bebas on its colour. */
export function channelThumb(title: string, logo: string | null, className: string): HTMLElement {
    const thumb = h('div', className, h('span', { className: 'thumb__name display', text: title }));
    thumb.style.background = `linear-gradient(160deg, hsl(${hueOf(title)},32%,30%) 0%, hsl(${hueOf(title)},30%,16%) 100%)`;
    if (logo) {
        const img = picture(logo, 'thumb__logo', '');
        thumb.appendChild(img);
        thumb.classList.add('has-logo');
    }
    return thumb;
}

/** En vivo's and a league's channel cards: glass, logo, name, row. */
export function channelCard(channel: LiveChannel, caption: string, playing: boolean): HTMLElement {
    return h(
        'div',
        `card--channel${playing ? ' is-playing' : ''}`,
        channelThumb(channel.title, channel.logo, 'channel__thumb'),
        h('span', { className: 'channel__playing', text: 'REPRODUCIENDO' }),
        h('div', { className: 'channel__name', text: channel.title }),
        h('div', { className: 'channel__caption', text: caption })
    );
}

/** "Últimos canales vistos": a 16:9 thumbnail, the name, the line under. */
export function recentCard(channel: RecentChannel): HTMLElement {
    return h(
        'div',
        'card--recent',
        channelThumb(channel.title, channel.logo, 'recent__thumb'),
        channel.country ? h('img', { className: 'recent__flag', attrs: { src: `img/flags/${channel.country.toLowerCase()}.svg`, alt: '' } }) : null,
        h('div', { className: 'recent__name', text: channel.title }),
        channel.subtitle ? h('div', { className: 'recent__sub', text: channel.subtitle }) : null
    );
}
