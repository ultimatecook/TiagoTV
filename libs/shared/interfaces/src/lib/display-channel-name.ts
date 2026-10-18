/**
 * TiagoTV shows a live channel by what it carries. Providers wrap channel
 * names in a country or group tag and a quality badge ("|ES| DAZN 1 ᴴᴰ",
 * "ES: LALIGA+ PPV 1", "UK | ITV FHD"), and their event channels rename
 * themselves after the match on air:
 *
 *   Live | Leeds United - Manchester United | Premier League | ES
 *   Next | 2026-10-18 | 12:45 (GMT) | Bournemouth - Sunderland | Premier League | ES
 *   End | Udinese - Lecce | Serie A | ES
 *
 * Status first, the kick-off for upcoming ones, then the match, the
 * competition and the feed's country. Extra segments belong to the match.
 */
export interface DisplayChannelName {
    /** The match on an event channel, the channel's own name otherwise. */
    readonly title: string;
    /** An event channel's competition; null for an ordinary channel. */
    readonly subtitle: string | null;
}

const EVENT_STATUS = /^(?:live|next|end)$/i;
/** "2026-10-18", "12:45 (GMT)", "Sun 18 Oct 22:00 CEST (SE)". */
const KICK_OFF =
    /^(?:\d{4}-\d{2}-\d{2}|(?:[a-z]{3},?\s+)?(?:\d{1,2}\s+[a-z]{3,9}\s+)?\d{1,2}:\d{2}(?:\s*[a-z]{2,5})?(?:\s*\([^)]*\))?)$/i;
/** A segment that is only a feed badge: "8K EXCLUSIVE", "HD". */
const BADGE_SEGMENT = /^(?:[48]k|u?hd|fhd|sd)\b/i;
const COUNTRY = /^[A-Z]{2}$/;
/** "|ES|", "| UK |", "|DSTV|": a group tag between bars. */
const LEADING_GROUP = /^\s*\|[^|]{1,12}\|\s*/;
/** "ES:", "ES|", "UK |", "USA:", "C+AF:": a country code. */
const LEADING_COUNTRY = /^\s*(?:[a-z]{2}|usa|c\+[a-z]{2})\s*[:|]\s*/i;
/** Superscript badges anywhere: "ᴴᴰ", "ᵁᴴᴰ", "ᶠᴴᴰ", "ˢᴰ", "(ᴴᴰ)". */
const SUPERSCRIPT_BADGE =
    /(^|\s)[([]?[\u02b0-\u02ff\u1d2c-\u1d6a\u1d9b-\u1dbf]+[)\]]?(?=\s|$)/g;
/** A trailing quality tag: "HD", "FHD", "UHD", "4K", "HEVC", "1080p". */
const TRAILING_QUALITY =
    /\s+[([]?(?:u?hd|fhd|sd|[48]k|hevc|h\.?26[45]|\d{3,4}p|\d{2}\s?fps)[)\]]?$/i;
const STRAY_SEPARATORS = /^[\s|:\-–·]+|[\s:\-–·]+$/g;

/** The channel's own name without its country tag and quality badges. */
export function cleanChannelName(raw: string): string {
    let name = raw;
    let previous = '';
    while (name !== previous) {
        previous = name;
        name = name
            .replace(LEADING_GROUP, '')
            .replace(LEADING_COUNTRY, '')
            .replace(SUPERSCRIPT_BADGE, '$1')
            .replace(TRAILING_QUALITY, '')
            .replace(/\s{2,}/g, ' ')
            .replace(STRAY_SEPARATORS, '');
    }
    return name || raw.trim();
}

/** An event channel, named after the match it carries ("Live | …"). */
export function isEventChannelName(raw: string): boolean {
    const parts = raw.split('|');
    return parts.length > 1 && EVENT_STATUS.test(parts[0].trim());
}

/**
 * What a channel shows: the match and its competition on an event
 * channel, the cleaned name otherwise.
 */
export function displayChannelName(raw: string): DisplayChannelName {
    const parts = raw.split('|').map((part) => part.trim());
    if (parts.length < 2 || !EVENT_STATUS.test(parts[0])) {
        return { title: cleanChannelName(raw), subtitle: null };
    }

    const rest = parts
        .slice(1)
        .filter(
            (part) => part && !KICK_OFF.test(part) && !BADGE_SEGMENT.test(part)
        );
    if (rest.length > 1 && COUNTRY.test(rest[rest.length - 1])) {
        rest.pop();
    }
    if (rest.length === 0) {
        return { title: cleanChannelName(raw), subtitle: null };
    }
    const competition =
        rest.length > 1 ? cleanChannelName(rest.pop() as string) : null;
    return { title: rest.join(' · '), subtitle: competition };
}

/**
 * "ES | No Event", "GB | No Event": an event channel waiting for its next
 * match, which carries nothing until then.
 */
export function isIdleEventChannel(name: string): boolean {
    return /\|\s*no event\s*$/i.test(name.trim());
}
