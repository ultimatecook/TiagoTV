import { clear, h } from '../core/dom';
import type { Action } from '../core/keys';
import { nav, onActivate } from '../core/nav';
import { t } from '../data/strings';
import { OFF, type MediaTracks, type TrackOption } from '../player/tracks';
import { icon } from './icons';

/**
 * The player's "Subtítulos" and "Audio" buttons (in the OSD, bottom
 * right) and the list each one opens, for the remote: Down shows the
 * buttons, Left/Right move along them, OK opens a list, Up/Down walk it,
 * OK picks (the list closes, the OSD fades) and Back steps out. The
 * Magic Remote's pointer works too (hover focuses, click is OK).
 *
 * "Subtítulos" always shows on a movie or an episode, so the viewer can
 * ask; with no track it says so. "Audio" shows only when the file has
 * more than one track. Each button says what plays.
 */
export interface TrackMenuHooks {
    /** Whether the OSD (and so the buttons) is on screen. */
    shown(): boolean;
    /** The buttons or a list took the remote: keep the OSD up. */
    hold(): void;
    /** The viewer is done with them: the OSD may fade. */
    release(): void;
    /** A list opened or closed (the subtitles make room for it). */
    listed(open: boolean): void;
}

type Kind = 'subtitles' | 'audio';

const NO_SUBTITLES = 'Sin subtítulos en este archivo';

export class TrackMenu {
    readonly controls = h('div', 'osd__controls');
    readonly panel = h('div', 'tracks');
    private readonly subtitlesButton = h('div', 'button button--small osd__track');
    private readonly audioButton = h('div', 'button button--small osd__track');
    private open: Kind | null = null;
    /** Movies and episodes offer subtitles even with none (to say so). */
    alwaysSubtitles = false;

    constructor(
        private readonly tracks: MediaTracks,
        private readonly hooks: TrackMenuHooks
    ) {
        onActivate(this.subtitlesButton, () => this.show('subtitles'));
        onActivate(this.audioButton, () => this.show('audio'));
        this.controls.appendChild(this.subtitlesButton);
        this.controls.appendChild(this.audioButton);
        this.panel.style.display = 'none';
        this.render();
    }

    private buttons(): HTMLElement[] {
        return [this.subtitlesButton, this.audioButton].filter((button) => button.style.display !== 'none');
    }

    get hasButtons(): boolean {
        return this.buttons().length > 0;
    }

    /** The remote is on the buttons or a list. */
    get active(): boolean {
        if (this.open) {
            return true;
        }
        const focused = nav.focused;
        return !!focused && this.controls.contains(focused) && this.hooks.shown();
    }

    private currentName(options: readonly TrackOption[], id: string | null): string {
        const option = options.find((each) => each.id === id);
        return option ? option.name : '';
    }

    /** The buttons' labels and visibility, from the tracks. */
    render(): void {
        const subtitles = this.tracks.subtitleOptions();
        const audio = this.tracks.audioOptions();
        const chosen = this.tracks.subtitleChoice();
        const subtitleName = chosen === OFF ? t('EMBEDDED_MPV.PLAYER.SUBTITLES_OFF') : this.currentName(subtitles, chosen);
        this.subtitlesButton.textContent = t('EMBEDDED_MPV.PLAYER.SUBTITLES_TOOLTIP', { subtitles: subtitleName });
        this.subtitlesButton.style.display = subtitles.length > 0 || this.alwaysSubtitles ? '' : 'none';
        const audioName = this.currentName(audio, this.tracks.audioChoice());
        this.audioButton.textContent = `${t('EMBEDDED_MPV.PLAYER.STATS_AUDIO')}${audioName ? `: ${audioName}` : ''}`;
        this.audioButton.style.display = audio.length > 1 ? '' : 'none';
        this.controls.style.display = this.hasButtons ? '' : 'none';
        if (this.open) {
            this.show(this.open, false);
        }
        const focused = nav.focused;
        if (focused && this.controls.contains(focused) && focused.style.display === 'none') {
            nav.focus(this.buttons()[0] ?? null);
        }
    }

    /** Down in the player: the remote goes to the first button. */
    enter(): boolean {
        const first = this.buttons()[0];
        if (!first) {
            return false;
        }
        nav.focus(first);
        this.hooks.hold();
        return true;
    }

    /** Opens (or redraws) a list. */
    private show(kind: Kind, focusCurrent = true): void {
        this.open = kind;
        this.hooks.hold();
        clear(this.panel);
        const subtitles = kind === 'subtitles';
        const options = subtitles ? this.tracks.subtitleOptions() : this.tracks.audioOptions();
        const current = subtitles ? this.tracks.subtitleChoice() : this.tracks.audioChoice();
        this.panel.appendChild(
            h('div', { className: 'tracks__title', text: subtitles ? t('EMBEDDED_MPV.PLAYER.SUBTITLES') : t('EMBEDDED_MPV.PLAYER.AUDIO_TRACKS') })
        );
        this.panel.style.display = '';
        this.hooks.listed(true);
        if (subtitles && options.length === 0) {
            this.panel.appendChild(h('p', { className: 'tracks__empty', text: NO_SUBTITLES }));
            return;
        }
        const rows = subtitles ? [{ id: OFF, name: t('EMBEDDED_MPV.PLAYER.SUBTITLES_OFF'), language: '' }, ...options] : options.slice();
        let focus: HTMLElement | null = null;
        for (const option of rows) {
            const isCurrent = option.id === current;
            const row = h('div', `tracks__item${isCurrent ? ' is-current' : ''}`, icon('check', 'tracks__check'), h('span', { text: option.name }));
            onActivate(row, () => this.pick(kind, option.id));
            this.panel.appendChild(row);
            if (isCurrent || !focus) {
                focus = row;
            }
        }
        if (focusCurrent || !nav.focused || !this.panel.contains(nav.focused)) {
            nav.focus(focus);
        }
    }

    /** The list closes first: the choice then redraws only the buttons. */
    private pick(kind: Kind, id: string): void {
        this.leave();
        if (kind === 'subtitles') {
            this.tracks.chooseSubtitles(id);
        } else {
            this.tracks.chooseAudio(id);
        }
    }

    private closeList(): void {
        const kind = this.open;
        this.open = null;
        clear(this.panel);
        this.panel.style.display = 'none';
        this.hooks.listed(false);
        nav.focus(kind === 'audio' ? this.audioButton : this.subtitlesButton);
    }

    /** Out of the buttons and lists: the OSD fades as usual. */
    leave(): void {
        const was = this.active;
        this.open = null;
        clear(this.panel);
        this.panel.style.display = 'none';
        this.hooks.listed(false);
        if (nav.focused && (this.controls.contains(nav.focused) || this.panel.contains(nav.focused))) {
            nav.focus(null);
        }
        if (was) {
            this.hooks.release();
        }
    }

    /** Keys while the buttons or a list have the remote; false otherwise. */
    onKey(action: Action): boolean {
        if (!this.active) {
            return false;
        }
        if (this.open) {
            const items = Array.prototype.slice.call(this.panel.querySelectorAll('.tracks__item')) as HTMLElement[];
            const index = nav.focused ? items.indexOf(nav.focused) : -1;
            if (items.length === 0 && (action === 'ok' || action === 'up' || action === 'down')) {
                this.closeList();
            } else if (action === 'up' || action === 'down') {
                const next = items[Math.max(0, Math.min(items.length - 1, index + (action === 'down' ? 1 : -1)))];
                nav.focus(next ?? null);
            } else if (action === 'ok') {
                nav.activate();
            }
            return action === 'ok' || action === 'up' || action === 'down' || action === 'left' || action === 'right';
        }
        const buttons = this.buttons();
        const index = nav.focused ? buttons.indexOf(nav.focused) : -1;
        switch (action) {
            case 'left':
            case 'right': {
                const next = buttons[index + (action === 'right' ? 1 : -1)];
                if (next) {
                    nav.focus(next);
                }
                return true;
            }
            case 'ok':
                nav.activate();
                return true;
            case 'up':
                this.leave();
                return true;
            case 'down':
                return true;
            default:
                return false;
        }
    }

    /** Back: closes the list, then leaves the buttons; false when neither. */
    onBack(): boolean {
        if (this.open) {
            this.closeList();
            return true;
        }
        if (this.active) {
            this.leave();
            return true;
        }
        return false;
    }
}
