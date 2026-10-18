import { createHash } from 'crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    checkForUiUpdate,
    parseUiManifest,
    pruneUiBuilds,
    UI_UPDATE_FEED_URL,
} from './ui-update-download';
import { readUiUpdateState, UI_STAMP_FILE } from './ui-update-state';

const BUNDLE = Buffer.from('zip bytes');
const BUNDLE_URL =
    'https://github.com/ultimatecook/TiagoTV-updates/releases/download/ui-120/tiagotv-ui-120.zip';

function manifest(overrides: Record<string, unknown> = {}) {
    return {
        build: 120,
        shell: 1,
        url: BUNDLE_URL,
        sha256: createHash('sha256').update(BUNDLE).digest('hex'),
        size: BUNDLE.length,
        ...overrides,
    };
}

function response(body: unknown, ok = true): Response {
    return {
        ok,
        json: async () => body,
        arrayBuffer: async () =>
            Uint8Array.from(body as Buffer).buffer as ArrayBuffer,
    } as Response;
}

describe('interface update download', () => {
    let root: string;
    let feed: unknown;
    let stamp: { build: number; shell: number };
    const fetched: string[] = [];

    const deps = () => ({
        root,
        newestBuild: 100,
        fetch: async (url: string) => {
            fetched.push(url);
            if (url === UI_UPDATE_FEED_URL) {
                return feed === null ? response(null, false) : response(feed);
            }
            return response(BUNDLE);
        },
        // Stands in for ditto: unpacks a renderer build.
        extract: async (_zip: string, destination: string) => {
            writeFileSync(join(destination, 'index.html'), '<app-root>');
            writeFileSync(
                join(destination, UI_STAMP_FILE),
                JSON.stringify(stamp)
            );
        },
    });

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'tiagotv-ui-'));
        feed = manifest();
        stamp = { build: 120, shell: 1 };
        fetched.length = 0;
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('accepts only bundles of the updates repository', () => {
        expect(parseUiManifest(manifest())).not.toBeNull();
        expect(
            parseUiManifest(manifest({ url: 'https://evil.test/ui.zip' }))
        ).toBeNull();
        expect(parseUiManifest(manifest({ sha256: 'abc' }))).toBeNull();
        expect(parseUiManifest(manifest({ size: 500e6 }))).toBeNull();
        expect(parseUiManifest(null)).toBeNull();
    });

    it('installs a newer build for the next launch', async () => {
        await expect(checkForUiUpdate(deps())).resolves.toBe('installed');

        expect(existsSync(join(root, '120', 'index.html'))).toBe(true);
        expect(readUiUpdateState(root).installed).toEqual({
            build: 120,
            shell: 1,
            verified: false,
            attempted: false,
        });
        expect(readdirSync(root).sort()).toEqual(['120', 'state.json']);
    });

    it('stays put without a feed or a newer build', async () => {
        feed = null;
        await expect(checkForUiUpdate(deps())).resolves.toBe('up-to-date');

        feed = manifest({ build: 100 });
        await expect(checkForUiUpdate(deps())).resolves.toBe('up-to-date');

        feed = manifest({ shell: 2 });
        await expect(checkForUiUpdate(deps())).resolves.toBe('up-to-date');
        expect(fetched).not.toContain(BUNDLE_URL);
    });

    it('refuses a bundle that does not match its manifest', async () => {
        feed = manifest({ sha256: 'f'.repeat(64) });
        await expect(checkForUiUpdate(deps())).resolves.toBe('failed');

        feed = manifest();
        stamp = { build: 119, shell: 1 };
        await expect(checkForUiUpdate(deps())).resolves.toBe('failed');

        expect(readUiUpdateState(root).installed).toBeUndefined();
        expect(existsSync(join(root, '120'))).toBe(false);
    });

    it('prunes builds no launch will load', async () => {
        for (const name of ['110', '120', '130.partial']) {
            mkdirSync(join(root, name));
        }
        writeFileSync(join(root, 'state.json'), '{}');

        await pruneUiBuilds(root, [120, null]);

        expect(readdirSync(root).sort()).toEqual(['120', 'state.json']);
    });
});
