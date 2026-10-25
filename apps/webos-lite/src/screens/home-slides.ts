import {
    pickNewReleases,
    type CatalogTitle,
    type PlatformTitle,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { resume, type ResumeEntry } from '../data/resume';
import { t } from '../data/strings';
import { heroMeta, resumeMeta } from '../data/title-meta';
import type { App } from '../app';
import { hueOf } from '../ui/colour';
import { heroBackdrop, type HeroSlide } from '../ui/hero';

/**
 * The Home hero's slides, as the desktop picks them: what the viewer left
 * half-watched first ("SEGUIR VIENDO", Continuar), then what the
 * platforms added lately ("AÑADIDO RECIENTEMENTE"), one per show, the
 * platforms taking turns (pickNewReleases), movies and series in turn.
 * Only titles with a backdrop (their list's, or their page's once asked):
 * a title without one is no slide, never a poster on the stage.
 */
const CONTINUE_SLIDES = 2;
const DISCOVERY = 6;
const MAX_SLIDES = 6;

/** A title's page from what "Continuar" kept of it. */
export function titleOfResume(entry: ResumeEntry): PlatformTitle {
    const id = entry.kind === 'episode' && entry.seriesId ? entry.seriesId : entry.id;
    const title = entry.kind === 'episode' && entry.seriesTitle ? entry.seriesTitle : entry.title;
    return {
        id,
        kind: entry.kind === 'episode' ? 'series' : 'movie',
        categoryId: '',
        title,
        poster: entry.poster,
        language: 'ES',
        added: 0,
        genres: [],
        rating: null,
        plot: null,
        backdrop: null,
        tmdb: null,
        year: null,
        versions: [{ id, categoryId: '', language: 'ES', title }],
    };
}

function continueSlides(app: App): HeroSlide[] {
    const entries = resume
        .recent('movie', CONTINUE_SLIDES)
        .concat(resume.recent('episode', CONTINUE_SLIDES))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, CONTINUE_SLIDES);
    // Their backdrops come from the titles' pages, as the desktop's.
    void app.store.probeBackdrops(entries.map(titleOfResume));
    const slides: HeroSlide[] = [];
    for (const entry of entries) {
        const title = titleOfResume(entry);
        const backdrop = heroBackdrop(app.store, title);
        if (!backdrop) {
            continue;
        }
        slides.push({
            key: `continue:${entry.kind}:${entry.id}`,
            eyebrow: t('WORKSPACE.DASHBOARD.KEEP_WATCHING'),
            platform: null,
            title: title.title,
            meta: resumeMeta(entry),
            progress: entry.duration > 0 ? entry.position / entry.duration : 0,
            backdrop,
            hue: hueOf(title.title),
            actions: [
                {
                    label: t('WORKSPACE.DASHBOARD.HERO_CONTINUE'),
                    icon: 'play',
                    primary: true,
                    run: () => resumeEntry(app, entry),
                },
                { label: t('WORKSPACE.DASHBOARD.HERO_DETAILS'), icon: 'info', run: () => app.openTitle(title) },
            ],
        });
    }
    return slides;
}

export function resumeEntry(app: App, entry: ResumeEntry): void {
    app.play({
        items: [
            {
                kind: entry.kind,
                id: entry.id,
                title: entry.title,
                subtitle: entry.kind === 'episode' ? resumeMeta(entry) : null,
                extension: entry.extension,
                poster: entry.poster,
                seriesId: entry.seriesId,
                seriesTitle: entry.seriesTitle,
                season: entry.season,
                episode: entry.episode,
            },
        ],
        index: 0,
        startAt: entry.position,
    });
}

/** Movies and series in turn, each list's own order kept. */
function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
    const out: T[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i]) {
            out.push(a[i]);
        }
        if (b[i]) {
            out.push(b[i]);
        }
    }
    return out;
}

/** What the platforms added lately that has a backdrop: the others are left out. */
export function discoveryTitles(app: App, lead: number): CatalogTitle[] {
    const picks = interleave(
        pickNewReleases(app.store.titles('movie'), DISCOVERY, lead),
        pickNewReleases(app.store.titles('series'), DISCOVERY, lead)
    );
    void app.store.probeBackdrops(picks);
    return picks.filter((title) => !!heroBackdrop(app.store, title));
}

export function discoverySlide(app: App, title: CatalogTitle): HeroSlide {
    return {
        key: `new:${title.kind}:${title.id}`,
        eyebrow: t('WORKSPACE.DASHBOARD.HERO_RECENTLY_ADDED'),
        platform: title.platform,
        title: title.title,
        meta: heroMeta(title),
        backdrop: heroBackdrop(app.store, title),
        hue: hueOf(title.title),
        actions: [
            { label: t('WORKSPACE.DASHBOARD.HERO_DETAILS'), icon: 'info', primary: true, run: () => app.openTitle(title) },
        ],
    };
}

export function homeSlides(app: App, lead: number): HeroSlide[] {
    const slides = continueSlides(app);
    for (const title of discoveryTitles(app, lead)) {
        if (slides.length >= MAX_SLIDES) {
            break;
        }
        slides.push(discoverySlide(app, title));
    }
    return slides;
}
