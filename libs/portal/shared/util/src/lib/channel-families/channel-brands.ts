/**
 * TiagoTV's channel brands: the sports channels that are always on (ESPN,
 * FOX Sports, TyC Sports…). The Home's "Canales en vivo" shows one tile per
 * brand; the live player lists a brand's feeds under the one playing.
 */
export interface ChannelBrand {
    readonly id: string;
    readonly name: string;
    /** The bundled logo, in white; null where the provider's logo shows. */
    readonly logo: string | null;
    /** The logo's size against the others, so they look even. */
    readonly logoSize?: number;
    readonly background: string;
    /**
     * The brand's channel families (see channel-families), most wanted
     * first: the first one the source carries plays.
     */
    readonly families: readonly RegExp[];
    /** Every family of the brand, for the logo of a competition's channel. */
    readonly owns: RegExp;
}

const LOGOS = './assets/channels/';

export const CHANNEL_BRANDS: readonly ChannelBrand[] = [
    {
        id: 'espn',
        name: 'ESPN',
        logo: `${LOGOS}espn.png`,
        logoSize: 0.88,
        background: 'linear-gradient(140deg, #2a0306 0%, #b0101c 100%)',
        families: [/^espn$/, /^espn (premium|extra)$/],
        owns: /^espn\b/,
    },
    {
        id: 'fox-sports',
        name: 'FOX Sports',
        logo: `${LOGOS}fox-sports.png`,
        logoSize: 1.18,
        background: 'linear-gradient(140deg, #020b1f 0%, #0d3c8f 100%)',
        families: [/^fox sports$/, /^fox sports premium$/],
        owns: /^fox sports\b/,
    },
    {
        id: 'tyc-sports',
        name: 'TyC Sports',
        logo: `${LOGOS}tyc-sports.png`,
        background: 'linear-gradient(140deg, #071a4a 0%, #c4122f 120%)',
        families: [/^tyc sports$/, /^tyc sports internacional$/],
        owns: /^tyc sports\b/,
    },
    {
        id: 'tnt-sports',
        name: 'TNT Sports',
        logo: `${LOGOS}tnt-sports.png`,
        background: 'linear-gradient(140deg, #050505 0%, #34343a 100%)',
        families: [/^tnt sports$/, /^tnt sports premium$/],
        owns: /^tnt sports\b/,
    },
    {
        id: 'dsports',
        name: 'DSports',
        logo: `${LOGOS}dsports.svg`,
        background: 'linear-gradient(140deg, #00122b 0%, #005eb8 100%)',
        families: [/^directv sports$/, /^directv sports plus$/],
        owns: /^directv sports\b/,
    },
    {
        id: 'dazn',
        name: 'DAZN',
        logo: `${LOGOS}dazn.png`,
        logoSize: 1.12,
        background: 'linear-gradient(140deg, #050505 0%, #23251a 100%)',
        families: [/^dazn$/],
        owns: /^dazn\b/,
    },
    {
        id: 'movistar-plus',
        name: 'Movistar+',
        logo: `${LOGOS}movistar-plus.png`,
        logoSize: 0.86,
        background: 'linear-gradient(140deg, #001a33 0%, #0a68c4 100%)',
        families: [/^m\+ deportes$/, /^m\+ laliga$/, /^m\+ liga de campeones$/],
        owns: /^m\+ /,
    },
    {
        id: 'bein-sports',
        name: 'beIN Sports',
        logo: `${LOGOS}bein-sports.png`,
        background: 'linear-gradient(140deg, #1b0633 0%, #5a2096 100%)',
        families: [/^bein sports$/],
        owns: /^bein sports\b/,
    },
    {
        id: 'sky-sports',
        name: 'Sky Sports',
        logo: `${LOGOS}sky-sports.png`,
        logoSize: 0.92,
        background: 'linear-gradient(140deg, #08103a 0%, #c0102a 120%)',
        families: [
            /^sky sports main event$/,
            /^sky sports premier league$/,
            /^sky sports football$/,
            /^sky sports (f1|tennis|golf|cricket|action|arena|mix|nfl|racing)$/,
        ],
        owns: /^sky sports\b/,
    },
    {
        id: 'eurosport',
        name: 'Eurosport',
        logo: `${LOGOS}eurosport.png`,
        logoSize: 0.94,
        background: 'linear-gradient(140deg, #050a3a 0%, #2131c9 100%)',
        families: [/^eurosport$/],
        owns: /^eurosport\b/,
    },
    {
        id: 'nba-tv',
        name: 'NBA TV',
        logo: `${LOGOS}nba-tv.png`,
        logoSize: 1.05,
        background: 'linear-gradient(140deg, #0a1a3d 0%, #1d428a 100%)',
        families: [/^nba$/],
        owns: /^nba\b/,
    },
];

/** The brand a channel family belongs to, if any. */
export function brandOfFamily(key: string): ChannelBrand | null {
    return CHANNEL_BRANDS.find((brand) => brand.owns.test(key)) ?? null;
}

/**
 * Where a brand's family stands among its others: its place in the
 * brand's list, the ones the list does not name after them.
 */
export function brandFamilyRank(brand: ChannelBrand, key: string): number {
    const index = brand.families.findIndex((pattern) => pattern.test(key));
    return index === -1 ? brand.families.length : index;
}
