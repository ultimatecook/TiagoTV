import {
    ContentKind,
    categoryLanguageCode,
    isIdleEventChannel,
    isSpanishOrEnglishCategory,
} from '@iptvnator/shared/interfaces';

/**
 * TiagoTV's catalog views list Spanish and English content only (see
 * `isSpanishOrEnglishCategory`). These helpers scope what the category
 * rails and the "All items" grids read; the stored catalog (state, SQLite,
 * session cache) stays complete, so a playlist switch or a later change
 * of the rule loses nothing.
 */
export interface LanguageScopedCategory {
    readonly category_id?: string | number;
    readonly category_name?: string;
    readonly id?: string | number;
    readonly name?: string;
}

export interface LanguageScopedItem {
    readonly category_id?: string | number;
    readonly name?: string;
    readonly title?: string;
}

export interface LanguageScopedCatalog<
    C extends LanguageScopedCategory,
    I extends LanguageScopedItem,
> {
    /** The categories a rail lists. */
    readonly categories: C[];
    /** Every item a category can open: idle event slots are left out. */
    readonly items: I[];
    /** "All items": the items of the listed categories only. */
    readonly allItems: I[];
}

const categoryName = (category: LanguageScopedCategory): string =>
    String(category.category_name ?? category.name ?? '');

/**
 * The id the category's items carry in `category_id`: the provider id on
 * the PWA rows, the SQLite row id on the Electron ones.
 */
const categoryKey = (category: LanguageScopedCategory): string =>
    String(category.category_id ?? category.id ?? '');

/** "ES | No Event": a live event slot with nothing on it. */
export function isIdleLiveItem(item: LanguageScopedItem): boolean {
    return isIdleEventChannel(String(item.title ?? item.name ?? ''));
}

/**
 * The Spanish and English categories. A provider that tags none of its
 * categories with a language code is not filtered at all, so an untagged
 * catalog never ends up empty.
 */
export function filterCategoriesByLanguage<C extends LanguageScopedCategory>(
    categories: C[],
    kind: ContentKind
): C[] {
    const tagged = categories.some(
        (category) => categoryLanguageCode(categoryName(category)) !== null
    );
    return tagged
        ? categories.filter((category) =>
              isSpanishOrEnglishCategory(categoryName(category), kind)
          )
        : categories;
}

/**
 * The live items without their idle event slots, and the categories that
 * hold such slots and nothing else ("|ES| ✪ ROLAND-GARROS" between
 * tournaments): with the slots hidden they would list nothing.
 */
function withoutIdleSlots<I extends LanguageScopedItem>(
    items: I[]
): { playable: I[]; idleOnly: Set<string> } {
    const playable: I[] = [];
    const idleOnly = new Set<string>();
    const filled = new Set<string>();
    for (const item of items) {
        const key = String(item.category_id ?? '');
        if (isIdleLiveItem(item)) {
            idleOnly.add(key);
        } else {
            playable.push(item);
            filled.add(key);
        }
    }
    filled.forEach((key) => idleOnly.delete(key));
    return { playable, idleOnly };
}

/** One content type of the catalog, as the views list it. */
export function scopeCatalogByLanguage<
    C extends LanguageScopedCategory,
    I extends LanguageScopedItem,
>(categories: C[], items: I[], kind: ContentKind): LanguageScopedCatalog<C, I> {
    const shown = filterCategoriesByLanguage(categories, kind);
    const { playable, idleOnly } =
        kind === 'live'
            ? withoutIdleSlots(items)
            : { playable: items, idleOnly: new Set<string>() };
    // An idle-only category adds no item, so it only leaves the rail.
    const listed =
        idleOnly.size === 0
            ? shown
            : shown.filter((category) => !idleOnly.has(categoryKey(category)));
    if (shown === categories) {
        return { categories: listed, items: playable, allItems: playable };
    }
    const keys = new Set(shown.map(categoryKey));
    return {
        categories: listed,
        items: playable,
        allItems: playable.filter((item) =>
            keys.has(String(item.category_id ?? ''))
        ),
    };
}
