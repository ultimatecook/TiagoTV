import { computed, inject, Injectable, signal } from '@angular/core';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import type { StreamingPlatform } from '../platforms/streaming-platforms';
import { CatalogPlatformLists } from './catalog-platform-lists';
import {
    fromStoredMembers,
    membersOf,
    mergeMembers,
    platformById,
    toStoredMembers,
    type CategoryMembers,
} from './catalog-members';
import type { CatalogKind } from './catalog-titles';

const STORAGE_KEY = 'tiagotv:platform-members:v1';
const KINDS: readonly CatalogKind[] = ['movie', 'series'];

interface MembersState {
    readonly playlistId: string;
    readonly kinds: Partial<Record<CatalogKind, CategoryMembers>>;
}

/**
 * Which titles each platform carries, by the platforms' own lists
 * (`CatalogPlatformLists`), for the stored catalog: Series, Películas and
 * Buscar read the titles the app stored, where a title sits in one
 * category only (often a genre's, not its platform's). The lists answered
 * this session count first; the ids of the last refresh (kept in
 * localStorage, a few KB) cover the categories that have not answered yet.
 */
@Injectable({ providedIn: 'root' })
export class CatalogMembership {
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly lists = inject(CatalogPlatformLists);
    private readonly state = signal<MembersState | null>(readStored());
    private readonly refreshing = new Map<CatalogKind, Promise<void>>();
    private readonly memberMaps = {
        movie: computed(() => this.computeMembers('movie')),
        series: computed(() => this.computeMembers('series')),
    };
    private readonly platformMaps = {
        movie: computed(() => this.computePlatforms('movie')),
        series: computed(() => this.computePlatforms('series')),
    };

    /** The source's members of the kind: none until a list answered. */
    members(kind: CatalogKind): CategoryMembers {
        return this.memberMaps[kind]();
    }

    /** The platform that lists the title (its stream or series id). */
    platformOf(kind: CatalogKind, id: number): StreamingPlatform | null {
        return this.platformMaps[kind]().get(id) ?? null;
    }

    /**
     * Refreshes the kind's lists in the background (each at most twice a
     * day) and keeps their members for the next launch.
     */
    refresh(kind: CatalogKind): Promise<void> {
        const playlistId = this.platforms.source()?._id;
        if (!playlistId) {
            return Promise.resolve();
        }
        let request = this.refreshing.get(kind);
        if (!request) {
            request = this.lists
                .refresh(kind)
                .then(() => this.keep(kind, playlistId))
                .finally(() => this.refreshing.delete(kind));
            this.refreshing.set(kind, request);
        }
        return request;
    }

    /** Forgets the kept members (Diagnóstico's reload). */
    clear(): void {
        this.state.set(null);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Blocked storage keeps nothing to remove.
        }
    }

    private keep(kind: CatalogKind, playlistId: string): void {
        if (this.platforms.source()?._id !== playlistId) {
            return;
        }
        const state = this.state();
        const next: MembersState = {
            playlistId,
            kinds: {
                ...(state?.playlistId === playlistId ? state.kinds : {}),
                [kind]: this.members(kind),
            },
        };
        this.state.set(next);
        writeStored(next);
    }

    private computeMembers(kind: CatalogKind): CategoryMembers {
        const state = this.state();
        const kept =
            state && state.playlistId === this.platforms.source()?._id
                ? (state.kinds[kind] ?? null)
                : null;
        const fresh = membersOf(
            this.lists.view(kind).lists.map((list) => list.titles)
        );
        return kept ? mergeMembers(kept, fresh) : fresh;
    }

    private computePlatforms(
        kind: CatalogKind
    ): ReadonlyMap<number, StreamingPlatform> {
        const shelves = this.platforms.shelves();
        const members = this.members(kind);
        return shelves && members.size > 0
            ? platformById(members, shelves, kind)
            : new Map();
    }
}

function readStored(): MembersState | null {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
        if (typeof stored?.playlistId !== 'string') {
            return null;
        }
        const kinds: Partial<Record<CatalogKind, CategoryMembers>> = {};
        for (const kind of KINDS) {
            const entry = stored.kinds?.[kind];
            if (entry) {
                kinds[kind] = fromStoredMembers(entry.members);
            }
        }
        return { playlistId: stored.playlistId, kinds };
    } catch {
        return null;
    }
}

function writeStored(state: MembersState): void {
    const kinds: Record<string, unknown> = {};
    for (const kind of KINDS) {
        const members = state.kinds[kind];
        if (members) {
            kinds[kind] = { at: Date.now(), members: toStoredMembers(members) };
        }
    }
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ playlistId: state.playlistId, kinds })
        );
    } catch {
        // A full or blocked storage only costs the next launch a refresh.
    }
}
