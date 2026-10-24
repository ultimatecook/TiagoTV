import type { LiveChannelPlayRequest } from '@iptvnator/portal/shared/util';
import { buildCountriesTv } from './countries-catalog';
import { requestedChannel } from './country-tv-request';

const COUNTRIES = buildCountriesTv(
    [
        { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
        { category_id: 2, category_name: '|LAT|  ✪ ARGENTINA' },
    ],
    [
        { stream_id: 10, category_id: 1, name: '|ES| La 1 ᵁᴴᴰ' },
        { stream_id: 11, category_id: 1, name: '|ES| La 1 ᴴᴰ' },
        { stream_id: 20, category_id: 2, name: '|ARG| C5N' },
    ],
    new Date('2026-10-18T18:00:00Z')
);

const request = (
    overrides: Partial<LiveChannelPlayRequest> = {}
): LiveChannelPlayRequest => ({
    playlistId: 'source-1',
    streamId: 11,
    categoryId: '1',
    title: '|ES| La 1 ᴴᴰ',
    icon: null,
    ...overrides,
});

/**
 * Where a channel picked on a redesigned page (Mi lista, Recently viewed,
 * the Home, Buscar) plays: "En vivo"'s stage when it can show it, else the
 * Xtream live view.
 */
describe('requestedChannel', () => {
    it("plays the source's own channel on the stage, that very copy", () => {
        const asked = requestedChannel(COUNTRIES, request(), 'source-1');

        expect('selection' in asked && asked.selection.copy.streamId).toBe(11);
        expect('selection' in asked && asked.selection.country.definition.id).toBe(
            'es'
        );
    });

    it('sends a channel no country lists to the Xtream live view', () => {
        const asked = requestedChannel(
            COUNTRIES,
            request({ streamId: 99, categoryId: '7' }),
            'source-1'
        );

        expect('elsewhere' in asked && asked.elsewhere.link).toEqual([
            '/workspace',
            'xtreams',
            'source-1',
            'live',
        ]);
    });

    it("sends another source's channel to that source's live view", () => {
        const asked = requestedChannel(
            COUNTRIES,
            request({ playlistId: 'source-2' }),
            'source-1'
        );

        expect('elsewhere' in asked && asked.elsewhere.link).toEqual([
            '/workspace',
            'xtreams',
            'source-2',
            'live',
        ]);
    });
});
