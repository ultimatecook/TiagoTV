import type { EpgItem } from '@iptvnator/shared/interfaces';
import { nowAndNext } from './country-tv-epg';

function item(title: string, start: string, stop: string): EpgItem {
    const seconds = (iso: string) => String(Date.parse(iso) / 1000);
    return {
        id: title,
        epg_id: '1',
        title,
        lang: 'es',
        start: '',
        end: '',
        stop: '',
        description: '',
        channel_id: '1',
        start_timestamp: seconds(start),
        stop_timestamp: seconds(stop),
    };
}

const local = (iso: string) => {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

describe('nowAndNext', () => {
    const items = [
        item('Después', '2026-10-18T21:00:00Z', '2026-10-18T22:00:00Z'),
        item('Antes', '2026-10-18T19:00:00Z', '2026-10-18T20:00:00Z'),
        item('Ahora', '2026-10-18T20:00:00Z', '2026-10-18T21:00:00Z'),
    ];

    it('finds the programme on now, its progress, and the next one', () => {
        const now = Date.parse('2026-10-18T20:15:00Z');
        expect(nowAndNext(items, now, 0)).toEqual({
            now: {
                title: 'Ahora',
                time: `${local('2026-10-18T20:00:00Z')} – ${local(
                    '2026-10-18T21:00:00Z'
                )}`,
                progress: 25,
            },
            next: {
                title: 'Después',
                time: local('2026-10-18T21:00:00Z'),
                progress: null,
            },
        });
    });

    it('shows the times moved by the display offset', () => {
        const now = Date.parse('2026-10-18T20:15:00Z');
        expect(nowAndNext(items, now, 60)?.next?.time).toBe(
            local('2026-10-18T22:00:00Z')
        );
    });

    it('offers the next programme between two, and nothing without one', () => {
        const gap = Date.parse('2026-10-18T22:30:00Z');
        expect(nowAndNext(items, gap, 0)).toBeNull();
        const early = Date.parse('2026-10-18T18:00:00Z');
        expect(nowAndNext(items, early, 0)).toEqual({
            now: null,
            next: {
                title: 'Antes',
                time: local('2026-10-18T19:00:00Z'),
                progress: null,
            },
        });
        expect(nowAndNext([], early, 0)).toBeNull();
    });
});
