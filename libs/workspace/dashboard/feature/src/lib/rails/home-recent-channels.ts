import {
    brandOfFamily,
    channelFamilyName,
    feedTitle,
    parseChannelName,
} from '@iptvnator/portal/shared/util';

/**
 * The Home's "Últimos canales vistos" cards (README 01 · Inicio, 7): a
 * channel's logo on a dark plate (or its name in Bebas when it has none),
 * its country's flag, the programme on air and how far it has run.
 */
export interface HomeChannelFace {
    /** "DAZN LaLiga" for "|ES| DAZN LALIGA HD". */
    readonly name: string;
    /** The bundled white brand logo, else the provider's own. */
    readonly logo: string | null;
    readonly brandLogo: boolean;
    readonly flag: string | null;
}

const FLAGS = './assets/flags/';

/** The provider's country codes, by the flag the app bundles. */
const COUNTRY_FLAGS: Readonly<Record<string, string>> = {
    ES: 'es',
    UK: 'gb',
    GB: 'gb',
    US: 'us',
    USA: 'us',
    AR: 'ar',
    ARG: 'ar',
    LAT: 'ar',
    MX: 'mx',
    CO: 'co',
    CL: 'cl',
    CHL: 'cl',
    PE: 'pe',
    UY: 'uy',
    EC: 'ec',
    VE: 've',
    IE: 'ie',
    CA: 'ca',
};

/** "|ES| …", "ES: …", "UK | …", "US - …": the code a channel's name opens on. */
const LEADING_CODE = /^\s*\|?\s*([A-Za-z]{2,3})\s*(?:\||:|-\s)/;

export function homeChannelFace(
    title: string,
    icon: string | null | undefined
): HomeChannelFace {
    const { key } = parseChannelName(title);
    const brand = brandOfFamily(key);
    const code = LEADING_CODE.exec(title)?.[1]?.toUpperCase() ?? null;
    const flag = code ? COUNTRY_FLAGS[code] : undefined;
    const family = { name: channelFamilyName(key, [title]) };
    return {
        name: feedTitle(family, { title, icon: null }) || title.trim(),
        logo: brand?.logo ?? (icon || null),
        brandLogo: !!brand?.logo,
        flag: flag ? `${FLAGS}${flag}.svg` : null,
    };
}
