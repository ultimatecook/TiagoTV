import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    clampVolume,
    followPlayerVolumeRequests,
    PlayerVolumeService,
} from './player-volume.service';

const applied: number[] = [];

@Component({ selector: 'app-test-volume-player', template: '' })
class VolumePlayerComponent {
    constructor() {
        followPlayerVolumeRequests((volume) => applied.push(volume));
    }
}

describe('PlayerVolumeService', () => {
    beforeEach(() => {
        applied.length = 0;
        localStorage.removeItem('volume');
    });

    it('saves the level under the key every player reads', () => {
        const volumes = TestBed.inject(PlayerVolumeService);
        expect(volumes.stored()).toBe(1);
        volumes.request(0.256);
        expect(localStorage.getItem('volume')).toBe('0.26');
        expect(volumes.stored()).toBe(0.26);
        volumes.save(7);
        expect(volumes.stored()).toBe(1);
    });

    it('applies to a mounted player only the levels asked after it mounted', () => {
        const volumes = TestBed.inject(PlayerVolumeService);
        volumes.request(0.2);
        const fixture = TestBed.createComponent(VolumePlayerComponent);
        fixture.detectChanges();
        TestBed.tick();
        expect(applied).toEqual([]);

        volumes.request(0.7);
        TestBed.tick();
        volumes.request(0.4);
        TestBed.tick();
        expect(applied).toEqual([0.7, 0.4]);
        fixture.destroy();
    });

    it('clamps to 0–1 in hundredths', () => {
        expect(clampVolume(-1)).toBe(0);
        expect(clampVolume(0.123)).toBe(0.12);
        expect(clampVolume(Number.NaN)).toBe(1);
        expect(clampVolume(3)).toBe(1);
    });
});
