import { DOCUMENT } from '@angular/common';
import {
    computed,
    DestroyRef,
    effect,
    inject,
    Injectable,
    signal,
    untracked,
} from '@angular/core';

/** Media events that end a playing element's stream (or pause it). */
const STOPPED = ['pause', 'ended', 'emptied', 'abort', 'error'] as const;
/** How often the players seen playing are checked for still being there. */
const PRUNE_MS = 3000;

/**
 * Whether the app plays a stream now, as far as the catalog can tell: a
 * video or audio element is playing (a page's web player, the mini-player,
 * the radio). Embedded MPV draws natively and is not seen here; the
 * catalog's retries back off on a timer for it. The provider allows one
 * connection: while a stream holds it, its API may refuse the catalog's
 * requests, which are tried again once playback stops (`onStop`).
 */
@Injectable({ providedIn: 'root' })
export class CatalogStreamActivity {
    private readonly media = signal<ReadonlySet<EventTarget>>(new Set());
    private readonly handlers = new Set<() => void>();
    private pruner: ReturnType<typeof setInterval> | null = null;

    readonly playing = computed(() => this.media().size > 0);

    constructor() {
        const document = inject(DOCUMENT, { optional: true });
        const listeners: [string, (event: Event) => void][] = [
            ['playing', (event) => this.update(event.target, true)],
            ...STOPPED.map((type): [string, (event: Event) => void] => [
                type,
                (event) => this.update(event.target, false),
            ]),
        ];
        // Media events do not bubble: they are caught on their way down.
        for (const [type, listener] of listeners) {
            document?.addEventListener(type, listener, true);
        }
        inject(DestroyRef).onDestroy(() => {
            for (const [type, listener] of listeners) {
                document?.removeEventListener(type, listener, true);
            }
            if (this.pruner) {
                clearInterval(this.pruner);
            }
        });
        let was = false;
        effect(() => {
            const playing = this.playing();
            if (was && !playing) {
                untracked(() => this.handlers.forEach((handler) => handler()));
            }
            was = playing;
        });
    }

    /** Calls `handler` each time playback stops; the call returned ends it. */
    onStop(handler: () => void): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    private update(target: EventTarget | null, playing: boolean): void {
        if (!target || playing === this.media().has(target)) {
            return;
        }
        this.media.update((set) => {
            const next = new Set(set);
            if (playing) {
                next.add(target);
            } else {
                next.delete(target);
            }
            return next;
        });
        this.watchDetached();
    }

    /**
     * A player removed from the page pauses without the event reaching the
     * document: the elements gone (or paused) are dropped every few seconds.
     */
    private watchDetached(): void {
        if (this.pruner || this.media().size === 0) {
            return;
        }
        this.pruner = setInterval(() => {
            const live = [...this.media()].filter(isPlayingMedia);
            if (live.length !== this.media().size) {
                this.media.set(new Set(live));
            }
            if (live.length === 0 && this.pruner) {
                clearInterval(this.pruner);
                this.pruner = null;
            }
        }, PRUNE_MS);
    }
}

function isPlayingMedia(target: EventTarget): boolean {
    const element = target as Partial<HTMLMediaElement> & {
        isConnected?: boolean;
    };
    return element.isConnected !== false && element.paused !== true;
}
