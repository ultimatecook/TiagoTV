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
import { nowAndNext, type TvNowNext } from '../countries/country-tv-epg';
import { SportTvPlayback } from './sport-tv-playback';
import { SportsCatalogService } from './sports-catalog.service';

/** A switch has to settle this long before its guide is asked for. */
const GUIDE_DELAY_MS = 900;
/** A channel's guide is asked for again after this long. */
const GUIDE_TTL_MS = 10 * 60 * 1000;
const CLOCK_MS = 30 * 1000;

/**
 * Now and next on a competition page's playing channel, loaded the way the
 * live view loads a channel's guide (the uploaded XMLTV, the manual
 * mapping, then the provider's guide for that one channel), once the
 * picked channel has stayed a moment and only where the app reads guides.
 * Each channel is asked for at most once in ten minutes.
 *
 * Component-provided, beside `SportTvPlayback`.
 */
@Injectable()
export class SportTvGuide {
    private readonly playback = inject(SportTvPlayback);
    private readonly sports = inject(SportsCatalogService);
    private readonly resolver = inject(StreamResolverService);
    private readonly settings = inject(SettingsStore);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly cache = new Map<
        number,
        { items: EpgItem[]; at: number }
    >();
    private readonly guide = signal<{ streamId: number; items: EpgItem[] }>({
        streamId: 0,
        items: [],
    });
    private readonly clock = signal(Date.now());
    private timer: ReturnType<typeof setTimeout> | null = null;

    readonly nowNext = computed<TvNowNext | null>(() => {
        const streamId = this.playback.selection()?.streamId;
        const guide = this.guide();
        if (!streamId || guide.streamId !== streamId) {
            return null;
        }
        const offset = this.settings.resolvedEpgOffsetMinutes();
        return nowAndNext(
            guide.items,
            epgProviderClockMs(this.clock(), offset),
            offset
        );
    });

    constructor() {
        const ticker = setInterval(() => this.clock.set(Date.now()), CLOCK_MS);
        inject(DestroyRef).onDestroy(() => {
            clearInterval(ticker);
            this.cancel();
        });
        effect(() => {
            const channel = this.playback.selection();
            const playing =
                !!this.playback.playback() || !this.playback.embedded();
            untracked(() => {
                this.cancel();
                if (channel && playing && this.runtime.supportsEpg) {
                    this.timer = setTimeout(
                        () => void this.load(channel.streamId, channel.title),
                        GUIDE_DELAY_MS
                    );
                }
            });
        });
    }

    private async load(streamId: number, name: string): Promise<void> {
        const cached = this.cache.get(streamId);
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
        this.cache.set(streamId, { items, at: Date.now() });
        if (this.playback.selection()?.streamId === streamId) {
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
