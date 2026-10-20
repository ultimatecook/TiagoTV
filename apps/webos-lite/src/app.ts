import type { PlatformTitle, SportSectionId } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { ScreenStack } from './core/screens';
import type { CatalogCache } from './data/catalog-cache';
import type { CatalogStore } from './data/catalog-store';
import type { SubtitleSource } from './data/media-info';
import type { SportsBoard } from './data/sports-board';
import type { PlayerEngine } from './player/engine';
import type { XtreamClient } from './xtream/client';
import type { Preferences } from './xtream/source';

/**
 * What the screens share, wired in main.ts (so screens import each other
 * only as types).
 */
export type PlayKind = 'live' | 'movie' | 'episode';

export interface PlayItem {
    readonly kind: PlayKind;
    readonly id: number;
    readonly title: string;
    /** The programme line under a channel, the episode's show. */
    readonly subtitle?: string | null;
    readonly logo?: string | null;
    /** A channel's country (ES, AR…), for "Últimos canales vistos". */
    readonly country?: string | null;
    readonly extension?: string;
    readonly poster?: string | null;
    readonly seriesId?: number;
    readonly seriesTitle?: string;
    readonly season?: number;
    readonly episode?: number;
    readonly duration?: number;
    /** Subtitle files the provider lists (its title page), in memory only. */
    readonly subtitles?: readonly SubtitleSource[];
    /** The file's audio language as the provider probed it ("eng"). */
    readonly audioLanguage?: string | null;
}

export interface PlayRequest {
    /** The row it plays from: channel up/down zaps along it. */
    readonly items: readonly PlayItem[];
    readonly index: number;
    readonly startAt?: number;
    /** The player moved along the row (zapping, next episode). */
    readonly onIndexChange?: (index: number) => void;
}

export interface OpenTitleOptions {
    /** "Empezar T1 · E1": play the first episode once it is known. */
    readonly autoplay?: boolean;
}

export interface App {
    readonly stack: ScreenStack;
    readonly client: XtreamClient;
    readonly cache: CatalogCache;
    /** The platforms' catalog (Series, Películas, platform pages). */
    readonly store: CatalogStore;
    /** Today's matches and the competitions' channels. */
    readonly sports: SportsBoard;
    /** The one `<video>` and its single connection. */
    readonly engine: PlayerEngine;
    readonly version: string;
    play(request: PlayRequest): void;
    /** A movie's or series' page. */
    openTitle(title: PlatformTitle, options?: OpenTitleOptions): void;
    /** A streaming platform's page (Netflix, Prime Video…). */
    openPlatform(platformId: string): void;
    /** A competition's page (LaLiga, Premier League…). */
    openLeague(sectionId: SportSectionId): void;
    /** One of the bar's pages (Inicio, Deportes…, Buscar, Ajustes). */
    openTab(id: string): void;
    /** En vivo's idle picture: the bar steps aside, and comes back. */
    setBarHidden(hidden: boolean): void;
    openSetup(): void;
    prefs(): Preferences;
    setPrefs(change: Partial<Preferences>): void;
    /** Leaves the app (the TV's Back on the root screen). */
    exit(): void;
    /** Asks again what failed to load (Ajustes → Diagnóstico). */
    retryLoads(): void;
}
