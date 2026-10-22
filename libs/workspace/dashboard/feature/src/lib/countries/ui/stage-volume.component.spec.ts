import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CountryTvControls, VOLUME_STEP } from '../country-tv-controls';
import { StageVolumeComponent } from './stage-volume.component';

describe('StageVolumeComponent', () => {
    let fixture: ComponentFixture<StageVolumeComponent>;
    const volume = signal(0.6);
    const muted = signal(false);
    const volumeChange = signal(0);
    const controls = {
        volume,
        muted,
        volumeChange,
        setVolume: jest.fn((value: number) => {
            volume.set(value);
            volumeChange.update((count) => count + 1);
        }),
        adjustVolume: jest.fn(),
        toggleMute: jest.fn(),
    };

    beforeEach(async () => {
        jest.useFakeTimers();
        volume.set(0.6);
        muted.set(false);
        volumeChange.set(0);
        Object.values(controls).forEach((value) =>
            typeof value === 'function' && 'mockClear' in value
                ? (value as jest.Mock).mockClear()
                : undefined
        );
        await TestBed.configureTestingModule({
            imports: [StageVolumeComponent, TranslateModule.forRoot()],
            providers: [{ provide: CountryTvControls, useValue: controls }],
        }).compileComponents();
        fixture = TestBed.createComponent(StageVolumeComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        jest.useRealTimers();
    });

    const el = <T extends HTMLElement>(id: string) =>
        (fixture.nativeElement as HTMLElement).querySelector(
            `[data-test-id="${id}"]`
        ) as T;

    it('mutes from the speaker and shows the level on the slider', () => {
        const slider = el<HTMLInputElement>('stage-volume');
        expect(slider.value).toBe('60');
        expect(slider.getAttribute('aria-valuetext')).toBe(
            'WORKSPACE.STAGE.VOLUME_LEVEL'
        );
        el<HTMLButtonElement>('stage-mute').click();
        expect(controls.toggleMute).toHaveBeenCalledTimes(1);

        muted.set(true);
        fixture.detectChanges();
        expect(slider.value).toBe('0');
        expect(el('stage-mute').textContent).toContain('volume_off');
    });

    it('sets the level from the slider and flashes it for a moment', () => {
        const slider = el<HTMLInputElement>('stage-volume');
        slider.value = '35';
        slider.dispatchEvent(new Event('input'));
        TestBed.tick();
        fixture.detectChanges();

        expect(controls.setVolume).toHaveBeenCalledWith(0.35);
        expect(el('stage-volume-osd')).not.toBeNull();

        jest.advanceTimersByTime(1500);
        fixture.detectChanges();
        expect(el('stage-volume-osd')).toBeNull();
    });

    it('steps the level with the scroll wheel', () => {
        const wheel = (deltaY: number) => {
            const event = new WheelEvent('wheel', {
                deltaY,
                cancelable: true,
                bubbles: true,
            });
            el('stage-volume').dispatchEvent(event);
            return event.defaultPrevented;
        };
        expect(wheel(-100)).toBe(true);
        expect(wheel(100)).toBe(true);
        expect(controls.adjustVolume.mock.calls).toEqual([
            [VOLUME_STEP],
            [-VOLUME_STEP],
        ]);
    });
});
