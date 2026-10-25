#!/usr/bin/env node
/**
 * Builds the TiagoTV Android TV APK: the web bundle into the assets
 * (sync-assets.mjs), then Gradle. Release by default (signed with the
 * keystore in TIAGOTV_KEYSTORE_FILE and its passwords, or with the debug
 * key when there is none); `--debug` builds the debug variant.
 *
 *   node apps/androidtv/tools/build.mjs [--debug] [--skip-sync]
 */
import { statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PROJECT, runGradle } from './gradle.mjs';
import { syncAssets } from './sync-assets.mjs';
import { readVersion } from './version.mjs';

/** Where Gradle leaves the APK of a variant. */
export function apkPath(variant) {
    return join(
        PROJECT,
        'app',
        'build',
        'outputs',
        'apk',
        variant,
        `app-${variant}.apk`
    );
}

async function main(args) {
    const variant = args.includes('--debug') ? 'debug' : 'release';
    if (!args.includes('--skip-sync')) {
        const synced = await syncAssets();
        console.log(`Web bundle v${synced.version} synced into the assets.`);
    }
    const status = runGradle([
        variant === 'release' ? 'assembleRelease' : 'assembleDebug',
    ]);
    if (status !== 0) {
        process.exit(status);
    }
    const apk = apkPath(variant);
    const size = statSync(apk).size;
    const version = readVersion();
    console.log(
        `Built ${relative(process.cwd(), apk)} (TiagoTV ${version.name}, ${(size / 1024 / 1024).toFixed(1)} MB)`
    );
}

main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
