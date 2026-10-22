import { TestBed } from '@angular/core/testing';
import {
    CATALOG_REQUEST_LOG_SIZE,
    CatalogRequestLog,
    categoryLabel,
    classifyRequestError,
} from './catalog-request-log';

describe('CatalogRequestLog', () => {
    it('names a category without its code marks', () => {
        expect(categoryLabel('|EN| ✪ AMAZON-PRIME')).toBe('EN · AMAZON-PRIME');
        expect(categoryLabel('✪ ORIGINAL AMAZON  MULTI')).toBe(
            'ORIGINAL AMAZON MULTI'
        );
    });

    it('tells failures apart by their kind, never by their text', () => {
        expect(classifyRequestError(new Error('HTTP Error 403'))).toEqual({
            result: 'http',
            status: 403,
        });
        expect(
            classifyRequestError(
                Object.assign(new Error('HTTP Error: Bad Gateway'), {
                    status: 502,
                })
            )
        ).toEqual({ result: 'http', status: 502 });
        expect(
            classifyRequestError(new Error('timeout of 30000ms exceeded'))
        ).toEqual({ result: 'timeout', status: null });
        expect(
            classifyRequestError(
                new Error('getaddrinfo ENOTFOUND provider.example')
            )
        ).toEqual({ result: 'network', status: null });
        expect(classifyRequestError('nope')).toEqual({
            result: 'error',
            status: null,
        });
    });

    it('keeps the last requests, newest first, with no address in them', async () => {
        const log = TestBed.inject(CatalogRequestLog);

        await log.track('get_series', 'EN · HULU', async () => [1, 2, 3]);
        await log.track('get_series', 'ES · HBO', async () => []);
        await expect(
            log.track('get_vod_streams', null, () =>
                Promise.reject(
                    new Error('connect ECONNREFUSED http://provider.example/x')
                )
            )
        ).rejects.toThrow();

        const [failed, empty, ok] = log.entries();
        expect(ok).toMatchObject({
            result: 'ok',
            items: 3,
            label: 'EN · HULU',
        });
        expect(empty).toMatchObject({ result: 'empty', items: 0 });
        expect(failed).toMatchObject({
            action: 'get_vod_streams',
            label: null,
            result: 'network',
            items: null,
        });
        expect(JSON.stringify(log.entries())).not.toContain('provider.example');

        for (let index = 0; index < CATALOG_REQUEST_LOG_SIZE + 5; index++) {
            await log.track('get_series', null, async () => []);
        }
        expect(log.entries()).toHaveLength(CATALOG_REQUEST_LOG_SIZE);
    });
});
