import type { DashboardHeroSlide } from './dashboard-hero.utils';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** "SEGUIR VIENDO" over an unfinished title; why it is there otherwise. */
export function heroEyebrowKey(slide: DashboardHeroSlide): string {
    return slide.kind === 'continue'
        ? 'WORKSPACE.DASHBOARD.KEEP_WATCHING'
        : slide.reasonLabelKey;
}

/**
 * The line beside the hero's progress bar: where in the show and how much
 * is left ("T2·E5 · Quedan 23 min", "Película · Quedan 38 min"); the
 * programme on air and its hours for a channel; the kind, year and first
 * genre of a discovery pick. Only what the data has.
 */
export function heroMetaParts(
    slide: DashboardHeroSlide,
    translate: Translate
): string[] {
    if (slide.contentType === 'live') {
        return compact([slide.programmeTitle, slide.timeRange]);
    }
    const kind = translate(slide.typeLabelKey);
    if (slide.kind === 'continue') {
        const remaining = slide.primaryAction.remainingLabel;
        return compact([
            slide.episodeBadge ?? kind,
            remaining ? translate(remaining.key, remaining.params) : null,
        ]);
    }
    return compact([
        kind,
        slide.year !== null ? String(slide.year) : null,
        slide.genres[0] ?? null,
    ]);
}

function compact(parts: readonly (string | null | undefined)[]): string[] {
    return parts.filter((part): part is string => !!part && !!part.trim());
}
