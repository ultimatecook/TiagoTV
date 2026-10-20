import { clear, h, picture } from '../core/dom';
import { clockTime, timecode } from '../core/format';
import { later, type Stop } from '../core/timers';
import type { PlayItem } from '../app';

/**
 * The player's on-screen display: the channel (logo, number in the row,
 * name, programme) and the clock on top, a VOD's progress below. Hidden,
 * it leaves the DOM's layout (display: none), so nothing is drawn over the
 * video; it fades in and out with opacity only.
 */
const OSD_MS = 3000;
const FADE_MS = 260;

export class Osd {
    readonly el = h('div', 'osd');
    private readonly logo = h('div', 'osd__logo');
    private readonly title = h('div', 'osd__title');
    private readonly subtitle = h('div', 'osd__subtitle');
    private readonly clock = h('div', 'osd__clock');
    private readonly barFill = h('div', 'osd__bar-fill');
    private readonly time = h('div', 'osd__time');
    private readonly progress: HTMLElement;
    private hideTimer: Stop | null = null;
    private visible = false;

    constructor() {
        this.progress = h('div', 'osd__progress', h('div', 'osd__bar', this.barFill), this.time);
        this.el.appendChild(
            h('div', 'osd__top', this.logo, h('div', 'osd__text', this.title, this.subtitle), this.clock)
        );
        this.el.appendChild(this.progress);
        this.el.style.display = 'none';
    }

    get shown(): boolean {
        return this.visible;
    }

    render(item: PlayItem, index: number, count: number): void {
        clear(this.logo);
        this.logo.style.display = item.logo ? '' : 'none';
        if (item.logo) {
            this.logo.appendChild(picture(item.logo, 'osd__logo-pic', ''));
        }
        const position = item.kind === 'live' && count > 1 ? `${index + 1}/${count}  ` : '';
        this.title.textContent = `${position}${item.title}`;
        this.subtitle.textContent = item.subtitle ?? '';
        this.progress.style.display = item.kind === 'live' ? 'none' : '';
        this.clock.textContent = clockTime(new Date());
    }

    setSubtitle(text: string): void {
        this.subtitle.textContent = text;
    }

    titleText(): string {
        return this.title.textContent ?? '';
    }

    /** Shows the OSD; unless `sticky`, it hides itself after OSD_MS. */
    show(visible: boolean, sticky = false): void {
        this.stopTimer();
        this.clock.textContent = clockTime(new Date());
        if (visible) {
            if (!this.visible) {
                this.el.style.display = '';
                // A reflow first, so the fade runs from display: none.
                void this.el.offsetWidth;
            }
            this.visible = true;
            this.el.classList.add('is-visible');
            if (!sticky) {
                this.hideTimer = later('osd', OSD_MS, () => this.show(false));
            }
            return;
        }
        if (!this.visible) {
            return;
        }
        this.visible = false;
        this.el.classList.remove('is-visible');
        this.hideTimer = later('osd-fade', FADE_MS, () => {
            this.hideTimer = null;
            this.el.style.display = 'none';
        });
    }

    /** A VOD's position: drawn only while the OSD shows. */
    setProgress(position: number, duration: number): void {
        if (!this.visible) {
            return;
        }
        this.barFill.style.transform = `scaleX(${duration > 0 ? Math.min(1, position / duration) : 0})`;
        this.time.textContent = `${timecode(position)} / ${timecode(duration)}`;
    }

    private stopTimer(): void {
        if (this.hideTimer) {
            this.hideTimer();
            this.hideTimer = null;
        }
    }

    destroy(): void {
        this.stopTimer();
    }
}
