import type {
    PlatformTitle,
    PlatformTitleVersion,
} from '../platforms/platform-titles';
import type {
    StreamingPlatform,
    StreamingPlatformId,
} from '../platforms/streaming-platforms';

/**
 * Series / Películas mix every platform's titles: no platform may fill the
 * page for being the biggest or the most recently updated one (Netflix,
 * with the real provider). The platforms take turns, and a show filed on
 * several platforms counts for the one that carries fewer titles.
 */
export interface Credited {
    readonly platform: StreamingPlatform;
}

/**
 * The titles with the platforms taking turns: each platform's first, then
 * each one's second… The platform of the first title leads every round
 * (or the `lead`-th platform, in that order); each platform's titles keep
 * their order (newest first). `count` stops it early.
 */
export function takeTurns<T extends Credited>(
    titles: readonly T[],
    count = Infinity,
    lead = 0
): T[] {
    const queues = new Map<StreamingPlatformId, T[]>();
    for (const title of titles) {
        const queue = queues.get(title.platform.id);
        if (queue) {
            queue.push(title);
        } else {
            queues.set(title.platform.id, [title]);
        }
    }
    const turns = [...queues.values()];
    const size = turns.length;
    const start = size > 0 ? ((Math.trunc(lead || 0) % size) + size) % size : 0;
    const order = turns.slice(start).concat(turns.slice(0, start));
    const picked: T[] = [];
    for (let round = 0; picked.length < count; round++) {
        const takers = order.filter((queue) => round < queue.length);
        if (takers.length === 0) {
            break;
        }
        for (const queue of takers) {
            if (picked.length < count) {
                picked.push(queue[round]);
            }
        }
    }
    return picked;
}

/**
 * The platform a show counts for, of those that carry it (`platforms`, the
 * shown version's first): of the ones with a version in the language
 * shown, the one with the fewest titles (`sizes`), the first on a tie. The
 * title then shows, and opens, that platform's version.
 */
export function creditPlatform<T extends PlatformTitle>(
    title: T,
    platforms: readonly StreamingPlatform[],
    platformsOf: (version: PlatformTitleVersion) => readonly StreamingPlatform[],
    sizes: ReadonlyMap<StreamingPlatformId, number>
): { readonly title: T; readonly platform: StreamingPlatform } {
    const shown = platforms[0];
    const versionOn = (platform: StreamingPlatform) =>
        title.versions.find(
            (version) =>
                version.language === title.language &&
                platformsOf(version).includes(platform)
        );
    let credited = shown;
    for (const candidate of platforms) {
        if (
            (sizes.get(candidate.id) ?? 0) < (sizes.get(credited.id) ?? 0) &&
            versionOn(candidate)
        ) {
            credited = candidate;
        }
    }
    const version = credited === shown ? undefined : versionOn(credited);
    if (!version) {
        return { title, platform: shown };
    }
    return {
        title: {
            ...title,
            id: version.id,
            categoryId: version.categoryId,
            title: version.title,
            versions: [
                version,
                ...title.versions.filter((other) => other !== version),
            ],
        },
        platform: credited,
    };
}
