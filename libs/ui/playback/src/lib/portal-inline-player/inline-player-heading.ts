import { displayTitle } from '@iptvnator/shared/interfaces';

/** What the title page's player names: the film or show, and the episode. */
export interface InlinePlayerHeading {
    readonly primary: string;
    /** "S1:E2 · Chilean Patagonia"; null for a film. */
    readonly secondary: string | null;
}

export interface InlinePlayerEpisode {
    readonly seasonNumber: number;
    readonly episodeNumber: number;
    /** The provider's episode name, often "Show (2022) ES - S01E02 - Name". */
    readonly title?: string | null;
}

/** "S01E02", "s1 e2", "S1:E2", "S01.E02". */
const SEASON_EPISODE = /\bS(\d{1,3})\s*[.:x-]?\s*E(\d{1,4})\b/i;
/** "1x02". */
const CROSS_CODE = /\b(\d{1,2})x(\d{1,3})\b/i;
const LEADING_SEPARATORS = /^[\s\-–—:|·.,]+/;
/** A name that only repeats the number: "Episode 3", "Capítulo 3". */
const NUMBER_ONLY =
    /^(?:episode|episodio|ep\.?|cap(?:[ií]tulo)?\.?|chapter)?\s*#?\d{1,4}$/i;

/**
 * The episode's own name out of what the provider calls it: the show's
 * name, year, language tag and episode code go, "Chilean Patagonia" stays.
 * Null when nothing of its own is left.
 */
export function episodeOwnName(
    raw: string | null | undefined,
    seriesTitle: string | null | undefined
): string | null {
    let text = (raw ?? '').trim();
    if (!text) {
        return null;
    }
    const code = SEASON_EPISODE.exec(text) ?? CROSS_CODE.exec(text);
    if (code) {
        text = text.slice(code.index + code[0].length);
    } else {
        const show = seriesTitle ? displayTitle(seriesTitle).trim() : '';
        if (show && text.toLowerCase().startsWith(show.toLowerCase())) {
            text = text.slice(show.length);
        }
    }
    text = text.replace(LEADING_SEPARATORS, '').trim();
    if (!text) {
        return null;
    }
    const name = displayTitle(text).trim();
    const show = seriesTitle ? displayTitle(seriesTitle).trim() : '';
    if (
        !name ||
        NUMBER_ONLY.test(name) ||
        (show && name.toLowerCase() === show.toLowerCase())
    ) {
        return null;
    }
    return name;
}

/**
 * The player's heading: the film by its name (no year, no language tag);
 * an episode under its show, as "S1:E2 · Name" (`code` words the
 * "S1:E2" part in the UI's language: "T1:E2" in Spanish).
 */
export function inlinePlayerHeading(options: {
    readonly title: string | null | undefined;
    readonly seriesTitle?: string | null;
    readonly episode?: InlinePlayerEpisode | null;
    readonly code: (season: number, episode: number) => string;
}): InlinePlayerHeading | null {
    const { episode } = options;
    const showRaw = (episode ? options.seriesTitle : null) || options.title;
    const primary = showRaw ? displayTitle(showRaw).trim() : '';
    if (!primary) {
        return null;
    }
    if (!episode) {
        return { primary, secondary: null };
    }
    const code = options.code(
        positive(episode.seasonNumber),
        positive(episode.episodeNumber)
    );
    const name = episodeOwnName(
        episode.title ?? (options.seriesTitle ? options.title : null),
        options.seriesTitle ?? primary
    );
    return { primary, secondary: name ? `${code} · ${name}` : code };
}

function positive(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}
