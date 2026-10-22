import { tidyChannelTitle } from '@iptvnator/shared/interfaces';
import { brandOfFamily } from './channel-brands';
import {
    channelFamilyName,
    feedTitle,
    knownFamilyName,
    parseChannelName,
} from './channel-families';

/**
 * A live channel's card face (TiagoTV: the Home's "Últimos canales
 * vistos", Mi lista's "Canales"): a channel's logo on a dark plate (or its
 * name in Bebas when it has none), its country's flag, its tidy name.
 */
export interface ChannelFace {
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

export function channelFace(
    title: string,
    icon: string | null | undefined
): ChannelFace {
    const { key } = parseChannelName(title);
    const brand = brandOfFamily(key);
    const code = LEADING_CODE.exec(title)?.[1]?.toUpperCase() ?? null;
    const flag = code ? COUNTRY_FLAGS[code] : undefined;
    const spelled = channelFamilyName(key, [title]);
    // A name in capitals reads as "En vivo"'s tiles write it ("C5N",
    // "BBC One", "Telefe"), not capitalised word by word ("C5n").
    const family = {
        name:
            knownFamilyName(key) || /\p{Ll}/u.test(title)
                ? spelled
                : tidyChannelTitle(spelled.toUpperCase()),
    };
    return {
        name: feedTitle(family, { title, icon: null }) || title.trim(),
        logo: brand?.logo ?? (icon || null),
        brandLogo: !!brand?.logo,
        flag: flag ? `${FLAGS}${flag}.svg` : null,
    };
}
