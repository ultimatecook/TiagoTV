import { computed, type Signal } from '@angular/core';
import {
    channelFeedGroup,
    feedRegionOfCategory,
    type ChannelFeedGroup,
    type FeedCandidate,
    type FeedRegion,
} from '@iptvnator/portal/shared/util';
import type { XtreamLiveChannelItem } from './xtream-live-channel-navigation.service';

/** A live category as the store holds it: the provider's or a SQLite row. */
interface XtreamLiveFeedCategory {
    readonly category_id?: string | number;
    readonly id?: string | number;
    readonly category_name?: string;
    readonly name?: string;
    readonly hidden?: boolean;
}

/** What the feeds read of the Xtream store. */
export interface XtreamLiveFeedsStore {
    readonly liveCategories?: () => readonly XtreamLiveFeedCategory[];
    /** The listed (Spanish and English) categories' items, idle slots out. */
    readonly getDisplayedContentByType?: () => (
        type: 'live'
    ) => readonly unknown[];
}

export interface XtreamFeedCandidate extends FeedCandidate {
    readonly item: XtreamLiveChannelItem;
}

export interface XtreamLiveFeeds {
    /** The playing channel's other feeds; null when it has none. */
    readonly group: Signal<ChannelFeedGroup<XtreamFeedCandidate> | null>;
    /** The channel behind one of the group's feeds. */
    itemFor(feed: FeedCandidate): XtreamLiveChannelItem | null;
}

/**
 * TiagoTV: the "other feeds" under the live player (see channel-feeds in
 * `@iptvnator/portal/shared/util`), from the channels the category rails
 * list: the kept countries' categories, hidden ones left out. Nothing is
 * fetched or probed: a feed starts only when it is chosen.
 */
export function createXtreamLiveFeeds(
    store: XtreamLiveFeedsStore,
    playing: () => XtreamLiveChannelItem | null
): XtreamLiveFeeds {
    const categories = computed(() => {
        const regions = new Map<string, FeedRegion | null>();
        const hidden = new Set<string>();
        for (const category of store.liveCategories?.() ?? []) {
            const key = String(category.category_id ?? category.id ?? '');
            if (category.hidden) {
                hidden.add(key);
            }
            regions.set(
                key,
                feedRegionOfCategory(
                    String(category.category_name ?? category.name ?? '')
                )
            );
        }
        return { regions, hidden };
    });
    const candidate = (item: XtreamLiveChannelItem): XtreamFeedCandidate => ({
        id: Number(item.xtream_id),
        title: String(item.title ?? item.name ?? ''),
        icon: item.poster_url || item.stream_icon || null,
        region:
            categories().regions.get(String(item.category_id ?? '')) ?? null,
        item,
    });
    // Built once per catalog, so a channel switch only regroups.
    const candidates = computed(() => {
        const { hidden } = categories();
        const items = (store.getDisplayedContentByType?.()?.('live') ??
            []) as readonly XtreamLiveChannelItem[];
        return items
            .filter((item) => !hidden.has(String(item.category_id ?? '')))
            .map(candidate);
    });
    const group = computed(() => {
        const item = playing();
        return item ? channelFeedGroup(candidate(item), candidates()) : null;
    });

    return {
        group,
        itemFor(feed: FeedCandidate): XtreamLiveChannelItem | null {
            for (const region of group()?.regions ?? []) {
                const option = region.options.find(
                    (entry) => entry.channel.id === feed.id
                );
                if (option) {
                    return option.channel.item;
                }
            }
            return null;
        },
    };
}
