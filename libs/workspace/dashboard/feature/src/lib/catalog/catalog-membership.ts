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

/** The platforms' line-ups change with the provider's uploads. */
const FRESH_MS = 12 * 60 * 60 * 1000;
/** A refresh that got nothing (or not everything) is tried again then. */
const RETRY_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'tiagotv:platform-members:v1';
const KINDS: readonly CatalogKind[] = ['movie', 'series'];
const NONE: CategoryMembers = new Map();

interface KindMembers {
    /** When the members were asked; a partial answer is due sooner. */
    readonly at: number;
    readonly members: CategoryMembers;
}

interface MembersState {
    readonly playlistId: string;
    readonly kinds: Partial<Record<CatalogKind, KindMembers>>;
}

/**
 * Which titles each platform carries, by the platforms' own lists, kept
 * for the stored catalog: Series, Películas and Buscar read the titles the
 * app stored, where a title sits in one category only (often a genre's,
 * not its platform's). Refreshed in the background, one category at a
 * time, at most twice a day; the last answer persists across launches.
 */
@Injectable({ providedIn: 'root' })
export class CatalogMembership {
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly lists = inject(CatalogPlatformLists);
    private readonly state = signal<MembersState | null>(readStored());
    private readonly refreshing = new Map<CatalogKind, Promise<void>>();
    private readonly platformMaps = {
        movie: computed(() => this.computePlatforms('movie')),
        series: computed(() => this.computePlatforms('series')),
    };

    /** The source's members of the kind: none until a refresh answered. */
    members(kind: CatalogKind): CategoryMembers {
        return this.kindMembers(kind)?.members ?? NONE;
    }

    /** The platform that lists the title (its stream or series id). */
    platformOf(kind: CatalogKind, id: number): StreamingPlatform | null {
        return this.platformMaps[kind]().get(id) ?? null;
    }

    /** Asks the platforms' lists of the kind, unless a recent answer holds. */
    refresh(kind: CatalogKind): Promise<void> {
        const playlistId = this.platforms.source()?._id;
        const known = this.kindMembers(kind);
        if (!playlistId || (known && Date.now() < known.at + FRESH_MS)) {
            return Promise.resolve();
        }
        let request = this.refreshing.get(kind);
        if (!request) {
            request = this.load(kind, playlistId).finally(() =>
                this.refreshing.delete(kind)
            );
            this.refreshing.set(kind, request);
        }
        return request;
    }

    private async load(kind: CatalogKind, playlistId: string): Promise<void> {
        await this.lists.load(kind);
        if (this.platforms.source()?._id !== playlistId) {
            return;
        }
        const view = this.lists.view(kind);
        const fresh = membersOf(view.lists.map((list) => list.titles));
        const complete = view.total > 0 && view.failed === 0;
        // Retried in RETRY_MS: `at` as if FRESH_MS ago, less that.
        const at = complete ? Date.now() : Date.now() - FRESH_MS + RETRY_MS;
        const members = mergeMembers(this.members(kind), fresh);
        const state = this.state();
        const next: MembersState = {
            playlistId,
            kinds: {
                ...(state?.playlistId === playlistId ? state.kinds : {}),
                [kind]: { at, members },
            },
        };
        this.state.set(next);
        writeStored(next);
    }

    private kindMembers(kind: CatalogKind): KindMembers | null {
        const state = this.state();
        return state && state.playlistId === this.platforms.source()?._id
            ? (state.kinds[kind] ?? null)
            : null;
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
        const kinds: Partial<Record<CatalogKind, KindMembers>> = {};
        for (const kind of KINDS) {
            const entry = stored.kinds?.[kind];
            if (entry && Number.isFinite(entry.at)) {
                kinds[kind] = {
                    at: entry.at,
                    members: fromStoredMembers(entry.members),
                };
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
        const entry = state.kinds[kind];
        if (entry) {
            kinds[kind] = {
                at: entry.at,
                members: toStoredMembers(entry.members),
            };
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
