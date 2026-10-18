import type { PlatformGenre } from './platform-genres';
import type { PlatformRow, PlatformTitle } from './platform-titles';

/**
 * Disney+'s brand tiles under its hero: Disney, Pixar, Marvel, Star Wars
 * and National Geographic. The provider files no brand, so a title joins
 * one by its name (the films and series each brand is known for, in
 * English and Spanish) or, for Disney and National Geographic, by genre.
 */
export type PlatformBrandId =
    'disney' | 'pixar' | 'marvel' | 'star-wars' | 'national-geographic';

export interface PlatformBrand {
    readonly id: PlatformBrandId;
    readonly name: string;
}

interface BrandRule extends PlatformBrand {
    readonly names: RegExp;
    readonly genres?: readonly PlatformGenre[];
}

const RULES: readonly BrandRule[] = [
    {
        id: 'pixar',
        name: 'Pixar',
        names: /pixar|toy story|buscando a (nemo|dory)|finding (nemo|dory)|monsters,? (inc|university)|monstruos,? s\.?a|monsters at work|los incre[ií]bles|the incredibles|ratatouille|wall[-·]?e\b|intensa-?mente|del rev[eé]s|inside out|^(coco|luca|soul|up|unidos|cars( \d)?)$|lightyear|onward|turning red|elemental|bichos|a bug'?s life|dug days|win or lose/i,
    },
    {
        id: 'marvel',
        name: 'Marvel',
        names: /marvel|avengers|vengadores|spider-?man|iron ?man|^thor\b|hulk|captain america|capit[aá]n am[eé]rica|black panther|pantera negra|guardi(ans of the galaxy|anes de la galaxia)|^loki\b|wandavision|ant-?man|doctor (strange|extra[nñ]o)|x-?men|deadpool|daredevil|hawkeye|ojo de halc[oó]n|moon knight|caballero luna|eternals|eternos|shang-?chi|black widow|viuda negra|fantastic four|cuatro fant[aá]sticos|thunderbolts|agatha|ironheart|secret invasion|invasi[oó]n secreta|^what if/i,
    },
    {
        id: 'star-wars',
        name: 'Star Wars',
        names: /star wars|guerra de las galaxias|mandalorian|mandaloriano|^andor\b|ahsoka|obi-?wan|boba fett|skeleton crew|acolyte|ac[oó]lita|bad batch|remesa mala|clone wars|guerras clon|rogue one|skywalker|\bjedi\b/i,
    },
    {
        id: 'national-geographic',
        name: 'National Geographic',
        names: /national geographic|nat ?geo/i,
        genres: ['documentary'],
    },
    {
        id: 'disney',
        name: 'Disney',
        names: /disney|frozen|moana|vaiana|encanto|rey le[oó]n|lion king|aladd?in|mul[aá]n|zoot(opia|r[oó]polis)|enredados|tangled|^wish$|cenicienta|cinderella|blancanieves|snow white|la bella y la bestia|beauty and the beast|sirenita|little mermaid|hannah montana|high school musical|descendientes|descendants|percy jackson|bluey|mickey|winnie|lilo|stitch|^raya\b|h[eé]rcules|pocahontas|bambi|dumbo|pinocho|pinocchio|peter pan|cruella|mal[eé]fica|maleficent/i,
        genres: ['animation', 'family'],
    },
];

/** Disney+'s order: Disney, Pixar, Marvel, Star Wars, National Geographic. */
const ORDER: readonly PlatformBrandId[] = [
    'disney',
    'pixar',
    'marvel',
    'star-wars',
    'national-geographic',
];

/** The brand a title belongs to: its name first, then its genres. */
export function brandOf(title: PlatformTitle): PlatformBrandId | null {
    const named = RULES.find((rule) => rule.names.test(title.title));
    if (named) {
        return named.id;
    }
    const genred = RULES.find((rule) =>
        rule.genres?.some((genre) => title.genres.includes(genre))
    );
    return genred?.id ?? null;
}

export interface PlatformBrandRow extends PlatformRow {
    readonly brand: PlatformBrand;
}

/**
 * The brands the platform's titles fill, in Disney+'s order, each a row
 * ("Marvel en Disney+") that its tile opens whole.
 */
export function buildBrandRows(
    titles: readonly PlatformTitle[],
    platformName: string
): PlatformBrandRow[] {
    const byBrand = new Map<PlatformBrandId, PlatformTitle[]>();
    for (const title of titles) {
        const brand = brandOf(title);
        if (brand) {
            const list = byBrand.get(brand) ?? [];
            list.push(title);
            byBrand.set(brand, list);
        }
    }
    const rows: PlatformBrandRow[] = [];
    for (const id of ORDER) {
        const list = byBrand.get(id);
        const rule = RULES.find((candidate) => candidate.id === id);
        if (list && rule) {
            rows.push({
                id: `brand-${id}`,
                labelKey: 'WORKSPACE.PLATFORMS.BRAND_ROW',
                labelParams: { brand: rule.name, platform: platformName },
                titles: list,
                brand: { id, name: rule.name },
            });
        }
    }
    return rows;
}
