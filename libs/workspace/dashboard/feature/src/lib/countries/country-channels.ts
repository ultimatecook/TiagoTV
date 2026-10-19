import { displayChannelName } from '@iptvnator/shared/interfaces';
import { stripWindow } from './country-slots';
import { tidyTitle } from './country-titles';

/**
 * A country's channels, one tile per channel: providers list a channel
 * several times over ("|ARG| C5N", "|ARG| C5N ᴴᴰ", "|ES| La 1 ᵁᴴᴰ",
 * "|ES| La 1 ᴴᴰ"). The copies share a tile, the best one plays and the
 * others sit behind a chip each in the player's panel, named by their
 * quality.
 */
export type ChannelQuality = 'UHD' | 'FHD' | 'HD' | 'SD';

export interface CountryChannel {
    readonly streamId: number;
    readonly categoryId: string;
    /** The channel's own name, without country and quality tags. */
    readonly title: string;
    readonly icon: string | null;
    readonly quality: ChannelQuality | null;
}

export interface CountryChannelGroup {
    readonly key: string;
    readonly title: string;
    /** An event channel's competition ("Premier League"). */
    readonly subtitle: string | null;
    /** The copies' logos, the commonest first. */
    readonly icons: readonly string[];
    /** The copy that plays first, then the others. */
    readonly copies: readonly CountryChannel[];
}

export interface CountryChannelInput {
    readonly streamId: number;
    readonly categoryId: string;
    readonly name: string;
    readonly icon: string | null;
}

/** Superscript badges and notes: "ᵁᴴᴰ", "ᴾᵁᴱᴿᵀᴼ ᴿⁱᶜᵒ", "ᴱᶜᵘᵃᵈᵒʳ". */
const SUPERSCRIPTS = /[ʰ-˿ᴬ-ᶿ⁰-₟]+/g;
const STRAY_SEPARATORS = /^[\s|:\-–·▎.]+|[\s|:\-–·▎.]+$|\s+:\)$/g;
/** A code before a note on the feed: "US (P+) Argentina Liga …". */
const CODE_WITH_NOTE = /^\s*[A-Z]{2,3}\s*\([^)]{1,4}\)\s+/;
const QUALITY_RANK: Record<ChannelQuality, number> = {
    UHD: 0,
    FHD: 1,
    HD: 2,
    SD: 4,
};

/** The quality a provider writes on a copy, in badges or in words. */
export function channelQuality(raw: string): ChannelQuality | null {
    if (raw.includes('ᵁᴴᴰ') || /\b(uhd|4k)\b/i.test(raw)) {
        return 'UHD';
    }
    if (raw.includes('ᶠᴴᴰ') || /\bfhd\b/i.test(raw)) {
        return 'FHD';
    }
    if (raw.includes('ᴴᴰ') || /\bhd\b/i.test(raw)) {
        return 'HD';
    }
    return raw.includes('ˢᴰ') || /\bsd\b/i.test(raw) ? 'SD' : null;
}

/**
 * The shared cleaning (see displayChannelName), then the country's codes
 * the providers add in their own ways: "CHL Canal 13", "PE ▎LIGA1",
 * "PRI: WAPA", "Televicentro TVC EC", "APTN (CA)".
 */
export function countryChannelName(
    raw: string,
    codes: readonly string[]
): { title: string; subtitle: string | null } {
    const { title, subtitle } = displayChannelName(raw);
    const { leading, trailing } = codePatterns(codes);
    const cleaned = stripWindow(title)
        .replace(SUPERSCRIPTS, ' ')
        .replace(CODE_WITH_NOTE, '')
        // "DAZN LIGA 1 HD B": the backup's badge.
        .replace(/\s+(?:U?HD|FHD|SD)(?=\s+B$)/, '')
        .replace(leading, '')
        .replace(trailing, '')
        .replace(/\s{2,}/g, ' ')
        .replace(STRAY_SEPARATORS, '');
    return { title: cleaned || title, subtitle };
}

/** The copies of each channel together, in the provider's order. */
export function groupCountryChannels(
    inputs: readonly CountryChannelInput[],
    codes: readonly string[]
): CountryChannelGroup[] {
    const groups = new Map<
        string,
        { names: string[]; subtitle: string | null; copies: CountryChannel[] }
    >();
    for (const input of inputs) {
        const { title, subtitle } = countryChannelName(input.name, codes);
        const key = `${groupKey(title)}|${groupKey(subtitle ?? '')}`;
        const group = groups.get(key) ?? { names: [], subtitle, copies: [] };
        group.names.push(title);
        group.copies.push({
            streamId: input.streamId,
            categoryId: input.categoryId,
            title,
            icon: input.icon,
            quality: channelQuality(input.name),
        });
        groups.set(key, group);
    }

    const result: CountryChannelGroup[] = [];
    groups.forEach((group, key) => {
        const title = tidyTitle(tidiest(group.names));
        const subtitle = group.subtitle && tidyTitle(group.subtitle);
        result.push(withCopies(key, title, subtitle, group.copies));
    });
    return result;
}

/**
 * One channel listed in two categories of a country ("La 1" in "SPAIN"
 * and in "4K"): the first keeps its name and gains the other's copies.
 */
export function mergeChannelGroups(
    first: CountryChannelGroup,
    other: CountryChannelGroup
): CountryChannelGroup {
    const streams = new Set(first.copies.map((copy) => copy.streamId));
    const added = other.copies.filter((copy) => !streams.has(copy.streamId));
    return withCopies(first.key, first.title, first.subtitle, [
        ...first.copies,
        ...added,
    ]);
}

function withCopies(
    key: string,
    title: string,
    subtitle: string | null,
    copies: readonly CountryChannel[]
): CountryChannelGroup {
    const sorted = [...copies].sort(
        (a, b) => rank(a) - rank(b) || Number(!a.icon) - Number(!b.icon)
    );
    return {
        key,
        title,
        subtitle,
        icons: byFrequency(sorted.map((copy) => copy.icon)),
        copies: sorted.map((copy) => ({ ...copy, title })),
    };
}

/**
 * A chip per copy: its quality ("UHD", "HD"), numbered where two share
 * one ("HD", "HD 2"); a copy without a badge by its place ("1", "2").
 */
export function copyLabels(copies: readonly CountryChannel[]): string[] {
    const seen = new Map<string, number>();
    return copies.map((copy, index) => {
        if (!copy.quality) {
            return String(index + 1);
        }
        const count = (seen.get(copy.quality) ?? 0) + 1;
        seen.set(copy.quality, count);
        return count === 1 ? copy.quality : `${copy.quality} ${count}`;
    });
}

const PATTERNS = new Map<string, { leading: RegExp; trailing: RegExp }>();

/** The codes as written, in capitals: "ES BBC Drama", "CHL Canal 13". */
function codePatterns(codes: readonly string[]) {
    const all = codes.join('|');
    let patterns = PATTERNS.get(all);
    if (!patterns) {
        patterns = {
            leading: new RegExp(
                `^\\s*\\|?\\s*(?:${all})(?:\\s*[|:▎\\-–]+|\\s+(?=\\S))\\s*`
            ),
            trailing: new RegExp(`\\s+\\(?(?:${all})\\)?$`),
        };
        PATTERNS.set(all, patterns);
    }
    return patterns;
}

function rank(channel: CountryChannel): number {
    return channel.quality ? QUALITY_RANK[channel.quality] : 3;
}

function groupKey(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9+]+/g, ' ')
        .trim();
}

/** The tidiest spelling: one in mixed case first, then the shortest. */
function tidiest(names: readonly string[]): string {
    const capitals = (name: string) => Number(name === name.toUpperCase());
    return [...names].sort(
        (a, b) => capitals(a) - capitals(b) || a.length - b.length
    )[0];
}

function byFrequency(values: readonly (string | null)[]): string[] {
    const counts = new Map<string, number>();
    for (const value of values) {
        if (value) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
    }
    return [...counts.keys()].sort(
        (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
    );
}
