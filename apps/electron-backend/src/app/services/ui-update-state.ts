import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * TiagoTV over-the-air interface updates: the state on disk.
 *
 * The packaged app carries the renderer (`web/`) it was built with. Newer
 * renderer builds land in `<userData>/ui-updates/<build>/` (see
 * ui-update-download), and a launch loads the installed one instead of the
 * packaged copy when it targets this main process and is newer than the
 * packaged renderer. A build whose first launch never confirmed a healthy
 * start is rejected for good and the app falls back to the packaged one.
 */

/**
 * The renderer ↔ main process contract. Bump it when a main-process or
 * preload change breaks older renderers (or newer renderers need the
 * change): their updates then wait for a new installer.
 */
export const TIAGOTV_UI_SHELL_LEVEL = 1;

/** Written next to each renderer build's index.html (tools/tiagotv). */
export const UI_STAMP_FILE = 'tiagotv-ui.json';

const STATE_FILE = 'state.json';

export interface UiStamp {
    readonly build: number;
    readonly shell: number;
}

export interface InstalledUi extends UiStamp {
    /** A launch with it reached a rendered app. */
    readonly verified: boolean;
    /** A launch has tried it: unverified and tried means it failed. */
    readonly attempted: boolean;
}

export interface UiUpdateState {
    readonly installed?: InstalledUi;
    /** Builds that failed to start; never installed again. */
    readonly rejected: readonly number[];
}

export interface RendererSelection {
    readonly indexPath: string;
    /** The installed build in use, or null for the packaged renderer. */
    readonly build: number | null;
}

export function readUiStamp(rendererDir: string): UiStamp | null {
    const stamp = readJson(join(rendererDir, UI_STAMP_FILE));
    return isStamp(stamp) ? { build: stamp.build, shell: stamp.shell } : null;
}

export function readUiUpdateState(root: string): UiUpdateState {
    const raw = readJson(join(root, STATE_FILE)) as Partial<
        Record<keyof UiUpdateState, unknown>
    > | null;
    const installed = raw?.installed as Partial<InstalledUi> | undefined;
    const rejected = Array.isArray(raw?.rejected)
        ? raw.rejected.filter(isBuildNumber)
        : [];
    if (!installed || !isStamp(installed)) {
        return { rejected };
    }
    const { verified, attempted } = installed as Partial<InstalledUi>;
    return {
        installed: {
            build: installed.build,
            shell: installed.shell,
            verified: verified === true,
            attempted: attempted === true,
        },
        rejected,
    };
}

export function writeUiUpdateState(root: string, state: UiUpdateState): void {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, STATE_FILE), JSON.stringify(state));
}

/** The newest build this app already has, packaged or installed. */
export function newestUiBuild(root: string, bundledIndexPath: string): number {
    const bundled = readUiStamp(dirname(bundledIndexPath))?.build ?? 0;
    return Math.max(bundled, readUiUpdateState(root).installed?.build ?? 0);
}

/**
 * The renderer this launch loads. Records the attempt on an unverified
 * build, and rejects one whose previous attempt never confirmed.
 */
export function selectRenderer(
    root: string,
    bundledIndexPath: string,
    shellLevel = TIAGOTV_UI_SHELL_LEVEL
): RendererSelection {
    const bundled: RendererSelection = {
        indexPath: bundledIndexPath,
        build: null,
    };
    const state = readUiUpdateState(root);
    const installed = state.installed;
    const bundledBuild = readUiStamp(dirname(bundledIndexPath))?.build ?? 0;
    if (
        !installed ||
        installed.shell !== shellLevel ||
        installed.build <= bundledBuild
    ) {
        return bundled;
    }
    if (!installed.verified && installed.attempted) {
        rejectUiBuild(root, installed.build);
        return bundled;
    }
    const indexPath = join(root, String(installed.build), 'index.html');
    if (!existsSync(indexPath)) {
        return bundled;
    }
    if (!installed.verified) {
        writeUiUpdateState(root, {
            ...state,
            installed: { ...installed, attempted: true },
        });
    }
    return { indexPath, build: installed.build };
}

/** Makes `stamp` the build the next launch loads. */
export function installUiBuild(root: string, stamp: UiStamp): void {
    writeUiUpdateState(root, {
        ...readUiUpdateState(root),
        installed: {
            build: stamp.build,
            shell: stamp.shell,
            verified: false,
            attempted: false,
        },
    });
}

export function markUiBuildHealthy(root: string, build: number): void {
    const state = readUiUpdateState(root);
    if (state.installed?.build === build && !state.installed.verified) {
        writeUiUpdateState(root, {
            ...state,
            installed: { ...state.installed, verified: true },
        });
    }
}

export function rejectUiBuild(root: string, build: number): void {
    const state = readUiUpdateState(root);
    writeUiUpdateState(root, {
        installed:
            state.installed?.build === build ? undefined : state.installed,
        rejected: state.rejected.includes(build)
            ? state.rejected
            : [...state.rejected, build],
    });
}

export function isBuildNumber(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

function isStamp(value: unknown): value is UiStamp {
    const stamp = value as Partial<UiStamp> | null | undefined;
    return !!stamp && isBuildNumber(stamp.build) && isBuildNumber(stamp.shell);
}

function readJson(path: string): unknown {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}
