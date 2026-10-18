import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { buildXtreamNavigationTarget } from '@iptvnator/portal/shared/util';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import {
    primaryXtreamSource,
    xtreamSourceCredentials,
    type XtreamSourceCredentials,
} from '../xtream-source';
import { TeamCrestResolver } from './team-crests';
import {
    buildSportsCatalog,
    todaysMatches,
    type SportChannel,
    type SportsCatalog,
} from './sports-catalog';

/** Event channels rename themselves through the day: a short cache. */
const FRESH_MS = 3 * 60 * 1000;

interface LoadedCatalog {
    readonly playlistId: string;
    readonly catalog: SportsCatalog;
    readonly at: number;
}

/**
 * The sports view of the Xtream source: loads its live catalog fresh from
 * the panel (the local copy holds the event names of import time) and
 * opens a channel in the live player.
 */
@Injectable({ providedIn: 'root' })
export class SportsCatalogService {
    private readonly api = inject(XtreamApiService);
    private readonly router = inject(Router);
    private readonly playlists = inject(Store).selectSignal(
        selectAllPlaylistsMeta
    );
    private readonly loaded = signal<LoadedCatalog | null>(null);
    private inFlight: Promise<void> | null = null;

    readonly crests = new TeamCrestResolver({
        fetchJson: async (url) => {
            const response = await fetch(url);
            return response.ok ? response.json() : null;
        },
        storage: browserStorage(),
    });
    readonly loading = signal(false);
    readonly failed = signal(false);
    readonly source = computed(() => primaryXtreamSource(this.playlists()));
    readonly catalog = computed(() => {
        const loaded = this.loaded();
        return loaded && loaded.playlistId === this.source()?._id
            ? loaded.catalog
            : null;
    });
    readonly today = computed(() => {
        const catalog = this.catalog();
        return catalog ? todaysMatches(catalog) : [];
    });

    /** Loads the catalog unless a fresh one is held. */
    load(): Promise<void> {
        const source = this.source();
        const loaded = this.loaded();
        if (
            !source ||
            (loaded?.playlistId === source._id &&
                Date.now() - loaded.at < FRESH_MS)
        ) {
            return Promise.resolve();
        }
        this.inFlight ??= this.fetch(
            source._id,
            xtreamSourceCredentials(source)
        ).finally(() => (this.inFlight = null));
        return this.inFlight;
    }

    play(channel: SportChannel): void {
        const source = this.source();
        if (!source) {
            return;
        }
        const target = buildXtreamNavigationTarget({
            playlistId: source._id,
            type: 'live',
            categoryId: channel.categoryId,
            itemId: channel.streamId,
            title: channel.title,
            imageUrl: channel.icon,
        });
        void this.router.navigate(target.link, { state: target.state });
    }

    private async fetch(
        playlistId: string,
        credentials: XtreamSourceCredentials
    ): Promise<void> {
        this.loading.set(true);
        this.failed.set(false);
        try {
            const options = { suppressErrorLog: true };
            const [categories, streams] = await Promise.all([
                this.api.getCategories(credentials, 'live', options),
                this.api.getLiveStreams(credentials, options),
            ]);
            this.loaded.set({
                playlistId,
                catalog: buildSportsCatalog(categories, streams),
                at: Date.now(),
            });
        } catch {
            this.failed.set(true);
        } finally {
            this.loading.set(false);
        }
    }
}

function browserStorage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}
