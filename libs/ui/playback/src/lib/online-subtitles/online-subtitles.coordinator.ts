import {
    computed,
    effect,
    EnvironmentInjector,
    inject,
    Injectable,
    signal,
    type Signal,
    untracked,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
    isOpenSubtitlesError,
    LazySnackBar,
    OpenSubtitlesService,
    SettingsStore,
    type SubtitleLookup,
    TitlePlatformStore,
} from '@iptvnator/services';
import {
    normalizeAudioLanguage,
    type ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import type {
    PlayerController,
    PlayerControlsState,
} from '../player-controls/player-controls.model';
import { activePlayerController, onlineSubtitleSearch } from './active-player';
import {
    formatResetTime,
    onlineSubtitlesErrorMessage,
} from './online-subtitles-messages';
import { PlayerTrackPreferences } from './player-track-preferences';
import { playbackContentKey, subtitleLookupFor } from './subtitle-lookup';
import { isSpanishTrack, matchesSubtitleLanguage } from './track-preference';

/** Embedded tracks show up shortly after the first frame; wait for them. */
export const AUTO_SEARCH_DELAY_MS = 3000;
const TOAST_MS = 4000;

/**
 * The movie or episode playing in a player host, and what the app does
 * for its language: the audio-language track choice on web players
 * (`PlayerTrackPreferences`) and, when the file carries no subtitle in the
 * user's language, a subtitle from OpenSubtitles (`OpenSubtitlesService`),
 * attached through the player's `subtitleAttachment`. A search runs once
 * per title and player by itself (Settings → Playback → "Search
 * automatically"), or when the user picks "Search OpenSubtitles…".
 */
@Injectable({ providedIn: 'root' })
export class OnlineSubtitlesCoordinator {
    private readonly injector = inject(EnvironmentInjector);
    private readonly subtitles = inject(OpenSubtitlesService);
    private readonly settings = inject(SettingsStore);
    private readonly titles = inject(TitlePlatformStore);
    private readonly snackBar = inject(LazySnackBar);
    private readonly translate = inject(TranslateService);
    private readonly tracks = new PlayerTrackPreferences();
    private readonly hosts = signal<
        readonly Signal<ResolvedPortalPlayback | null>[]
    >([]);
    private started = false;
    private attempted = new Set<string>();
    private playingSince = new Map<string, number>();
    private attemptController: PlayerController | null = null;
    private warnedUpdate = false;

    readonly playback = computed(() => {
        const hosts = this.hosts();
        return hosts.length > 0 ? hosts[hosts.length - 1]() : null;
    });
    readonly lookup = computed(() =>
        subtitleLookupFor(this.playback(), this.titles.title())
    );
    readonly searching = signal(false);
    /** "Search OpenSubtitles…" in the player's subtitle menu (desktop). */
    readonly canSearch = computed(
        () =>
            !!this.lookup() &&
            !!activePlayerController()?.subtitleAttachment &&
            typeof window !== 'undefined' &&
            !!window.electron
    );

    /** A player host plays `playback` until the returned function is called. */
    follow(playback: Signal<ResolvedPortalPlayback | null>): () => void {
        this.start();
        this.hosts.update((list) => [...list, playback]);
        return () =>
            this.hosts.update((list) =>
                list.filter((item) => item !== playback)
            );
    }

    /** The user asked: search now, whatever was tried before. */
    searchNow(): void {
        const controller = activePlayerController();
        const lookup = this.lookup();
        const key = playbackContentKey(this.playback());
        if (controller && lookup && key && !this.searching()) {
            void this.run(controller, lookup, key, true);
        }
    }

    private start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        onlineSubtitleSearch.set({
            canSearch: this.canSearch,
            searching: this.searching,
            search: () => this.searchNow(),
        });
        effect(
            () => {
                const controller = activePlayerController();
                const key = playbackContentKey(this.playback());
                if (!controller || !key) {
                    return;
                }
                const state = controller.state();
                untracked(() => this.onState(controller, state, key));
            },
            { injector: this.injector }
        );
    }

    private onState(
        controller: PlayerController,
        state: PlayerControlsState,
        key: string
    ): void {
        const preference = normalizeAudioLanguage(
            this.settings.audioLanguage?.()
        );
        this.tracks.apply(controller, state, key, preference);
        if (controller !== this.attemptController) {
            this.attemptController = controller;
            this.attempted = new Set();
            this.playingSince = new Map();
        }
        if (state.status !== 'playing' || state.isLive) {
            return;
        }
        const since = this.playingSince.get(key) ?? Date.now();
        this.playingSince.set(key, since);
        const lookup = this.lookup();
        if (
            !lookup ||
            this.attempted.has(key) ||
            this.searching() ||
            Date.now() - since < AUTO_SEARCH_DELAY_MS ||
            !this.wantsSubtitle(state)
        ) {
            return;
        }
        this.attempted.add(key);
        if (this.subtitles.availability() === 'ready') {
            void this.run(controller, lookup, key, false);
        } else if (
            this.subtitles.availability() === 'unavailable' &&
            this.subtitles.account().apiKey &&
            !this.warnedUpdate
        ) {
            this.warnedUpdate = true;
            this.toast('OPEN_SUBTITLES.NEEDS_UPDATE');
        }
    }

    /** No subtitle in the user's languages, and audio not already in it. */
    private wantsSubtitle(state: PlayerControlsState): boolean {
        const account = this.subtitles.account();
        if (!account.autoSearch) {
            return false;
        }
        const languages = this.subtitles.languages(account);
        const hasOne = state.subtitleTracks.some((track) =>
            languages.some((code) => matchesSubtitleLanguage(track, code))
        );
        const spanishWanted = ['es', 'sp', 'ea'].includes(account.language);
        const audio =
            state.audioTracks.find((track) => track.selected) ??
            (state.audioTracks.length === 1 ? state.audioTracks[0] : null);
        const spanishAudio = audio
            ? isSpanishTrack(audio)
            : this.titles.versions().find((version) => version.current)
                  ?.language === 'ES';
        return !hasOne && !(spanishWanted && spanishAudio);
    }

    private async run(
        controller: PlayerController,
        lookup: SubtitleLookup,
        key: string,
        manual: boolean
    ): Promise<void> {
        const attachment = controller.subtitleAttachment;
        if (!attachment?.canAttach()) {
            if (manual || !this.warnedUpdate) {
                this.warnedUpdate = true;
                this.toast('OPEN_SUBTITLES.NEEDS_UPDATE');
            }
            return;
        }
        this.searching.set(true);
        if (manual) {
            this.toast('OPEN_SUBTITLES.SEARCHING');
        }
        try {
            const found = await this.subtitles.find(lookup);
            if (
                activePlayerController() !== controller ||
                playbackContentKey(this.playback()) !== key
            ) {
                return;
            }
            const language = this.languageName(found.language);
            const attached = await attachment.attach({
                name: this.translate.instant('OPEN_SUBTITLES.TRACK_LABEL', {
                    language,
                }),
                format: 'vtt',
                content: found.content,
                language: ['es', 'sp', 'ea'].includes(found.language)
                    ? 'es'
                    : found.language,
            });
            this.toast(
                attached
                    ? 'OPEN_SUBTITLES.ATTACHED'
                    : 'OPEN_SUBTITLES.ATTACH_FAILED',
                { language }
            );
        } catch (error) {
            if (!isOpenSubtitlesError(error)) {
                return;
            }
            const message = onlineSubtitlesErrorMessage(error.kind, {
                manual,
                language: this.languageName(this.subtitles.account().language),
                resetTime: formatResetTime(
                    error.resetAt,
                    this.translate.currentLang
                ),
            });
            if (message) {
                this.toast(message.key, message.params);
            }
        } finally {
            this.searching.set(false);
        }
    }

    private languageName(code: string): string {
        const key = `OPEN_SUBTITLES.LANGUAGES.${code}`;
        const name = this.translate.instant(key);
        return name && name !== key ? name : code;
    }

    private toast(key: string, params?: Record<string, string>): void {
        void this.snackBar.open(
            this.translate.instant(key, params),
            undefined,
            { duration: TOAST_MS }
        );
    }
}
