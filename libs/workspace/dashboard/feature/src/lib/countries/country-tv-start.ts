import type { TvCountry } from './countries-catalog';
import type { CountryChannel, CountryChannelGroup } from './country-channels';
import type { TvRow } from './country-rows';

/**
 * Which channel "En vivo" plays: the one picked, and on opening the country
 * chosen last (kept in this browser's storage) on its last channel watched,
 * else the last channel watched on the page, else the first channel of
 * Argentina's first row. A country's own route (`/workspace/countries/es`)
 * opens on that country: its last channel watched, else its first.
 */
export interface TvSelection {
    readonly country: TvCountry;
    readonly row: TvRow;
    readonly channel: CountryChannelGroup;
    /** The copy that plays: the best one, or the one picked in the panel. */
    readonly copy: CountryChannel;
}

/** What the page remembers in this browser. */
export interface TvMemory {
    /** The last channel watched on the page (its copy's stream). */
    readonly lastChannel: number | null;
    /** The country chosen last. */
    readonly country: string | null;
    /** Each country's last channel watched. */
    readonly channels: Readonly<Record<string, number>>;
}

export const LAST_CHANNEL_STORAGE_KEY = 'tiagotv:countries-last-channel';
export const COUNTRY_STORAGE_KEY = 'tiagotv:countries-country';
export const COUNTRY_CHANNELS_STORAGE_KEY = 'tiagotv:countries-channels';
const OPENING_COUNTRY = 'ar';
export const NO_MEMORY: TvMemory = {
    lastChannel: null,
    country: null,
    channels: {},
};

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
    memory: TvMemory,
    countryId: string | null = null
): TvSelection | null {
    const wanted =
        byId(countries, countryId) ?? byId(countries, memory.country);
    if (wanted) {
        return countrySelection(wanted, memory);
    }
    const last =
        memory.lastChannel === null
            ? null
            : findSelection(countries, memory.lastChannel);
    if (last) {
        return last;
    }
    const opening = byId(countries, OPENING_COUNTRY) ?? countries[0];
    return opening ? firstOf(opening) : null;
}

/**
 * A country chosen on the page: its last channel watched (the page's last
 * one when it was there), else its first.
 */
export function countrySelection(
    country: TvCountry,
    memory: TvMemory
): TvSelection | null {
    for (const streamId of [
        memory.lastChannel,
        memory.channels[country.definition.id] ?? null,
    ]) {
        const own =
            streamId === null ? null : findSelection([country], streamId);
        if (own) {
            return own;
        }
    }
    return firstOf(country);
}

/** A channel picked on the page: its best copy. */
export function selectionOf(
    country: TvCountry,
    row: TvRow,
    channel: CountryChannelGroup
): TvSelection {
    return { country, row, channel, copy: channel.copies[0] };
}

export function readMemory(storage: Storage | null): TvMemory {
    return {
        lastChannel: readLastChannel(storage),
        country: read(storage, COUNTRY_STORAGE_KEY),
        channels: readChannels(storage),
    };
}

export function readLastChannel(storage: Storage | null): number | null {
    return streamIdOf(Number(read(storage, LAST_CHANNEL_STORAGE_KEY)));
}

/** A channel that played: the page's last one, and its country's. */
export function rememberSelection(
    storage: Storage | null,
    selection: Pick<TvSelection, 'country' | 'copy'>
): void {
    const countryId = selection.country.definition.id;
    const streamId = selection.copy.streamId;
    write(storage, LAST_CHANNEL_STORAGE_KEY, String(streamId));
    write(
        storage,
        COUNTRY_CHANNELS_STORAGE_KEY,
        JSON.stringify({ ...readChannels(storage), [countryId]: streamId })
    );
    rememberCountry(storage, countryId);
}

export function rememberCountry(
    storage: Storage | null,
    countryId: string
): void {
    write(storage, COUNTRY_STORAGE_KEY, countryId);
}

export function browserStorage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

function readChannels(storage: Storage | null): Record<string, number> {
    const channels: Record<string, number> = {};
    try {
        const parsed: unknown = JSON.parse(
            read(storage, COUNTRY_CHANNELS_STORAGE_KEY) ?? '{}'
        );
        if (parsed && typeof parsed === 'object') {
            for (const [id, value] of Object.entries(parsed)) {
                const streamId = streamIdOf(Number(value));
                if (streamId !== null) {
                    channels[id] = streamId;
                }
            }
        }
    } catch {
        // Garbage in storage: no country remembers a channel.
    }
    return channels;
}

function streamIdOf(value: number): number | null {
    return Number.isInteger(value) && value > 0 ? value : null;
}

function read(storage: Storage | null, key: string): string | null {
    try {
        return storage?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function write(storage: Storage | null, key: string, value: string): void {
    try {
        storage?.setItem(key, value);
    } catch {
        // A private window or blocked storage: the page opens on Argentina.
    }
}

function byId(
    countries: readonly TvCountry[],
    id: string | null
): TvCountry | null {
    return id
        ? (countries.find((entry) => entry.definition.id === id) ?? null)
        : null;
}

function firstOf(country: TvCountry): TvSelection | null {
    const row = country.rows[0];
    const channel = row?.channels[0];
    return row && channel ? selectionOf(country, row, channel) : null;
}
