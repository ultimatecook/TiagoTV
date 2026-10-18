#!/usr/bin/env node
/**
 * TiagoTV interface builds (over-the-air updates, see
 * apps/electron-backend/src/app/services/ui-update-state.ts).
 *
 *   node tools/tiagotv/ui-bundle.mjs stamp <rendererDir>
 *     Writes tiagotv-ui.json next to index.html: the build number (the
 *     commit time, so installers and updates built from the same commit
 *     agree and later commits are newer) and the shell level the renderer
 *     targets.
 *
 *   node tools/tiagotv/ui-bundle.mjs manifest <rendererDir> <zip> <url> <out>
 *     Writes the update manifest for a zipped renderer published at <url>.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAMP_FILE = 'tiagotv-ui.json';
const STATE_SOURCE = fileURLToPath(
    new URL(
        '../../apps/electron-backend/src/app/services/ui-update-state.ts',
        import.meta.url
    )
);

export function readShellLevel(source = readFileSync(STATE_SOURCE, 'utf8')) {
    const match = /TIAGOTV_UI_SHELL_LEVEL = (\d+);/.exec(source);
    if (!match) {
        throw new Error('TIAGOTV_UI_SHELL_LEVEL not found');
    }
    return Number(match[1]);
}

export function commitBuildNumber() {
    const fromEnv = Number(process.env.TIAGOTV_UI_BUILD);
    if (Number.isSafeInteger(fromEnv) && fromEnv > 0) {
        return fromEnv;
    }
    return Number(
        execFileSync('git', ['log', '-1', '--format=%ct'], {
            encoding: 'utf8',
        }).trim()
    );
}

export function stamp(rendererDir, build = commitBuildNumber()) {
    const data = { build, shell: readShellLevel() };
    writeFileSync(join(rendererDir, STAMP_FILE), JSON.stringify(data) + '\n');
    return data;
}

export function manifest(rendererDir, zipPath, url) {
    const { build, shell } = JSON.parse(
        readFileSync(join(rendererDir, STAMP_FILE), 'utf8')
    );
    const bundle = readFileSync(zipPath);
    return {
        build,
        shell,
        url,
        sha256: createHash('sha256').update(bundle).digest('hex'),
        size: bundle.length,
    };
}

function main([command, ...args]) {
    if (command === 'stamp' && args.length === 1) {
        console.log(JSON.stringify(stamp(args[0])));
        return;
    }
    if (command === 'manifest' && args.length === 4) {
        const [rendererDir, zipPath, url, out] = args;
        const data = manifest(rendererDir, zipPath, url);
        writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
        console.log(JSON.stringify(data));
        return;
    }
    console.error(
        'Usage: ui-bundle.mjs stamp <rendererDir> | manifest <rendererDir> <zip> <url> <out>'
    );
    process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2));
}
