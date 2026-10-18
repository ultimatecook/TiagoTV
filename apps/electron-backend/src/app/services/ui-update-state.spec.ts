import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    installUiBuild,
    markUiBuildHealthy,
    newestUiBuild,
    readUiUpdateState,
    selectRenderer,
    UI_STAMP_FILE,
} from './ui-update-state';

describe('interface update state', () => {
    let base: string;
    let root: string;
    let bundledIndex: string;

    function installBuild(build: number, shell = 1): void {
        const dir = join(root, String(build));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), '<app-root></app-root>');
        installUiBuild(root, { build, shell });
    }

    beforeEach(() => {
        base = mkdtempSync(join(tmpdir(), 'tiagotv-ui-'));
        root = join(base, 'ui-updates');
        const bundledDir = join(base, 'web');
        mkdirSync(bundledDir);
        bundledIndex = join(bundledDir, 'index.html');
        writeFileSync(
            join(bundledDir, UI_STAMP_FILE),
            JSON.stringify({ build: 100, shell: 1 })
        );
    });

    afterEach(() => rmSync(base, { recursive: true, force: true }));

    it('loads the packaged renderer until an update is installed', () => {
        expect(selectRenderer(root, bundledIndex)).toEqual({
            indexPath: bundledIndex,
            build: null,
        });
        expect(newestUiBuild(root, bundledIndex)).toBe(100);
    });

    it('loads a newer installed build and keeps it once it started', () => {
        installBuild(120);

        expect(selectRenderer(root, bundledIndex)).toEqual({
            indexPath: join(root, '120', 'index.html'),
            build: 120,
        });
        markUiBuildHealthy(root, 120);

        expect(selectRenderer(root, bundledIndex).build).toBe(120);
        expect(selectRenderer(root, bundledIndex).build).toBe(120);
        expect(newestUiBuild(root, bundledIndex)).toBe(120);
    });

    it('rejects a build whose first launch never confirmed', () => {
        installBuild(120);
        selectRenderer(root, bundledIndex);

        // Relaunched without markUiBuildHealthy: the build failed.
        expect(selectRenderer(root, bundledIndex).build).toBeNull();
        expect(readUiUpdateState(root)).toEqual({ rejected: [120] });
    });

    it('ignores builds for another main process or older than the app', () => {
        installBuild(120, 2);
        expect(selectRenderer(root, bundledIndex).build).toBeNull();

        installBuild(90);
        expect(selectRenderer(root, bundledIndex).build).toBeNull();
    });

    it('treats an unreadable state file as no update', () => {
        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, 'state.json'), '{ not json');

        expect(readUiUpdateState(root)).toEqual({ rejected: [] });
        expect(selectRenderer(root, bundledIndex).build).toBeNull();
    });
});
