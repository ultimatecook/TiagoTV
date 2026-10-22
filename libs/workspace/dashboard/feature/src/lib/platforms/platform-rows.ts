import { genreLabelKey, type PlatformGenre } from './platform-genres';
import { seededUnit } from './platform-seed';
import { titleKey, type PlatformTitle } from './platform-titles';

export interface PlatformRow {
    readonly id: string;
    readonly labelKey: string;
    readonly labelParams?: Readonly<Record<string, string>>;
    /** What the row shows, in its order: by rank in a ranked row. */
    readonly titles: readonly PlatformTitle[];
    /** What its "See all" opens, when that is more than the row shows. */
    readonly all?: readonly PlatformTitle[];
    /** A "Top 10": each title carries its place, the best first. */
    readonly ranked?: boolean;
}

export interface PlatformRowOptions {
    /** Adds Netflix's "Top 10 on Netflix" row after what is new. */
    readonly top10Of?: string;
    /** The hero's titles, which the rows beside it leave out. */
    readonly hero?: readonly PlatformTitle[];
    /** The day's seed (`daySeed`): the rows' mix of the day. */
    readonly seed?: number;
}

/** The newest-titles row shows the latest additions only. */
const NEWEST_LIMIT = 30;
/** Titles a row lays out; "See all" opens the rest. */
const ROW_LIMIT = 40;
/**
 * The movies, series and genre rows need this many titles the page has
 * not shown higher up, so that each opens on titles of its own; in a
 * small catalog, what is new already shows them all.
 */
const MIN_FRESH = 6;
const GENRE_ROW_LIMIT = 10;
/** The Top 10 ranks the best rated of the platform's recent titles. */
const TOP_POOL = 150;
const TOP_COUNT = 10;
const TOP_MIN = 3;
/** A title shows in two of the page's rows at most. */
const MAX_ROWS_PER_TITLE = 2;
/** How far the day's draw moves a title in the rated rows' order. */
const DAILY_SPREAD = 2;
/** What an unrated title counts as there: a middling rating. */
const UNRATED = 6;

interface RowRules {
    readonly limit?: number;
    readonly min?: number;
    /** Titles the page has not shown yet it needs, to open on new ones. */
    readonly fresh?: number;
    /** A ranked row keeps its order; the others show unseen titles first. */
    readonly ranked?: boolean;
    /** The rows beside the hero leave its titles out. */
    readonly besideHero?: boolean;
}

/**
 * The platform page's rows, as the platforms lay out their own: what is
 * new, (Netflix's Top 10), its movies, its series, then its genres, the
 * largest first. Beside the hero, the rows leave its titles out; a title
 * shows in two places at most (the hero counts as one), and each row puts
 * the titles the page has not shown yet first. Only "new" goes by date:
 * the others by rating, each row mixed by its own draw of the day, and
 * need six titles of their own. A genre row holds only its genre's. A
 * platform of one kind (Hulu, Apple TV: series only) lists its genres
 * before its one kind's row, so a mid-size catalog shows them too.
 */
export function buildPlatformRows(
    titles: readonly PlatformTitle[],
    options: PlatformRowOptions = {}
): PlatformRow[] {
    const seed = options.seed ?? 0;
    const hero = new Set((options.hero ?? []).map(titleKey));
    // The hero counts as one of a title's two places.
    const uses = new Map<string, number>([...hero].map((key) => [key, 1]));
    const rows: PlatformRow[] = [];
    const add = (
        row: Omit<PlatformRow, 'titles' | 'all'>,
        list: readonly PlatformTitle[],
        rules: RowRules = {}
    ): void => {
        const open = list.filter(
            (title) =>
                (uses.get(titleKey(title)) ?? 0) < MAX_ROWS_PER_TITLE &&
                !(rules.besideHero && hero.has(titleKey(title)))
        );
        // Unranked, a row keeps its order within: what the page has not
        // shown, then what another row has, then the hero's titles.
        const place = (title: PlatformTitle) =>
            hero.has(titleKey(title)) ? 2 : uses.has(titleKey(title)) ? 1 : 0;
        const ordered = rules.ranked
            ? open
            : [...open].sort((a, b) => place(a) - place(b));
        const shown = ordered.slice(0, rules.limit ?? ROW_LIMIT);
        const fresh = shown.filter((title) => !uses.has(titleKey(title)));
        if (
            shown.length < (rules.min ?? 1) ||
            fresh.length < (rules.fresh ?? 0)
        ) {
            return;
        }
        for (const title of shown) {
            const key = titleKey(title);
            uses.set(key, (uses.get(key) ?? 0) + 1);
        }
        rows.push({ ...row, titles: shown, all: list });
    };

    add(
        { id: 'newest', labelKey: 'WORKSPACE.PLATFORMS.NEWEST' },
        titles.slice(0, NEWEST_LIMIT),
        { besideHero: true }
    );
    if (options.top10Of) {
        add(
            {
                id: 'top10',
                labelKey: 'WORKSPACE.PLATFORMS.TOP10',
                labelParams: { platform: options.top10Of },
                ranked: true,
            },
            topRated(titles.filter((title) => !hero.has(titleKey(title)))),
            { ranked: true, besideHero: true, min: TOP_MIN }
        );
    }
    const kinds = [
        ['movies', 'WORKSPACE.PLATFORMS.MOVIES', 'movie'],
        ['series', 'WORKSPACE.PLATFORMS.SERIES', 'series'],
    ] as const;
    const kindRows = kinds.filter(([, , kind]) =>
        titles.some((title) => title.kind === kind)
    );
    const addKindRows = () => {
        for (const [id, labelKey, kind] of kindRows) {
            add(
                { id, labelKey },
                byDailyRating(
                    titles.filter((title) => title.kind === kind),
                    seed,
                    id
                ),
                { fresh: MIN_FRESH }
            );
        }
    };
    // A platform of one kind (series only): its genres first, which a row
    // of everything it carries would leave without titles of their own.
    const genresFirst = kindRows.length === 1;
    if (!genresFirst) {
        addKindRows();
    }

    const byGenre = new Map<PlatformGenre, PlatformTitle[]>();
    for (const title of titles) {
        for (const genre of title.genres) {
            const list = byGenre.get(genre) ?? [];
            list.push(title);
            byGenre.set(genre, list);
        }
    }
    const genreRows = rows.length;
    [...byGenre.entries()]
        .filter(([, list]) => list.length >= MIN_FRESH)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([genre, list]) => {
            if (rows.length - genreRows < GENRE_ROW_LIMIT) {
                add(
                    { id: `genre-${genre}`, labelKey: genreLabelKey(genre) },
                    byDailyRating(list, seed, genre),
                    { fresh: MIN_FRESH }
                );
            }
        });
    if (genresFirst) {
        addKindRows();
    }
    return rows;
}

/** The best rated of the recent titles with a poster, newest on a tie. */
export function topRated(titles: readonly PlatformTitle[]): PlatformTitle[] {
    return titles
        .slice(0, TOP_POOL)
        .filter((title) => title.poster && (title.rating ?? 0) > 0)
        .map((title, index) => ({ title, index }))
        .sort(
            (a, b) =>
                (b.title.rating ?? 0) - (a.title.rating ?? 0) ||
                a.index - b.index
        )
        .slice(0, TOP_COUNT)
        .map(({ title }) => title);
}

/**
 * The best rated first, each title moved by up to two points by the
 * day's draw (one per `draw`, a row's own): well rated titles lead, not
 * always the same ones.
 */
export function byDailyRating(
    titles: readonly PlatformTitle[],
    seed: number,
    draw = ''
): PlatformTitle[] {
    return titles
        .map((title) => ({
            title,
            score:
                (title.rating ?? UNRATED) +
                DAILY_SPREAD * seededUnit(seed, `${draw}|${titleKey(title)}`),
        }))
        .sort((a, b) => b.score - a.score || b.title.added - a.title.added)
        .map(({ title }) => title);
}
