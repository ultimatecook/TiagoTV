import type { TvCountry } from './countries-catalog';
import type { CountryChannel, CountryChannelGroup } from './country-channels';
import type { TvRow } from './country-rows';

/**
 * Which channel "Por países" plays: the one picked, and on opening the
 * last one watched on the page (kept in this browser's storage), else the
 * first channel of Argentina's first row. A country's own route
 * (`/workspace/countries/es`) opens on that country: its last channel
 * watched if the page's last one was there, else its first.
 */
export interface TvSelection {
    readonly country: TvCountry;
    readonly row: TvRow;
    readonly channel: CountryChannelGroup;
    /** The copy that plays: the best one, or the one picked in the panel. */
    readonly copy: CountryChannel;
}

export const LAST_CHANNEL_STORAGE_KEY = 'tiagotv:countries-last-channel';
const OPENING_COUNTRY = 'ar';

/** The channel one of whose copies is `streamId`, with that copy. */
export function findSelection(
    countries: readonly TvCountry[],
    streamId: number
): TvSelection | null {
    for (const country of countries) {
        for (const row of country.rows) {
            for (const channel of row.channels) {
                const copy = channel.copies.find(
                    (entry) => entry.streamId === streamId
                );
                if (copy) {
                    return { country, row, channel, copy };
                }
            }
        }
    }
    return null;
}

export function openingSelection(
    countries: readonly TvCountry[],
    rememberedStreamId: number | null,
    countryId: string | null = null
): TvSelection | null {
    const last =
        rememberedStreamId === null
            ? null
            : findSelection(countries, rememberedStreamId);
    const wanted = countryId
        ? (countries.find((entry) => entry.definition.id === countryId) ?? null)
        : null;
    if (wanted) {
        return last?.country === wanted ? last : firstOf(wanted);
    }
    if (last) {
        return last;
    }
    const opening =
        countries.find((entry) => entry.definition.id === OPENING_COUNTRY) ??
        countries[0];
    return opening ? firstOf(opening) : null;
}

/** A channel picked on the page: its best copy. */
export function selectionOf(
    country: TvCountry,
    row: TvRow,
    channel: CountryChannelGroup
): TvSelection {
    return { country, row, channel, copy: channel.copies[0] };
}

export function readLastChannel(storage: Storage | null): number | null {
    try {
        const value = Number(storage?.getItem(LAST_CHANNEL_STORAGE_KEY));
        return Number.isInteger(value) && value > 0 ? value : null;
    } catch {
        return null;
    }
}

export function rememberLastChannel(
    storage: Storage | null,
    streamId: number
): void {
    try {
        storage?.setItem(LAST_CHANNEL_STORAGE_KEY, String(streamId));
    } catch {
        // A private window or blocked storage: the page opens on Argentina.
    }
}

export function browserStorage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

function firstOf(country: TvCountry): TvSelection | null {
    const row = country.rows[0];
    const channel = row?.channels[0];
    return row && channel ? selectionOf(country, row, channel) : null;
}
