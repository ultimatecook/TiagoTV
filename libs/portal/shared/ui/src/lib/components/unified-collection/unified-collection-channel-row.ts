import { computed, Signal } from '@angular/core';
import { UnifiedCollectionItem } from '@iptvnator/portal/shared/util';
import {
    CollectionMode,
    UnifiedCollectionDataService,
} from '@iptvnator/portal/shared/data-access';
import { createClearCollectionAction } from './unified-collection-clear-action';

/**
 * TiagoTV's collections with a "Canales" row (Mi lista, Recently viewed:
 * the page's `channelRow`): the live rows go to the cards
 * (`app-collection-channel-row`), the movies and series to the type chips
 * and grids below. Without the row every row stays with the tabs, the Live
 * tab among them.
 */
export interface CollectionChannelRowState {
    /** The channels the cards show; none without the row. */
    readonly channelItems: Signal<UnifiedCollectionItem[]>;
    /** The rows the type chips and grids (or the Live tab) show. */
    readonly contentItems: Signal<UnifiedCollectionItem[]>;
    /** Ask, then clear every channel of the row (Recently viewed's bin). */
    clear(): void;
}

/** Must run in an injection context (the page's field initializers). */
export function createCollectionChannelRowState(options: {
    enabled: Signal<boolean>;
    mode: Signal<CollectionMode>;
    items: Signal<UnifiedCollectionItem[]>;
    /** Whether the rows on screen came from one source; names the wording. */
    isPlaylistScope: () => boolean;
    data: UnifiedCollectionDataService;
    /** Restore the collection from storage after a failed write. */
    reload: () => Promise<void>;
}): CollectionChannelRowState {
    const isLive = (item: UnifiedCollectionItem) => item.contentType === 'live';
    const channelItems = computed(() =>
        options.enabled() ? options.items().filter(isLive) : []
    );
    const contentItems = computed(() =>
        options.enabled()
            ? options.items().filter((item) => !isLive(item))
            : options.items()
    );
    const clearAction = createClearCollectionAction({
        mode: options.mode,
        items: channelItems,
        typeLabelKey: computed(() => 'WORKSPACE.SHELL.COLLECTION_TYPE_NOUN.LIVE'),
        isPlaylistScope: options.isPlaylistScope,
        data: options.data,
        dropCurrentType: () => options.data.dropContentType('live'),
        reload: options.reload,
    });

    return {
        channelItems,
        contentItems,
        clear: () => clearAction.run(),
    };
}
