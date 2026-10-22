import { playlistDisplayLabel } from './playlist-display-label.util';

/**
 * TiagoTV never shows the provider's address. A source added from its
 * server is named after it ("line.example.tv", "http://1.2.3.4:8080"),
 * and that name used to read as the title page's eyebrow
 * ("SERIES · LINE.EXAMPLE.TV"). A name that looks like an address is
 * hidden; a name the user chose ("Casa") still shows.
 */
const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:[/?#].*)?$/;
const HOST_PORT = /^(?:localhost|[a-z0-9-]+)(?::\d{2,5})(?:[/?#].*)?$/i;
const DOMAIN =
    /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}\.?(?::\d+)?(?:[/?#].*)?$/i;

/** Whether a source name is an address: a URL, a host name or an IP. */
export function isHostLikeName(name: string | null | undefined): boolean {
    const value = (name ?? '').trim();
    if (!value || /\s/.test(value)) {
        return URL_LIKE.test(value) || /https?:\/\//i.test(value);
    }
    return (
        URL_LIKE.test(value) ||
        IPV4.test(value) ||
        HOST_PORT.test(value) ||
        DOMAIN.test(value)
    );
}

/**
 * The source's name as the title pages may show it: the user's own name,
 * cleaned of credentials, or null for an address (or nothing).
 */
export function visibleSourceName(
    name: string | null | undefined
): string | null {
    const raw = (name ?? '').trim();
    if (!raw || isHostLikeName(raw)) {
        return null;
    }
    const label = playlistDisplayLabel(raw);
    return isHostLikeName(label) ? null : label;
}

const PORTAL_NAMES: Readonly<Record<string, string>> = {
    xtream: 'Xtream',
    stalker: 'Stalker',
    m3u: 'M3U',
};

/**
 * A source's label where one must be shown (the sources list of a title):
 * its own name, else the kind of source rather than its address.
 */
export function sourceDisplayLabel(
    name: string | null | undefined,
    portalType: string
): string {
    return visibleSourceName(name) ?? PORTAL_NAMES[portalType] ?? portalType;
}
