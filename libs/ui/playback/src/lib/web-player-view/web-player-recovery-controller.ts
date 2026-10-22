import {
    computed,
    signal,
    untracked,
    type Signal,
    type WritableSignal,
} from '@angular/core';
import {
    createPlaybackDiagnostic,
    createPlaybackSourceMetadata,
    PlaybackDiagnosticCode,
    PlaybackDiagnosticSource,
    type PlaybackDiagnostic,
    type PlaybackFallbackRequest,
} from '@iptvnator/playback/util';
import {
    VideoPlayer,
    type ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import type { ExternalPlaybackRecoveryCoordinator } from './external-playback-recovery-coordinator';
import type {
    PlaybackBinding,
    PlaybackRecoverySession,
} from './playback-recovery-session';
import type { WebPlayerApplicationHandoffCoordinator } from './web-player-application-handoff';
import type { WebPlayerApplicationToken } from './web-player-application-state';
import type { WebPlayerLiveAutoFormat } from './web-player-live-auto-format';
import { WebPlayerLiveStartGuard } from './web-player-live-start-guard';
import {
    createWebPlayerRecommendations,
    EMBEDDED_MPV_TARGET,
    type DiagnosticPlayerTarget,
} from './web-player-recovery-policy';

export interface WebPlayerRecoveryControllerDeps {
    readonly recoverySession: PlaybackRecoverySession;
    readonly externalRecovery: ExternalPlaybackRecoveryCoordinator;
    readonly applicationHandoff: WebPlayerApplicationHandoffCoordinator;
    readonly playbackSessionKey: Signal<string>;
    readonly playback: Signal<ResolvedPortalPlayback | null>;
    readonly streamUrl: Signal<string>;
    readonly startTime: Signal<number>;
    readonly selectedPlayer: Signal<VideoPlayer>;
    readonly reloadToken: WritableSignal<number>;
    readonly playbackApplicationToken: Signal<WebPlayerApplicationToken>;
    readonly resolvedPlayback: Signal<ResolvedPortalPlayback>;
    readonly resolvedIsLive: Signal<boolean>;
    readonly playbackExternallyTransferable: Signal<boolean>;
    readonly alternativeSourceCount: () => number;
    readonly managedExternalPlayersAvailable: () => boolean;
    readonly liveAutoFormat?: Pick<
        WebPlayerLiveAutoFormat,
        'tryFallback' | 'started' | 'pending'
    >;
    /** The rendered engine's media element, for live-start progress. */
    readonly mediaElement?: () => HTMLMediaElement | null;
    readonly emitPlaybackFailed: (code: PlaybackDiagnosticCode) => void;
    readonly emitExternalFallbackRequested: (
        request: PlaybackFallbackRequest
    ) => void;
}

/**
 * Owns the web player view's diagnostic/recovery surface: diagnostic
 * ownership, recommended-player switching, retry, and session sync. The
 * component remains the template-facing facade and delegates here.
 */
export class WebPlayerRecoveryController {
    readonly playbackDiagnostic = signal<PlaybackDiagnostic | null>(null);
    // Diagnostic ownership follows raw intent so an old action disappears;
    // the application effect then clears its backing state before handoff.
    // Keep this token opaque: it must never retain playback payload fields.
    readonly diagnosticIntentToken = computed<WebPlayerApplicationToken>(() => {
        if (this.deps.playback() === null) {
            void this.deps.streamUrl();
            void this.deps.startTime();
        }
        void this.deps.selectedPlayer();
        void this.deps.reloadToken();
        return Symbol();
    });
    private readonly diagnosticOwnerToken =
        signal<WebPlayerApplicationToken | null>(null);
    readonly visiblePlaybackDiagnostic = computed(() =>
        this.deps.selectedPlayer() === VideoPlayer.EmbeddedMpv ||
        this.diagnosticOwnerToken() !== this.diagnosticIntentToken()
            ? null
            : this.playbackDiagnostic()
    );
    readonly recommendations = computed(() => {
        const binding = this.deps.recoverySession.activeBinding();
        const token = this.deps.playbackApplicationToken();
        return createWebPlayerRecommendations({
            diagnostic: this.visiblePlaybackDiagnostic(),
            binding:
                binding && this.deps.applicationHandoff.owns(binding, token)
                    ? binding
                    : null,
            attemptedTargets: this.deps.recoverySession.attemptedTargets(),
            externalStates: this.deps.externalRecovery.states(),
            managedExternalPlayersAvailable:
                this.deps.managedExternalPlayersAvailable(),
            playbackExternallyTransferable:
                this.deps.playbackExternallyTransferable(),
            isLive: this.deps.resolvedIsLive(),
            alternativeSourceCount: this.deps.alternativeSourceCount(),
        });
    });

    private readonly liveStart = new WebPlayerLiveStartGuard({
        release: () => this.releaseApplication(),
        reopen: () => this.deps.reloadToken.update((value) => value + 1),
        giveUp: () => this.reportStalledStart(),
        media: () => this.deps.mediaElement?.() ?? null,
    });

    constructor(private readonly deps: WebPlayerRecoveryControllerDeps) {}

    /** A new application started; live ones are watched until they play. */
    watchApplication(token: WebPlayerApplicationToken, isLive: boolean): void {
        this.liveStart.watch(token, isLive);
    }

    handlePlaybackStarted(binding: PlaybackBinding): void {
        this.syncSession();
        const liveAutoFormat = this.deps.liveAutoFormat;
        if (
            !this.deps.applicationHandoff.owns(
                binding,
                this.deps.playbackApplicationToken()
            ) ||
            liveAutoFormat?.pending()
        ) {
            return;
        }
        liveAutoFormat?.started();
        this.liveStart.started();
    }

    handlePlaybackIssue(
        issue: PlaybackDiagnostic | null,
        binding: PlaybackBinding
    ): void {
        const { recoverySession, applicationHandoff } = this.deps;
        this.syncSession();
        if (!recoverySession.accepts(binding)) {
            return;
        }
        if (
            !applicationHandoff.owns(
                binding,
                this.deps.playbackApplicationToken()
            )
        ) {
            applicationHandoff.invalidate();
            recoverySession.clearPlaybackBinding();
            this.clearDiagnostic();
            return;
        }
        if (!issue) {
            recoverySession.settle(binding);
            this.clearDiagnostic();
            return;
        }
        if (this.deps.liveAutoFormat?.tryFallback(issue)) {
            this.liveStart.stop();
            this.releaseApplication();
            return;
        }
        if (this.liveStart.retry(issue, this.deps.playbackApplicationToken())) {
            return;
        }
        if (!recoverySession.recordFailure(binding)) {
            return;
        }
        this.diagnosticOwnerToken.set(this.diagnosticIntentToken());
        this.playbackDiagnostic.set(issue);
        this.deps.emitPlaybackFailed(issue.code);
    }

    requestRecommendedPlayer(target: DiagnosticPlayerTarget): void {
        const { recoverySession, externalRecovery } = this.deps;
        const diagnostic = this.visiblePlaybackDiagnostic();
        if (!diagnostic) {
            return;
        }
        if (target === EMBEDDED_MPV_TARGET) {
            // The failing engine unmounts (its connection with it) before
            // Embedded MPV opens the stream: one stream at a time.
            recoverySession.useEmbeddedMpv();
            return;
        }
        const available = this.recommendations().some(
            (item) => item.action === 'player' && item.target === target
        );
        if (!available) {
            if (target !== 'mpv' && target !== 'vlc') {
                recoverySession.recordInlineAttempt(target);
            }
            return;
        }
        if (target === 'mpv' || target === 'vlc') {
            externalRecovery.request(
                target,
                () => recoverySession.recordExternalAttempt(target),
                (trackLaunch) => {
                    if (this.visiblePlaybackDiagnostic() !== diagnostic) {
                        return false;
                    }
                    this.deps.emitExternalFallbackRequested({
                        player: target,
                        playback: this.deps.resolvedPlayback(),
                        diagnostic,
                        trackLaunch,
                    });
                    return true;
                }
            );
            return;
        }
        recoverySession.beginPlayerSwitch(target, this.deps.resolvedIsLive());
    }

    retryPlayback(): void {
        if (!this.deps.recoverySession.beginRetry()) {
            return;
        }
        this.deps.reloadToken.update((value) => value + 1);
    }

    syncSession(): void {
        const sessionKey = this.deps.playbackSessionKey();
        this.deps.externalRecovery.syncSession(sessionKey);
        if (
            untracked(() => this.deps.recoverySession.syncSession(sessionKey))
        ) {
            this.clearDiagnostic();
        }
    }

    clearDiagnostic(): void {
        this.diagnosticOwnerToken.set(null);
        this.playbackDiagnostic.set(null);
    }

    destroy(): void {
        this.liveStart.stop();
    }

    /** Unmounts the engine: its connection closes before anything reopens. */
    private releaseApplication(): void {
        this.deps.applicationHandoff.invalidate();
        this.deps.recoverySession.clearPlaybackBinding();
        this.clearDiagnostic();
    }

    /** A live start that never played, retries spent: the usual diagnostic. */
    private reportStalledStart(): void {
        const binding = this.deps.recoverySession.activeBinding();
        if (!binding) {
            return;
        }
        this.handlePlaybackIssue(
            createPlaybackDiagnostic({
                code: PlaybackDiagnosticCode.NetworkError,
                source: PlaybackDiagnosticSource.Source,
                metadata: createPlaybackSourceMetadata({
                    url: this.deps.resolvedPlayback().streamUrl,
                    player: binding.target,
                }),
                details: 'start-timeout',
            }),
            binding
        );
    }
}
