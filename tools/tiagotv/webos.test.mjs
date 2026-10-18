import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
    normalizeServerUrl,
    renew,
    stage,
    stageProbe,
    webosVersion,
} from './webos.mjs';

test('accepts http and https server addresses', () => {
    assert.equal(
        normalizeServerUrl(' http://192.168.1.50:4333/ '),
        'http://192.168.1.50:4333'
    );
    assert.equal(
        normalizeServerUrl('https://tv.example.com/tiagotv/'),
        'https://tv.example.com/tiagotv'
    );
    assert.throws(() => normalizeServerUrl('192.168.1.50:4333'));
    assert.throws(() => normalizeServerUrl('ftp://192.168.1.50'));
    assert.throws(() => normalizeServerUrl('http://user:pass@192.168.1.50'));
    assert.throws(() => normalizeServerUrl('http://192.168.1.50/?a=1'));
    assert.throws(() => normalizeServerUrl(undefined));
});

test('turns the package version into a webOS version', () => {
    assert.equal(webosVersion('0.25.0'), '0.25.0');
    assert.equal(webosVersion('1.2.3-beta.4'), '1.2.3');
    assert.throws(() => webosVersion('next'));
});

test('stages the app with its version and server', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tiagotv-webos-test-'));
    try {
        const appinfo = stage('http://192.168.1.50:4333/', dir, '0.25.0');
        const written = JSON.parse(
            readFileSync(join(dir, 'appinfo.json'), 'utf8')
        );
        assert.deepEqual(written, appinfo);
        assert.equal(written.id, 'com.tiagotv.app');
        assert.equal(written.version, '0.25.0');
        assert.equal(
            readFileSync(join(dir, 'server.js'), 'utf8'),
            'window.TIAGOTV_SERVER = "http://192.168.1.50:4333";\n'
        );
        for (const file of [written.main, written.icon, written.largeIcon]) {
            assert.ok(readFileSync(join(dir, file)).length > 0, file);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('stages the probe app with the TiagoTV icons', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tiagotv-webos-test-'));
    try {
        const appinfo = stageProbe(dir, '0.25.0');
        assert.equal(appinfo.id, 'com.tiagotv.probe');
        assert.equal(appinfo.version, '0.25.0');
        for (const file of [appinfo.main, appinfo.icon, appinfo.largeIcon]) {
            assert.ok(readFileSync(join(dir, file)).length > 0, file);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

function fakeLg(answers) {
    const calls = [];
    const request = async (url) => {
        calls.push(url);
        const { status = 200, body } = answers.shift();
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => {
                if (body === undefined) {
                    throw new SyntaxError('not JSON');
                }
                return body;
            },
        };
    };
    return { calls, request };
}

test('renews the Developer Mode session and reads what is left', async () => {
    const lg = fakeLg([
        { body: { result: 'success', errorCode: '200', errorMsg: 'GNL' } },
        { body: { result: 'success', remainTime: '999:59:00' } },
    ]);
    assert.equal(await renew('a+b/c', lg.request), '999:59:00');
    assert.deepEqual(lg.calls, [
        'https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=a%2Bb%2Fc',
        'https://developer.lge.com/secure/CheckDevModeSession.dev?sessionToken=a%2Bb%2Fc',
    ]);
});

test('fails when LG refuses the token or answers garbage', async () => {
    await assert.rejects(renew('', fakeLg([]).request), /LG_DEVMODE_TOKEN/);
    await assert.rejects(
        renew(
            'old',
            fakeLg([
                {
                    body: {
                        result: 'fail',
                        errorCode: 'ERR_005',
                        errorMsg: 'Check user session',
                    },
                },
            ]).request
        ),
        /ERR_005 Check user session/
    );
    await assert.rejects(
        renew('token', fakeLg([{ status: 502 }]).request),
        /HTTP 502/
    );
});
