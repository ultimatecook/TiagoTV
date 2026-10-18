/**
 * IPTV panels often sit behind Cloudflare, which publishes a DNS HTTPS
 * record for every name it proxies. Chromium treats that record like HSTS
 * and silently upgrades `http://` requests to `https://`, the player's
 * stream requests included. Many panels only serve streams over http, so
 * Cloudflare then answers 525 (it cannot complete TLS with the panel). The
 * catalog, which Node fetches from the main process, never sees the
 * upgrade: the source loads and every stream fails. Turning the records
 * off keeps an http source on http; an https source stays https.
 *
 * Both features go: the records themselves, and Chromium's own DNS client,
 * the only resolver that reads them, so the system resolver answers as it
 * does for the main process.
 */
export const DNS_HTTPS_UPGRADE_FEATURES = ['UseDnsHttpsSvcb', 'AsyncDns'];

type CommandLine = Pick<
    Electron.CommandLine,
    'getSwitchValue' | 'appendSwitch'
>;

/** Adds the features to `--disable-features`, keeping any already there. */
export function disableDnsHttpsUpgrade(commandLine: CommandLine): void {
    const disabled = commandLine
        .getSwitchValue('disable-features')
        .split(',')
        .map((feature) => feature.trim())
        .filter(Boolean);
    const missing = DNS_HTTPS_UPGRADE_FEATURES.filter(
        (feature) => !disabled.includes(feature)
    );
    if (missing.length === 0) {
        return;
    }
    // The last value of a switch wins, so the list is appended whole.
    commandLine.appendSwitch(
        'disable-features',
        [...disabled, ...missing].join(',')
    );
}
