#!/usr/bin/env node
/**
 * Builds TiagoTV liviano (apps/webos-lite/tools/build.mjs, with its TV
 * gates) and copies the result into the Android app's assets
 * (app/src/main/assets/www), which the WebView serves from
 * https://appassets.androidplatform.net/assets/www/. Run before every
 * Gradle build; the copy is not committed (.gitignore).
 *
 *   node apps/androidtv/tools/sync-assets.mjs [--dev]
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../webos-lite/tools/build.mjs';
import { formatProblems } from '../../webos-lite/tools/gates.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const WWW = join(ROOT, 'apps', 'androidtv', 'app', 'src', 'main', 'assets', 'www');

export async function syncAssets({ dev = false } = {}) {
    const result = await build({ dev });
    if (result.problems.length > 0) {
        throw new Error(`TV gates failed:\n${formatProblems(result.problems)}`);
    }
    if (existsSync(WWW)) {
        rmSync(WWW, { recursive: true, force: true });
    }
    mkdirSync(WWW, { recursive: true });
    cpSync(result.out, WWW, { recursive: true });
    return { ...result, www: WWW };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    syncAssets({ dev: process.argv.includes('--dev') }).then(
        (result) => {
            console.log(`Synced TiagoTV liviano v${result.version} into ${result.www}`);
        },
        (error) => {
            console.error(error.stack || error.message);
            process.exit(1);
        }
    );
}
