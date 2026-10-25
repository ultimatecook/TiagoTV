/**
 * The TV's Spanish copy (src/data/strings.ts, `ES`) must say what the
 * desktop app says: every key there is checked against the desktop's
 * es.json. A key missing there, or a different text, fails the build.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';

function lookup(tree, key) {
    return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), tree);
}

export async function checkStrings(appDir, rootDir) {
    const bundle = await esbuild.build({
        entryPoints: [join(appDir, 'src', 'data', 'strings.ts')],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral',
        logLevel: 'silent',
    });
    const source = bundle.outputFiles[0].text;
    const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const desktop = JSON.parse(readFileSync(join(rootDir, 'apps', 'web', 'src', 'assets', 'i18n', 'es.json'), 'utf8'));
    const problems = [];
    for (const [key, text] of Object.entries(module.ES)) {
        const expected = lookup(desktop, key);
        if (expected !== text) {
            problems.push({
                file: 'src/data/strings.ts',
                line: 0,
                message: expected === undefined ? `${key} is not in es.json` : `${key} is "${expected}" in es.json`,
            });
        }
    }
    return problems;
}
