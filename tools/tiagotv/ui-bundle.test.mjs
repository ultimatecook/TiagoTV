import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { manifest, readShellLevel, stamp } from './ui-bundle.mjs';

test('reads the shell level the main process declares', () => {
    assert.equal(readShellLevel('export const TIAGOTV_UI_SHELL_LEVEL = 3;'), 3);
    assert.equal(Number.isInteger(readShellLevel()), true);
    assert.throws(() => readShellLevel('nothing here'));
});

test('stamps a renderer build and describes its zip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tiagotv-ui-'));
    try {
        const stamped = stamp(dir, 1760000000);
        assert.deepEqual(
            JSON.parse(readFileSync(join(dir, 'tiagotv-ui.json'), 'utf8')),
            stamped
        );

        const zip = join(dir, 'ui.zip');
        writeFileSync(zip, 'zip bytes');
        const url =
            'https://github.com/ultimatecook/TiagoTV-updates/releases/download/ui-1/tiagotv-ui-1.zip';
        assert.deepEqual(manifest(dir, zip, url), {
            build: 1760000000,
            shell: stamped.shell,
            url,
            sha256: createHash('sha256').update('zip bytes').digest('hex'),
            size: 9,
        });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
