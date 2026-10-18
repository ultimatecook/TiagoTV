#!/usr/bin/env node
/**
 * TiagoTV on LG TVs (webOS), see README → "Instalar en la tele LG".
 *
 *   node tools/tiagotv/webos.mjs package <serverUrl> [outDir]
 *     Builds the TiagoTV .ipk into outDir (default dist/webos): the app
 *     icon and a launcher that opens the self-hosted TiagoTV server
 *     (docker/README.md) at <serverUrl>, which serves the interface.
 *
 *   node tools/tiagotv/webos.mjs probe [outDir]
 *     Builds the "TiagoTV prueba" .ipk, which shows whether the TV could
 *     run the whole interface without the server (webos-probe/probe.js).
 *
 *   node tools/tiagotv/webos.mjs renew
 *     Renews the TV's Developer Mode session with the token in
 *     LG_DEVMODE_TOKEN, so the apps installed with it are not removed when
 *     the session runs out (tiagotv-lg-devmode.yml).
 */
import { execFileSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = fileURLToPath(new URL('./webos', import.meta.url));
const PROBE_DIR = fileURLToPath(new URL('./webos-probe', import.meta.url));
const ICONS = ['icon.png', 'largeIcon.png'];
const PACKAGE_JSON = fileURLToPath(
    new URL('../../package.json', import.meta.url)
);
const WEBOS_CLI = '@webos-tools/cli@3.2.6';
const DEVMODE_API = 'https://developer.lge.com/secure';

export function normalizeServerUrl(input) {
    let url;
    try {
        url = new URL(String(input ?? '').trim());
    } catch {
        url = null;
    }
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        throw new Error(
            `Not a server address: ${input} (e.g. http://192.168.1.50:4333)`
        );
    }
    if (url.username || url.password || url.search || url.hash) {
        throw new Error(
            'The server address takes no credentials, query or fragment'
        );
    }
    return url.href.replace(/\/+$/, '');
}

// webOS versions are three numbers, without a pre-release part.
export function webosVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (!match) {
        throw new Error(`Not a semantic version: ${version}`);
    }
    return match.slice(1).map(Number).join('.');
}

export function stage(serverUrl, dir, version = readPackageVersion()) {
    const server = normalizeServerUrl(serverUrl);
    cpSync(APP_DIR, dir, { recursive: true });
    writeFileSync(
        join(dir, 'server.js'),
        `window.TIAGOTV_SERVER = ${JSON.stringify(server)};\n`
    );
    return stampVersion(dir, version);
}

export function stageProbe(dir, version = readPackageVersion()) {
    cpSync(PROBE_DIR, dir, { recursive: true });
    for (const icon of ICONS) {
        cpSync(join(APP_DIR, icon), join(dir, icon));
    }
    return stampVersion(dir, version);
}

function stampVersion(dir, version) {
    const appinfoPath = join(dir, 'appinfo.json');
    const appinfo = JSON.parse(readFileSync(appinfoPath, 'utf8'));
    appinfo.version = webosVersion(version);
    writeFileSync(appinfoPath, JSON.stringify(appinfo, null, 4) + '\n');
    return appinfo;
}

export function packageApp(serverUrl, outDir) {
    return buildIpk((dir) => stage(serverUrl, dir), outDir);
}

export function packageProbe(outDir) {
    return buildIpk((dir) => stageProbe(dir), outDir);
}

function buildIpk(stageInto, outDir) {
    const out = resolve(outDir);
    const work = mkdtempSync(join(tmpdir(), 'tiagotv-webos-'));
    try {
        const appDir = join(work, 'app');
        const { id, version } = stageInto(appDir);
        mkdirSync(out, { recursive: true });
        execFileSync(
            'npx',
            [
                '--yes',
                '--package',
                WEBOS_CLI,
                'ares-package',
                '--outdir',
                out,
                appDir,
            ],
            { stdio: 'inherit' }
        );
        return join(out, `${id}_${version}_all.ipk`);
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}

export async function renew(token, request = fetch) {
    if (!token) {
        throw new Error('LG_DEVMODE_TOKEN is not set');
    }
    const query = `sessionToken=${encodeURIComponent(token)}`;
    await callDevModeApi(
        request,
        `${DEVMODE_API}/ResetDevModeSession.dev?${query}`
    );
    const session = await callDevModeApi(
        request,
        `${DEVMODE_API}/CheckDevModeSession.dev?${query}`
    );
    return session.remainTime ?? null;
}

async function callDevModeApi(request, url) {
    const response = await request(url, { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.result === 'success') {
        return body;
    }
    const reason = body?.errorCode
        ? `${body.errorCode} ${body.errorMsg ?? ''}`.trim()
        : `HTTP ${response.status}`;
    throw new Error(
        `LG refused the Developer Mode session (${reason}): read a new token from the TV (README → Instalar en la tele LG)`
    );
}

function readPackageVersion() {
    return JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version;
}

async function main([command, ...args]) {
    if (command === 'package' && args.length >= 1 && args.length <= 2) {
        console.log(packageApp(args[0], args[1] ?? 'dist/webos'));
        return;
    }
    if (command === 'probe' && args.length <= 1) {
        console.log(packageProbe(args[0] ?? 'dist/webos'));
        return;
    }
    if (command === 'renew' && args.length === 0) {
        const remaining = await renew(process.env.LG_DEVMODE_TOKEN);
        console.log(
            `Developer Mode session renewed (remaining: ${remaining ?? 'not reported'})`
        );
        return;
    }
    console.error(
        'Usage: webos.mjs package <serverUrl> [outDir] | probe [outDir] | renew'
    );
    process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
