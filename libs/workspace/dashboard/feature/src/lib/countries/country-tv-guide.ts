import {
    computed,
    DestroyRef,
    effect,
    inject,
    Injectable,
    signal,
    untracked,
} from '@angular/core';
import { StreamResolverService } from '@iptvnator/portal/shared/data-access';
import { buildXtreamCollectionUid } from '@iptvnator/portal/shared/util';
import { RuntimeCapabilitiesService, SettingsStore } from '@iptvnator/services';
import { epgProviderClockMs, type EpgItem } from '@iptvnator/shared/interfaces';
import { SportsCatalogService } from '../sports/sports-catalog.service';
import { nowAndNext, type TvNowNext, type TvProgramme } from './country-tv-epg';
import { CountryTvPlayback } from './country-tv-playback';

/** A switch has to settle this long before its guide is asked for. */
export const GUIDE_DELAY_MS = 900;
/** A channel's guide is asked for again after this long. */
const GUIDE_TTL_MS = 10 * 60 * 1000;
const CLOCK_MS = 30 * 1000;

/**
 * Now and next on the playing channel. The guide comes the way the live
 * view loads it for a channel it plays (the uploaded XMLTV, the manual
 * mapping, then the provider's guide for that one channel), once the
 * picked channel has stayed a moment, and only where the app reads guides
 * (`supportsEpg`). Hopping through tiles asks for nothing; each channel is
 * asked for once in ten minutes.
 *
 * Component-provided, beside `CountryTvPlayback`.
 */
@Injectable()
export class CountryTvGuide {
    private readonly playback = inject(CountryTvPlayback);
    private readonly sports = inject(SportsCatalogService);
    private readonly resolver = inject(StreamResolverService);
    private readonly settings = inject(SettingsStore);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    /** Each channel's guide asked for while the page is open. */
    private readonly cache = signal<
        ReadonlyMap<number, { items: EpgItem[]; at: number }>
    >(new Map());
    private readonly guide = signal<{ streamId: number; items: EpgItem[] }>({
        streamId: 0,
        items: [],
    });
    private readonly clock = signal(Date.now());
    private timer: ReturnType<typeof setTimeout> | null = null;

    readonly nowNext = computed<TvNowNext | null>(() => {
        const streamId = this.playback.selection()?.copy.streamId;
        const guide = this.guide();
        if (!streamId || guide.streamId !== streamId) {
            return null;
        }
        return this.programmes(guide.items);
    });

    /**
     * What a channel shows now, from a guide already asked for (a channel
     * played earlier on the page): the cards' programme. Asks for nothing.
     */
    nowOn(streamIds: readonly number[]): TvProgramme | null {
        const cache = this.cache();
        for (const streamId of streamIds) {
            const cached = cache.get(streamId);
            const now = cached ? this.programmes(cached.items)?.now : null;
            if (now) {
                return now;
            }
        }
        return null;
    }

    private programmes(items: readonly EpgItem[]): TvNowNext | null {
        const offset = this.settings.resolvedEpgOffsetMinutes();
        return nowAndNext(
            items,
            epgProviderClockMs(this.clock(), offset),
            offset
        );
    }

    constructor() {
        const ticker = setInterval(() => this.clock.set(Date.now()), CLOCK_MS);
        inject(DestroyRef).onDestroy(() => {
            clearInterval(ticker);
            this.cancel();
        });
        effect(() => {
            const selection = this.playback.selection();
            const playing =
                !!this.playback.playback() || !this.playback.embedded();
            untracked(() => {
                this.cancel();
                if (selection && playing && this.runtime.supportsEpg) {
                    const streamId = selection.copy.streamId;
                    this.timer = setTimeout(
                        () => void this.load(streamId, selection.channel.title),
                        GUIDE_DELAY_MS
                    );
                }
            });
        });
    }

    private async load(streamId: number, name: string): Promise<void> {
        const cached = this.cache().get(streamId);
        if (cached && Date.now() - cached.at < GUIDE_TTL_MS) {
            this.guide.set({ streamId, items: cached.items });
            return;
        }
        const source = this.sports.source();
        if (!source) {
            return;
        }
        const items = await this.resolver
            .loadEpgItems({
                uid: buildXtreamCollectionUid(source._id, 'live', streamId),
                name,
                contentType: 'live',
                sourceType: 'xtream',
                playlistId: source._id,
                playlistName: source.title ?? '',
                xtreamId: streamId,
            })
            .catch(() => [] as EpgItem[]);
        this.cache.update((cache) =>
            new Map(cache).set(streamId, { items, at: Date.now() })
        );
        if (this.playback.selection()?.copy.streamId === streamId) {
            this.guide.set({ streamId, items });
        }
    }

    private cancel(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
