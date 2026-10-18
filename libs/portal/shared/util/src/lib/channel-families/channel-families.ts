/**
 * TiagoTV: a provider lists one channel many times over, from several
 * sources and in several spellings ("LaLiga Hypermotion TV 2",
 * "|ES| LA LIGATV 2 HYPERMOTION", "HYPERMOTION 2 HD Orange"). A family is
 * one channel brand with its numbered feeds; each feed keeps its copies
 * (other sources, the provider's "B" backups) behind the one that plays.
 *
 * The Home's sports views and the live player's "other feeds" strip both
 * read channels this way, so the naming rules live here.
 */
export interface FamilyChannel {
    /** The provider's name, raw or without its tags ("|ARG| ESPN 2"). */
    readonly title: string;
    readonly icon: string | null;
}

export interface ChannelFeed<T extends FamilyChannel = FamilyChannel> {
    /** The feed's number ("… Hypermotion 3"); an unnumbered feed is 1. */
    readonly number: number;
    /** The copy that plays first, then its alternates. */
    readonly channels: readonly T[];
}

export interface ChannelFamily<T extends FamilyChannel = FamilyChannel> {
    readonly key: string;
    /** A readable name: "LaLiga TV Hypermotion", "DAZN LaLiga". */
    readonly name: string;
    /**
     * Its copies' logos, the one most of them carry first; the next ones
     * stand in when a logo does not load.
     */
    readonly icons: readonly string[];
    readonly feeds: readonly ChannelFeed<T>[];
}

export interface ChannelNameParts {
    /** The family's key: lower-case, without feed number or tags. */
    readonly key: string;
    readonly feed: number | null;
    /** A provider's backup copy ("DAZN LIGA 1 HD B"). */
    readonly backup: boolean;
}

/** Superscript quality and country tags: "ᵁᴴᴰ", "ᶠᴴᴰ", "ᴬᴿᴳᴱᴺᵀᴵᴺᴬ". */
const SUPERSCRIPTS = /[ʰ-˿ᴬ-ᶿ⁰-₟]+/g;
const NOTES = /\([^)]*\)|\[[^\]]*\]/g;
/** "|ES|", "|ES-P|", "ES:", "UK|", "CAR - ", "ES-LALIGA", "CHL TyC". */
const REGION_PREFIXES = [
    /^\s*\|[^|]{1,14}\|\s*/,
    /^\s*\|?[A-Za-z]{2,7}\s*-\s+/,
    /^\s*[A-Z]{2,3}(-[A-Z])?\s*[:|]\s*/,
    /^\s*[A-Z]{2}-(?=[A-Z])/,
    /^\s*(es|uk|chl?|arg|mx)\s+(?=\S)/i,
];
const QUALITY =
    /\b(uhd|fhd|hd|sd|4k|hevc|sat|hdr|ultra|50 ?fps|1080p?|720p?|orange)\b/g;
const TRAILING_REGION = /\s(us|usa|uk|es|co|ec|cl|arg|mx|pe|uy|lat|lam)$/;
/** The same codes at the end of a name as written: "Fox Sports Sun HD US". */
const TRAILING_REGION_TAG = new RegExp(TRAILING_REGION.source, 'i');

/** Spellings of one brand, in order (each sees the previous ones' output). */
const ALIASES: readonly [RegExp, string][] = [
    [/^\+\s*/, 'm+ '],
    [/\bmovistar\s*\+?\s*/g, 'm+ '],
    [/^m(\s*[.+]\s*|\s+)/, 'm+ '],
    [/\bla\s*liga(\s*tv)?\b/g, 'laliga'],
    [/\bhyper(motion)?\b/g, 'hypermotion'],
    [/^(m\+ )?hypermotion\b/, '$1laliga hypermotion'],
    [/\bdaznt\b/g, 'dazn'],
    [/\bdazn liga\b/g, 'dazn laliga'],
    [/\bacb league\b/g, 'dazn acb'],
    [/\b(liga de )?l?campeon(es)?\b/g, 'liga de campeones'],
    [/\bformula ?1\b/g, 'f1'],
    [/\bsky f1\b/g, 'sky sports f1'],
    [/\b(espn|dazn)(\d{1,2})\b/g, '$1 $2'],
    [/\bdirect? ?tv\b/g, 'directv'],
    [/\bd ?sports\b/g, 'directv sports'],
    [/\b(bein|fox|sky|tnt|tyc|directv|espn) sport\b/g, '$1 sports'],
    [/\btv\b/g, ' '],
];

export function parseChannelName(title: string): ChannelNameParts {
    let name = title.replace(SUPERSCRIPTS, ' ').replace(NOTES, ' ');
    for (const prefix of REGION_PREFIXES) {
        name = name.replace(prefix, '');
    }
    name = name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9+.]+/g, ' ')
        .replace(QUALITY, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(TRAILING_REGION, '');

    const backup = /\sb$/.test(name);
    if (backup) {
        name = name.slice(0, -2);
    }
    for (const [pattern, replacement] of ALIASES) {
        name = name.replace(pattern, replacement);
    }
    name = name.replace(/[.]+/g, ' ').replace(/\s+/g, ' ').trim();

    // One number is the feed's; several belong to an event's name
    // ("UEFA | 01 - AZ Alkmaar vs … 17:45").
    const numbers = name.split(' ').filter((word) => /^\d{1,2}$/.test(word));
    if (numbers.length !== 1) {
        return { key: name, feed: null, backup };
    }
    const key = name
        .split(' ')
        .filter((word) => word !== numbers[0])
        .join(' ');
    return { key: key || name, feed: Number(numbers[0]), backup };
}

/** The families whose display name is known better than its spellings. */
const KNOWN_NAMES: Record<string, string> = {
    'laliga hypermotion': 'LaLiga TV Hypermotion',
    'dazn laliga': 'DAZN LaLiga',
    'm+ laliga': 'M+ LaLiga TV',
    'm+ liga de campeones': 'Movistar Liga de Campeones',
    'm+ primera federacion': 'Movistar Primera Federación',
    'm+ deportes': 'Movistar Deportes',
    'dazn acb': 'DAZN ACB',
    espn: 'ESPN',
    'espn premium': 'ESPN Premium',
    'espn extra': 'ESPN Extra',
    'fox sports': 'FOX Sports',
    'fox sports premium': 'FOX Sports Premium',
    'tyc sports': 'TyC Sports',
    'tyc sports internacional': 'TyC Sports Internacional',
    'tnt sports': 'TNT Sports',
    'directv sports': 'DSports',
    'directv sports plus': 'DSports Plus',
    'bein sports': 'beIN Sports',
    'dazn f1': 'DAZN F1',
    'sky sports f1': 'Sky Sports F1',
    laliga: 'LaLiga TV',
    nba: 'NBA TV',
    f1: 'F1',
};

/** Words written their brand's way when a name comes in capitals. */
const WORDS: Record<string, string> = {
    laliga: 'LaLiga',
    'laliga+': 'LaLiga+',
    dazn: 'DAZN',
    espn: 'ESPN',
    'espn+': 'ESPN+',
    nba: 'NBA',
    acb: 'ACB',
    acc: 'ACC',
    ppv: 'PPV',
    uefa: 'UEFA',
    tnt: 'TNT',
    tyc: 'TyC',
    bein: 'beIN',
    'm+': 'M+',
    motogp: 'MotoGP',
    f1: 'F1',
    atp: 'ATP',
    wta: 'WTA',
    nfl: 'NFL',
    tv: 'TV',
    directv: 'DIRECTV',
};

/** The name a family is known by ("LaLiga TV Hypermotion"), if any. */
export function knownFamilyName(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(KNOWN_NAMES, key)
        ? KNOWN_NAMES[key]
        : null;
}

export function channelFamilyName(
    key: string,
    titles: readonly string[]
): string {
    const known = knownFamilyName(key);
    if (known) {
        return known;
    }
    // The tidiest spelling: one written in mixed case, then the shortest.
    const spellings = titles
        .map(displaySpelling)
        .filter((spelling) => spelling.length > 0)
        .sort(
            (a, b) =>
                Number(isCapitals(a)) - Number(isCapitals(b)) ||
                a.length - b.length
        );
    const best = spellings[0] ?? key;
    return isCapitals(best) ? titleCase(best) : best;
}

export function groupChannelFamilies<T extends FamilyChannel>(
    channels: readonly T[]
): ChannelFamily<T>[] {
    const families = new Map<string, Map<number, T[]>>();
    const backups = new Set<T>();
    for (const channel of channels) {
        const parts = parseChannelName(channel.title);
        const feeds = families.get(parts.key) ?? new Map();
        const number = parts.feed ?? 1;
        feeds.set(number, [...(feeds.get(number) ?? []), channel]);
        families.set(parts.key, feeds);
        if (parts.backup) {
            backups.add(channel);
        }
    }

    const result: ChannelFamily<T>[] = [];
    for (const [key, feeds] of families) {
        const copies = [...feeds.values()].reduce<T[]>(
            (all, feed) => all.concat(feed),
            []
        );
        result.push({
            key,
            name: channelFamilyName(
                key,
                copies.map((channel) => channel.title)
            ),
            icons: byFrequency(copies.map((channel) => channel.icon)),
            feeds: [...feeds.entries()]
                .sort(([a], [b]) => a - b)
                .map(([number, feed]) => ({
                    number,
                    // The copy that plays: no backup, one with a logo.
                    channels: [...feed].sort(
                        (a, b) =>
                            Number(backups.has(a)) - Number(backups.has(b)) ||
                            Number(!a.icon) - Number(!b.icon)
                    ),
                })),
        });
    }
    return result.sort(
        (a, b) =>
            b.feeds.length - a.feeds.length || a.name.localeCompare(b.name)
    );
}

/** "LaLiga TV Hypermotion 3": the family's name and the feed's number. */
export function feedTitle(
    family: Pick<ChannelFamily, 'name'>,
    channel: FamilyChannel
): string {
    const { feed } = parseChannelName(channel.title);
    return feed === null ? family.name : `${family.name} ${feed}`;
}

/**
 * Logos drawn in white, which need a dark plate: DAZN's, and the channel
 * logos Prime Video files (its "LCXO station logos").
 */
export function hasWhiteLogo(key: string, icon: string | null): boolean {
    return (
        /\bdazn\b/.test(key) || /dzn|dazn|lcxo_station_logos/i.test(icon ?? '')
    );
}

/** Logo hosts whose files draw a small logo in a wide margin. */
const PADDED_LOGOS = /emisiondof6\.com/i;

/**
 * The distinct logos, the commonest first (ties keep their order), the
 * ones drawn small in a wide margin last.
 */
function byFrequency(values: readonly (string | null)[]): string[] {
    const counts = new Map<string, number>();
    for (const value of values) {
        if (value) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
    }
    return [...counts.keys()].sort(
        (a, b) =>
            Number(PADDED_LOGOS.test(a)) - Number(PADDED_LOGOS.test(b)) ||
            (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
    );
}

/** A title without its region, quality tags, feed number and backup. */
function displaySpelling(title: string): string {
    const event = eventSlotName(title);
    if (event) {
        return event;
    }
    const { feed, backup } = parseChannelName(title);
    let name = title.replace(SUPERSCRIPTS, ' ').replace(NOTES, ' ');
    for (const prefix of REGION_PREFIXES) {
        name = name.replace(prefix, '');
    }
    name = name
        .replace(/\b(UHD|FHD|HD|SD|4K|HEVC|SAT|ULTRA|Orange)\b/gi, ' ')
        .replace(/^(\+|M\.|M(?=\s))\s*/, 'M+ ');
    if (feed !== null) {
        name = name.replace(new RegExp(`(^|\\s)0?${feed}(?=\\s|$)`), ' ');
    }
    if (backup) {
        name = name.replace(/\sB\s*$/, '');
    }
    return name
        .replace(/[|:\s-]+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(TRAILING_REGION_TAG, '');
}

/** "UEFA | 03 - Lech Poznan vs Bayer 04 Leverkusen 17:45 pm". */
const NUMBERED_EVENT =
    /^[a-z]{2,6}\s*\|\s*\d{1,2}\s*-\s*(.+?)(?:\s+(\d{1,2})[:.](\d{2})(?:\s*[ap]m)?)?$/i;
/** "Lakers vs Nuggets @ Oct 16 10:30 PM :NBA 12". */
const DATED_EVENT = /^(.+?)\s*@\s*(.+?)\s*:\s*[a-z]{2,6}\s*\d{1,2}$/i;

/**
 * A pay-per-view slot named after its event: the event, then its time
 * ("Lech Poznan vs Bayer 04 Leverkusen · 17:45"), without the slot.
 */
function eventSlotName(title: string): string | null {
    const numbered = NUMBERED_EVENT.exec(title.trim());
    if (numbered) {
        const time = numbered[2] ? ` · ${numbered[2]}:${numbered[3]}` : '';
        return `${numbered[1]}${time}`;
    }
    const dated = DATED_EVENT.exec(title.trim());
    return dated ? `${dated[1]} · ${dated[2]}` : null;
}

function isCapitals(name: string): boolean {
    return name === name.toUpperCase();
}

function titleCase(name: string): string {
    return name
        .toLowerCase()
        .split(' ')
        .map((word, index) =>
            index === 0 || !/^(de|del|la|y)$/.test(word)
                ? (WORDS[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
                : word
        )
        .join(' ');
}
