/**
 * Loads a package the workspace installs only as another package's
 * dependency (acorn through ESLint, regexpu-core through Babel), so the TV
 * build needs no new root dependency. pnpm keeps every installed package
 * under node_modules/.pnpm/<name>@<version>/node_modules/<name>; the newest
 * version found there is used.
 */
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);

function compareVersions(a, b) {
    const pa = a.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
    const pb = b.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
}

/** The newest `name@x.y.z` directory in a pnpm store listing. */
export function newestStoreEntry(entries, name) {
    const prefix = `${name.replace('/', '+')}@`;
    const versions = entries
        .filter((entry) => entry.startsWith(prefix))
        .map((entry) => entry.slice(prefix.length).split('_')[0])
        .filter((version) => /^\d+\.\d+\.\d+$/.test(version));
    versions.sort(compareVersions);
    const newest = versions[versions.length - 1];
    return newest
        ? entries.find((entry) => entry.startsWith(`${prefix}${newest}`))
        : null;
}

export function requireHoisted(name, root = WORKSPACE) {
    try {
        return require(require.resolve(name, { paths: [root] }));
    } catch {
        // Not linked at the root: look in pnpm's store.
    }
    const store = join(root, 'node_modules', '.pnpm');
    const entry = existsSync(store)
        ? newestStoreEntry(readdirSync(store), name)
        : null;
    const dir = entry ? join(store, entry, 'node_modules', name) : null;
    if (!dir || !existsSync(dir)) {
        throw new Error(
            `${name} is not installed: run pnpm install --frozen-lockfile`
        );
    }
    return require(dir);
}
