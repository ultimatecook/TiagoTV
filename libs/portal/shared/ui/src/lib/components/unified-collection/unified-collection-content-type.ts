import { computed, Signal, signal, WritableSignal } from '@angular/core';
import {
    CollectionContentType,
    UnifiedCollectionItem,
} from '@iptvnator/portal/shared/util';

/**
 * The Live / Movies / Series tab of a unified collection, plus the item
 * partition it selects from. A tab exists only while the collection holds
 * items of that type, so the state also owns the correction that runs after
 * every load and every bulk removal.
 */
export interface CollectionContentTypeState {
    readonly selected: WritableSignal<CollectionContentType>;
    readonly liveItems: Signal<UnifiedCollectionItem[]>;
    readonly movieItems: Signal<UnifiedCollectionItem[]>;
    readonly seriesItems: Signal<UnifiedCollectionItem[]>;
    readonly hasLive: Signal<boolean>;
    readonly hasMovies: Signal<boolean>;
    readonly hasSeries: Signal<boolean>;
    readonly availableTypes: Signal<CollectionContentType[]>;
    readonly showToggle: Signal<boolean>;
    readonly currentTypeItems: Signal<UnifiedCollectionItem[]>;
    /** The tab's type as a noun inside a sentence ("las películas"). */
    readonly currentTypeNounKey: Signal<string>;
    /** Move off a tab the collection no longer has items for. */
    autoSelect(): void;
}

export function createCollectionContentTypeState(
    allItems: Signal<readonly UnifiedCollectionItem[]>,
    initialType: CollectionContentType
): CollectionContentTypeState {
    const selected = signal<CollectionContentType>(initialType);
    const itemsOfType = (contentType: CollectionContentType) =>
        computed(() =>
            allItems().filter((item) => item.contentType === contentType)
        );

    const liveItems = itemsOfType('live');
    const movieItems = itemsOfType('movie');
    const seriesItems = itemsOfType('series');

    const hasLive = computed(() => liveItems().length > 0);
    const hasMovies = computed(() => movieItems().length > 0);
    const hasSeries = computed(() => seriesItems().length > 0);

    const availableTypes = computed(() => {
        const types: CollectionContentType[] = [];
        if (hasLive()) types.push('live');
        if (hasMovies()) types.push('movie');
        if (hasSeries()) types.push('series');
        return types;
    });

    const currentTypeItems = computed(() => {
        switch (selected()) {
            case 'live':
                return liveItems();
            case 'movie':
                return movieItems();
            case 'series':
                return seriesItems();
        }
    });

    const currentTypeNounKey = computed(() => {
        switch (selected()) {
            case 'live':
                return 'WORKSPACE.SHELL.COLLECTION_TYPE_NOUN.LIVE';
            case 'movie':
                return 'WORKSPACE.SHELL.COLLECTION_TYPE_NOUN.MOVIE';
            case 'series':
                return 'WORKSPACE.SHELL.COLLECTION_TYPE_NOUN.SERIES';
        }
    });

    return {
        selected,
        liveItems,
        movieItems,
        seriesItems,
        hasLive,
        hasMovies,
        hasSeries,
        availableTypes,
        showToggle: computed(() => availableTypes().length > 1),
        currentTypeItems,
        currentTypeNounKey,
        autoSelect(): void {
            const types = availableTypes();
            if (types.length > 0 && !types.includes(selected())) {
                selected.set(types[0]);
            }
        },
    };
}
