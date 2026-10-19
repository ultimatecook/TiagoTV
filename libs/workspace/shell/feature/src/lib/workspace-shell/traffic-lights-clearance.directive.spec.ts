import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    ZOOM_LEVEL_MAX,
    ZOOM_LEVEL_MIN,
    ZOOM_LEVEL_STEP,
} from '@iptvnator/shared/interfaces';
import {
    pageZoomFactor,
    TrafficLightsClearanceDirective,
    trafficLightsClearance,
} from './traffic-lights-clearance.directive';

@Component({
    template: `<div [appTrafficLightsClearance]="enabled()"></div>`,
    imports: [TrafficLightsClearanceDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
    readonly enabled = signal(true);
}

function setWindowWidths(outer: number, inner: number): void {
    Object.defineProperty(window, 'outerWidth', {
        configurable: true,
        value: outer,
    });
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: inner,
    });
}

describe('trafficLightsClearance', () => {
    it('clears the lights centred in the 84px top bar at 100 %', () => {
        // x: 22pt in, 60pt of lights and an 8pt gap; y: their foot plus
        // 14pt, inside the 84px bar.
        expect(trafficLightsClearance(1)).toEqual({ x: 90, y: 63 });
    });

    it('keeps the same window pixels at every supported zoom', () => {
        for (
            let level = ZOOM_LEVEL_MIN;
            level <= ZOOM_LEVEL_MAX;
            level += ZOOM_LEVEL_STEP
        ) {
            const factor = 1.2 ** level;
            const clearance = trafficLightsClearance(factor);
            expect(clearance.x * factor).toBeCloseTo(90);
            expect(clearance.y * factor).toBeCloseTo(63);
        }
    });

    it('outgrows the 100 % clearance when zoomed out', () => {
        const clearance = trafficLightsClearance(1.2 ** ZOOM_LEVEL_MIN);
        expect(clearance.x).toBeGreaterThan(90);
        expect(clearance.y).toBeGreaterThan(63);
    });

    it('treats an unusable factor as 100 %', () => {
        for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(trafficLightsClearance(factor)).toEqual({ x: 90, y: 63 });
        }
    });
});

describe('pageZoomFactor', () => {
    it('divides window pixels by CSS pixels', () => {
        expect(pageZoomFactor({ outerWidth: 1200, innerWidth: 2400 })).toBe(
            0.5
        );
        expect(pageZoomFactor({ outerWidth: 1200, innerWidth: 1000 })).toBe(
            1.2
        );
    });

    it('falls back to 100 % without a measured window', () => {
        expect(pageZoomFactor({ outerWidth: 0, innerWidth: 1200 })).toBe(1);
        expect(pageZoomFactor({ outerWidth: 1200, innerWidth: 0 })).toBe(1);
    });
});

describe('TrafficLightsClearanceDirective', () => {
    let fixture: ComponentFixture<HostComponent>;

    const clearance = () => {
        const style = (
            fixture.nativeElement.querySelector('div') as HTMLElement
        ).style;
        return {
            x: style.getPropertyValue('--traffic-lights-clear-x'),
            y: style.getPropertyValue('--traffic-lights-clear-y'),
        };
    };
    const render = () => {
        fixture.detectChanges();
        TestBed.tick();
        fixture.detectChanges();
    };

    beforeEach(() => {
        setWindowWidths(1200, 1200);
        fixture = TestBed.createComponent(HostComponent);
    });

    afterEach(() => setWindowWidths(1024, 1024));

    it('publishes the clearance and follows zoom changes', () => {
        render();
        expect(clearance()).toEqual({ x: '90px', y: '63px' });

        // Zoomed out to 50%: the viewport holds twice the CSS pixels.
        setWindowWidths(1200, 2400);
        window.dispatchEvent(new Event('resize'));
        fixture.detectChanges();
        expect(clearance()).toEqual({ x: '180px', y: '126px' });
    });

    it('measures the zoom before the first render', () => {
        setWindowWidths(1200, 2400);
        fixture.detectChanges();
        expect(clearance()).toEqual({ x: '180px', y: '126px' });
    });

    it('publishes nothing off macOS and stops listening when disabled', () => {
        render();
        const removeListener = jest.spyOn(window, 'removeEventListener');

        fixture.componentInstance.enabled.set(false);
        render();
        expect(clearance()).toEqual({ x: '', y: '' });
        expect(removeListener).toHaveBeenCalledWith(
            'resize',
            expect.any(Function)
        );

        setWindowWidths(1200, 2400);
        window.dispatchEvent(new Event('resize'));
        fixture.componentInstance.enabled.set(true);
        render();
        // Re-enabled, it measures the current zoom.
        expect(clearance()).toEqual({ x: '180px', y: '126px' });
        removeListener.mockRestore();
    });

    describe('in fullscreen', () => {
        const root = document.documentElement;
        /** Lets the MutationObserver deliver its records, then renders. */
        const settle = async () => {
            await new Promise((resolve) => setTimeout(resolve));
            fixture.detectChanges();
        };

        afterEach(() => root.classList.remove('window-fullscreen'));

        it('clears nothing while the window is fullscreen: the lights are hidden', async () => {
            render();
            expect(clearance()).toEqual({ x: '90px', y: '63px' });

            root.classList.add('window-fullscreen');
            await settle();
            expect(clearance()).toEqual({ x: '0px', y: '0px' });

            root.classList.remove('window-fullscreen');
            await settle();
            expect(clearance()).toEqual({ x: '90px', y: '63px' });
        });

        it('starts at zero in a window that is already fullscreen', () => {
            root.classList.add('window-fullscreen');
            fixture = TestBed.createComponent(HostComponent);
            fixture.detectChanges();
            expect(clearance()).toEqual({ x: '0px', y: '0px' });
        });

        it('publishes nothing off macOS, fullscreen or not', async () => {
            fixture.componentInstance.enabled.set(false);
            render();
            root.classList.add('window-fullscreen');
            await settle();
            expect(clearance()).toEqual({ x: '', y: '' });
        });

        it('stops watching the window once destroyed', () => {
            const disconnect = jest.spyOn(
                MutationObserver.prototype,
                'disconnect'
            );
            render();
            fixture.destroy();
            expect(disconnect).toHaveBeenCalled();
            disconnect.mockRestore();
        });
    });

    it('stops listening when destroyed', () => {
        render();
        const removeListener = jest.spyOn(window, 'removeEventListener');
        fixture.destroy();
        expect(removeListener).toHaveBeenCalledWith(
            'resize',
            expect.any(Function)
        );
        removeListener.mockRestore();
    });
});
