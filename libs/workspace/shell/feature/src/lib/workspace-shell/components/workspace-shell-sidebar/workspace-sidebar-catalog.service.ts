import { computed, inject, Injectable } from '@angular/core';
import {
    PlatformsCatalogService,
    SPORT_SECTIONS,
    SportsCatalogService,
    type LiveChannelTile,
    type SportSection,
    type StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature';

/** A row's small brand chip: the logo, or a letter, on the brand colour. */
export interface WorkspaceSidebarChip {
    readonly background: string;
    readonly logo: string | null;
    /** Paint the logo white (single-colour marks on a dark brand colour). */
    readonly whiteLogo: boolean;
    /** The logo's size against the others, so they look even. */
    readonly logoSize: number;
    /** Written where no logo ships. */
    readonly letter: string;
    readonly letterColor: string;
}

/** A Plataformas / Deportes / Canales en vivo row of the sidebar. */
export interface WorkspaceSidebarEntry {
    readonly id: string;
    /** A brand or competition name: shown as is, not translated. */
    readonly label: string;
    readonly chip: WorkspaceSidebarChip;
    /** Opens a page… */
    readonly link?: readonly string[];
    /** …or plays (the live channels). */
    readonly run?: () => void;
}

const SPORT_ENTRIES: readonly WorkspaceSidebarEntry[] = SPORT_SECTIONS.map(
    (section: SportSection) => ({
        id: section.id,
        label: section.title,
        link: ['/workspace', 'sports', section.id],
        chip: {
            background: section.tint,
            logo: section.logo,
            whiteLogo: false,
            logoSize: section.logoSize,
            letter: section.title.charAt(0),
            letterColor: '#fff',
        },
    })
);

/**
 * The Home's platforms, competitions and live channels as sidebar rows.
 * Platforms and channels are what the source carries: they load when their
 * section opens (the Home loads the same catalogs, so usually they are
 * already there).
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceSidebarCatalogService {
    private readonly platformsCatalog = inject(PlatformsCatalogService);
    private readonly sportsCatalog = inject(SportsCatalogService);

    /** Without an Xtream source there is nothing to list. */
    readonly hasSource = computed(() => !!this.platformsCatalog.source());
    readonly platforms = computed<readonly WorkspaceSidebarEntry[] | null>(
        () =>
            this.platformsCatalog
                .shelves()
                ?.map((shelf) => platformEntry(shelf.platform)) ?? null
    );
    readonly sports = SPORT_ENTRIES;
    readonly liveChannels = computed<readonly WorkspaceSidebarEntry[]>(() =>
        this.sportsCatalog.liveChannels().map((tile) => this.channelEntry(tile))
    );
    readonly liveChannelsLoading = this.sportsCatalog.loading;

    loadPlatforms(): void {
        void this.platformsCatalog.loadShelves();
    }

    loadLiveChannels(): void {
        void this.sportsCatalog.load();
    }

    private channelEntry(tile: LiveChannelTile): WorkspaceSidebarEntry {
        return {
            id: tile.brand.id,
            label: tile.brand.name,
            run: () => this.sportsCatalog.play(tile.channel),
            chip: {
                background: tile.brand.background,
                logo: tile.brand.logo ?? tile.icon,
                whiteLogo: false,
                logoSize: tile.brand.logoSize ?? 1,
                letter: tile.brand.name.charAt(0),
                letterColor: '#fff',
            },
        };
    }
}

function platformEntry(platform: StreamingPlatform): WorkspaceSidebarEntry {
    return {
        id: platform.id,
        label: platform.name,
        link: ['/workspace', 'platforms', platform.id],
        chip: {
            background: platform.background,
            logo: platform.logo,
            whiteLogo: platform.logoTone === 'white',
            logoSize: 1,
            letter: platform.name.charAt(0).toUpperCase(),
            letterColor: platform.wordmarkColor,
        },
    };
}
