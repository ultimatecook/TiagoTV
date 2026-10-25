/**
 * The app imports framework-free logic through the workspace's library
 * barrels (`@iptvnator/shared/interfaces`, the dashboard's tv-logic entry),
 * whose other modules hold Angular services and components. Marking every
 * module of `libs/` side-effect free lets esbuild drop whatever the app
 * does not call, so the bundle carries only the pure functions it uses
 * (about 70 KB instead of 1 MB of Angular). gates.mjs fails the build if
 * Angular code still reaches it.
 */
import { sep } from 'node:path';

const LIBS = `${sep}libs${sep}`;

export function pureLibsPlugin() {
    return {
        name: 'pure-libs',
        setup(build) {
            build.onResolve({ filter: /^(@iptvnator\/|\.)/ }, async (args) => {
                if (args.pluginData?.pureLibs) {
                    return undefined;
                }
                const fromLibs = args.importer.includes(LIBS);
                if (!args.path.startsWith('@iptvnator/') && !fromLibs) {
                    return undefined;
                }
                const result = await build.resolve(args.path, {
                    kind: args.kind,
                    importer: args.importer,
                    resolveDir: args.resolveDir,
                    pluginData: { pureLibs: true },
                });
                if (result.errors.length > 0 || !result.path.includes(LIBS)) {
                    return result.errors.length > 0
                        ? { errors: result.errors }
                        : undefined;
                }
                return { ...result, sideEffects: false };
            });
        },
    };
}
