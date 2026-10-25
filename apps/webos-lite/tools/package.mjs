#!/usr/bin/env node
/**
 * Packages the built TV app (dist/webos-lite) as a webOS .ipk with LG's
 * CLI (ares-package from @webos-tools/cli), for Developer Mode installs:
 *
 *   node apps/webos-lite/tools/package.mjs [--out <dir>]
 *   ares-install -d tv dist/webos-lite-ipk/com.tiagotv.lite_<version>_all.ipk
 *
 * ARES_PACKAGE may point at an installed ares-package; otherwise npx runs
 * the pinned CLI. The bundle is already minified and gated, so ares'
 * own minifier (which predates ES2015) is skipped.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEBOS_CLI = '@webos-tools/cli@3.2.6';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = join(ROOT, 'dist', 'webos-lite');

/** The ipk ares-package writes for an appinfo.json. */
export function ipkName(appinfo) {
    if (!appinfo || !/^[a-z0-9.]+$/.test(appinfo.id ?? '') || !/^\d+\.\d+\.\d+$/.test(appinfo.version ?? '')) {
        throw new Error('appinfo.json needs an id (a.b.c) and a version (x.y.z)');
    }
    return `${appinfo.id}_${appinfo.version}_all.ipk`;
}

/** The command that runs ares-package: an installed one, or npx. */
export function aresCommand(env = process.env) {
    if (env.ARES_PACKAGE) {
        return [env.ARES_PACKAGE, []];
    }
    return ['npx', ['--yes', '--package', WEBOS_CLI, 'ares-package']];
}

export function packageApp({ dist = DIST, out = join(ROOT, 'dist', 'webos-lite-ipk') } = {}) {
    if (!existsSync(join(dist, 'appinfo.json'))) {
        throw new Error(`${dist} has no build: run pnpm nx build webos-lite`);
    }
    const appinfo = JSON.parse(readFileSync(join(dist, 'appinfo.json'), 'utf8'));
    const target = resolve(out);
    mkdirSync(target, { recursive: true });
    const [command, prefix] = aresCommand();
    execFileSync(command, [...prefix, '--no-minify', '--outdir', target, dist], { stdio: 'inherit' });
    const ipk = join(target, ipkName(appinfo));
    if (!existsSync(ipk)) {
        throw new Error(`ares-package did not write ${ipk}`);
    }
    return ipk;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const index = process.argv.indexOf('--out');
    try {
        console.log(packageApp(index >= 0 ? { out: process.argv[index + 1] } : {}));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
