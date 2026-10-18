import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readdir, rename, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
    installUiBuild,
    isBuildNumber,
    readUiStamp,
    readUiUpdateState,
    TIAGOTV_UI_SHELL_LEVEL,
    type UiStamp,
} from './ui-update-state';

/**
 * TiagoTV over-the-air interface updates: finding and installing a newer
 * renderer build. Builds are published by the "TiagoTV interface update"
 * workflow as releases of a public repository, so the app needs no token;
 * the manifest names the bundle and its SHA-256, and only bundles of that
 * repository are accepted.
 */
export const UI_UPDATE_REPOSITORY = 'ultimatecook/TiagoTV-updates';
export const UI_UPDATE_FEED_URL = `https://github.com/${UI_UPDATE_REPOSITORY}/releases/latest/download/ui-manifest.json`;
const UI_UPDATE_BUNDLE_PREFIX = `https://github.com/${UI_UPDATE_REPOSITORY}/releases/download/`;
/** A renderer build is ~20 MB zipped; anything far larger is not one. */
const MAX_BUNDLE_BYTES = 200 * 1024 * 1024;

export interface UiManifest extends UiStamp {
    readonly url: string;
    readonly sha256: string;
    readonly size: number;
}

export interface UiUpdateDeps {
    /** `<userData>/ui-updates`. */
    readonly root: string;
    /** The newest build the app already has, packaged or installed. */
    readonly newestBuild: number;
    readonly fetch: (url: string) => Promise<Response>;
    /** Unpacks a zip into an empty directory. */
    readonly extract: (zipPath: string, destination: string) => Promise<void>;
    readonly shellLevel?: number;
}

export type UiUpdateOutcome = 'up-to-date' | 'installed' | 'failed';

export function parseUiManifest(raw: unknown): UiManifest | null {
    const manifest = raw as Partial<UiManifest> | null;
    if (
        !manifest ||
        !isBuildNumber(manifest.build) ||
        !isBuildNumber(manifest.shell) ||
        typeof manifest.url !== 'string' ||
        !manifest.url.startsWith(UI_UPDATE_BUNDLE_PREFIX) ||
        typeof manifest.sha256 !== 'string' ||
        !/^[0-9a-f]{64}$/.test(manifest.sha256) ||
        !isBuildNumber(manifest.size) ||
        manifest.size > MAX_BUNDLE_BYTES
    ) {
        return null;
    }
    return {
        build: manifest.build,
        shell: manifest.shell,
        url: manifest.url,
        sha256: manifest.sha256,
        size: manifest.size,
    };
}

/**
 * Checks the feed once and installs a newer build for the next launch.
 * A missing feed (no update published yet) is simply up to date.
 */
export async function checkForUiUpdate(
    deps: UiUpdateDeps
): Promise<UiUpdateOutcome> {
    const shellLevel = deps.shellLevel ?? TIAGOTV_UI_SHELL_LEVEL;
    const feed = await deps.fetch(UI_UPDATE_FEED_URL);
    if (!feed.ok) {
        return 'up-to-date';
    }
    const manifest = parseUiManifest(await feed.json().catch(() => null));
    if (
        !manifest ||
        manifest.shell !== shellLevel ||
        manifest.build <= deps.newestBuild ||
        readUiUpdateState(deps.root).rejected.includes(manifest.build)
    ) {
        return 'up-to-date';
    }

    const download = await deps.fetch(manifest.url);
    const bundle = download.ok
        ? Buffer.from(await download.arrayBuffer())
        : null;
    if (
        !bundle ||
        bundle.length !== manifest.size ||
        createHash('sha256').update(bundle).digest('hex') !== manifest.sha256
    ) {
        return 'failed';
    }

    const target = join(deps.root, String(manifest.build));
    const staging = `${target}.partial`;
    const zipPath = `${target}.zip`;
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    try {
        await writeFile(zipPath, bundle);
        await deps.extract(zipPath, staging);
        const stamp = readUiStamp(staging);
        if (
            !existsSync(join(staging, 'index.html')) ||
            stamp?.build !== manifest.build ||
            stamp.shell !== manifest.shell
        ) {
            return 'failed';
        }
        await rm(target, { recursive: true, force: true });
        await rename(staging, target);
    } finally {
        await rm(zipPath, { force: true });
        await rm(staging, { recursive: true, force: true });
    }
    installUiBuild(deps.root, manifest);
    return 'installed';
}

/**
 * Removes installed builds other than `keep` (the one running and the one
 * the next launch loads) and leftovers of interrupted installs.
 */
export async function pruneUiBuilds(
    root: string,
    keep: readonly (number | null)[]
): Promise<void> {
    const entries = await readdir(root).catch(() => [] as string[]);
    await Promise.all(
        entries
            .filter((name) => /^\d+(\.partial|\.zip)?$/.test(name))
            .filter((name) => !keep.includes(Number(name)))
            .map((name) =>
                rm(join(root, name), { recursive: true, force: true })
            )
    );
}
