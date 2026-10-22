import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    signal,
    untracked,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { CountryTvControls, VOLUME_STEP } from '../country-tv-controls';

/** How long the level stays on screen after a change. */
const OSD_MS = 1400;

/**
 * The stages' volume (En vivo, the league page): the speaker mutes and
 * unmutes; hovering or focusing it opens a slider beside it (click or drag
 * sets the level, the wheel steps it, so do its arrow keys), and every
 * change shows the level for a moment ("Volume 60 %"). The level is the
 * app's one (`CountryTvControls.setVolume`), for every engine.
 */
@Component({
    selector: 'lib-stage-volume',
    templateUrl: './stage-volume.component.html',
    styleUrl: './stage-volume.component.scss',
    imports: [MatIcon, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'stage-volume' },
})
export class StageVolumeComponent {
    readonly controls = inject(CountryTvControls);
    /** Nothing plays: the slider still sets the level the next one starts at. */
    readonly idle = input(false);

    /** The level as the slider shows it, in percent (0 while muted). */
    readonly percent = computed(() =>
        this.controls.muted() ? 0 : Math.round(this.controls.volume() * 100)
    );
    readonly icon = computed(() => {
        const percent = this.percent();
        if (percent === 0) {
            return 'volume_off';
        }
        return percent < 50 ? 'volume_down' : 'volume_up';
    });
    /** The OSD is up. */
    readonly osd = signal(false);
    private osdTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        let seen = untracked(() => this.controls.volumeChange());
        effect(() => {
            const change = this.controls.volumeChange();
            if (change === seen) {
                return;
            }
            seen = change;
            untracked(() => this.flash());
        });
        inject(DestroyRef).onDestroy(() => this.clearTimer());
    }

    onInput(event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        if (Number.isFinite(value)) {
            this.controls.setVolume(value / 100);
        }
    }

    /** The wheel over the speaker or the slider: one step per notch. */
    onWheel(event: WheelEvent): void {
        if (event.deltaY === 0) {
            return;
        }
        event.preventDefault();
        this.controls.adjustVolume(event.deltaY < 0 ? VOLUME_STEP : -VOLUME_STEP);
    }

    private flash(): void {
        this.osd.set(true);
        this.clearTimer();
        this.osdTimer = setTimeout(() => this.osd.set(false), OSD_MS);
    }

    private clearTimer(): void {
        if (this.osdTimer !== null) {
            clearTimeout(this.osdTimer);
            this.osdTimer = null;
        }
    }
}
