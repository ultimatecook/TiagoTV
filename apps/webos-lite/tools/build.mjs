#!/usr/bin/env node
/**
 * Builds TiagoTV liviano into dist/webos-lite: one classic script (an
 * IIFE for Chrome 53, with the polyfills first), one stylesheet, fonts,
 * images, the vendored mpegts.js and the webOS appinfo.json, then runs the
 * TV gates (gates.mjs) over the result.
 *
 *   node apps/webos-lite/tools/build.mjs [--dev] [--out <dir>]
 *
 * --dev skips minification and inlines a source map (for ares-inspect).
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { pureLibsPlugin } from './esbuild-pure-libs.mjs';
import { checkBuild, formatProblems } from './gates.mjs';
import { lowerRegexes } from './lower-regex.mjs';
import { checkStrings } from './strings-check.mjs';
import { webosVersion } from './webos-version.mjs';

const APP = fileURLToPath(new URL('../', import.meta.url));
const ROOT = join(APP, '..', '..');
const SRC = join(APP, 'src');

/** The stylesheet, in cascade order. */
export const STYLES = [
    'fonts.css',
    'base.css',
    'topbar.css',
    'rows.css',
    'cards.css',
    'home.css',
    'catalog.css',
    'detail.css',
    'sports.css',
    'live.css',
    'search.css',
    'screens.css',
    'player.css',
];

const FONTS = [
    ['node_modules/@fontsource/dm-sans/files', 'dm-sans-latin-400-normal.woff2'],
    ['node_modules/@fontsource/dm-sans/files', 'dm-sans-latin-ext-400-normal.woff2'],
    ['node_modules/@fontsource/dm-sans/files', 'dm-sans-latin-600-normal.woff2'],
    ['node_modules/@fontsource/dm-sans/files', 'dm-sans-latin-ext-600-normal.woff2'],
    ['node_modules/@fontsource/dm-sans/files', 'dm-sans-latin-700-normal.woff2'],
    ['node_modules/@fontsource/dm-sans/files', 'dm-sans-latin-ext-700-normal.woff2'],
    ['apps/web/src/assets/fonts/bebas-neue', 'bebas-neue-latin-400-normal.woff2'],
    ['apps/web/src/assets/fonts/bebas-neue', 'bebas-neue-latin-ext-400-normal.woff2'],
];

/** The files of a workspace folder whose names match `pattern`. */
function listed(dir, pattern) {
    return readdirSync(join(ROOT, dir)).filter((name) => pattern.test(name)).sort();
}

/** [source, destination] pairs, relative to the workspace and the output. */
const ASSETS = [
    ...['ar', 'es', 'gb', 'us'].map((id) => [
        `apps/web/src/assets/flags/${id}.svg`,
        `img/flags/${id}.svg`,
    ]),
    ['apps/web/src/assets/flags/LICENSE', 'img/flags/LICENSE'],
    ...[
        'netflix.svg',
        'prime-video.svg',
        'hbo-max.svg',
        'disney-plus.svg',
        'apple-tv.svg',
        'paramount-plus.svg',
        'hulu.svg',
        'movistar-plus.png',
        'atresplayer.svg',
        'mitele.svg',
        'crave.png',
    ].map((name) => [
        `apps/web/src/assets/platforms/${name}`,
        `img/platforms/${name}`,
    ]),
    // The league cards' cut-outs and logos, and the sports channels' logos
    // (the desktop's sport-section-list.ts and match channels).
    ...listed('apps/web/src/assets/sports', /\.webp$/).map((name) => [
        `apps/web/src/assets/sports/${name}`,
        `img/sports/${name}`,
    ]),
    ...listed('apps/web/src/assets/sports/logos', /\.(png|svg)$/).map((name) => [
        `apps/web/src/assets/sports/logos/${name}`,
        `img/sports/logos/${name}`,
    ]),
    ...listed('apps/web/src/assets/channels', /\.(png|svg)$/).map((name) => [
        `apps/web/src/assets/channels/${name}`,
        `img/channels/${name}`,
    ]),
    ['apps/webos-lite/webos/icon.png', 'icon.png'],
    ['apps/webos-lite/webos/largeIcon.png', 'largeIcon.png'],
    ['node_modules/mpegts.js/dist/mpegts.js', 'vendor/mpegts.js'],
    ['node_modules/mpegts.js/LICENSE', 'vendor/mpegts.LICENSE.txt'],
];

function copy(from, to) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
}

/** The TV app's own version, in webos/appinfo.json (webOS: x.y.z). */
function readVersion() {
    return JSON.parse(readFileSync(join(APP, 'webos', 'appinfo.json'), 'utf8')).version;
}

async function bundleScript({ dev, version, polyfills }) {
    const result = await esbuild.build({
        absWorkingDir: ROOT,
        entryPoints: [join(SRC, 'main.ts')],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        // Chrome 53 parses `**`, the ES2015 syntax gate does not.
        target: ['chrome53', 'es2015'],
        // Regexes stay literals: lower-regex.mjs rewrites what Chrome 53
        // lacks, instead of esbuild's run-time `new RegExp` that would throw.
        supported: {
            'regexp-unicode-property-escapes': true,
            'regexp-dot-all-flag': true,
        },
        tsconfig: join(APP, 'tsconfig.app.json'),
        plugins: [pureLibsPlugin()],
        banner: { js: polyfills.trim() },
        define: {
            __APP_VERSION__: JSON.stringify(version),
            __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
        },
        minify: !dev,
        sourcemap: dev ? 'inline' : false,
        legalComments: 'none',
        logLevel: 'warning',
        metafile: true,
    });
    const code = result.outputFiles[0].text;
    const lowered = lowerRegexes(code);
    return { code: lowered.code, regexes: lowered.count, meta: result.metafile };
}

async function bundleStyles(dev) {
    const css = STYLES.map((name) =>
        readFileSync(join(SRC, 'styles', name), 'utf8')
    ).join('\n');
    const result = await esbuild.transform(css, {
        loader: 'css',
        target: ['chrome53'],
        minify: !dev,
    });
    return result.code;
}

export async function build({ dev = false, out = join(ROOT, 'dist', 'webos-lite') } = {}) {
    const version = webosVersion(readVersion());
    const polyfills = readFileSync(join(SRC, 'polyfills.js'), 'utf8');
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });

    const script = await bundleScript({ dev, version, polyfills });
    writeFileSync(join(out, 'app.js'), script.code);
    writeFileSync(join(out, 'app.css'), await bundleStyles(dev));
    writeFileSync(
        join(out, 'index.html'),
        readFileSync(join(SRC, 'index.html'), 'utf8').replace(
            /__APP_VERSION__/g,
            version
        )
    );
    for (const [dir, name] of FONTS) {
        copy(join(ROOT, dir, name), join(out, 'fonts', name));
    }
    for (const [from, to] of ASSETS) {
        copy(join(ROOT, from), join(out, to));
    }
    copy(join(APP, 'webos', 'appinfo.json'), join(out, 'appinfo.json'));

    const problems = checkBuild(out, polyfills).concat(await checkStrings(APP, ROOT));
    const libsBytes = Object.entries(script.meta.outputs)[0][1].inputs;
    const shared = Object.keys(libsBytes).filter((input) => input.startsWith('libs/'));
    return {
        out,
        version,
        problems,
        bytes: Buffer.byteLength(script.code),
        regexes: script.regexes,
        sharedModules: shared.length,
    };
}

async function main(args) {
    const dev = args.includes('--dev');
    const outIndex = args.indexOf('--out');
    const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
    const result = await build({ dev, ...(out ? { out } : {}) });
    const where = relative(process.cwd(), result.out) || '.';
    if (result.problems.length > 0) {
        console.error(
            `TV gates failed for ${where} (Chrome 53, webOS 4.10):\n${formatProblems(result.problems)}`
        );
        process.exit(1);
    }
    console.log(
        `Built ${where} v${result.version}: app.js ${(result.bytes / 1024).toFixed(0)} KB, ` +
            `${result.sharedModules} shared modules, ${result.regexes} regexes lowered; TV gates passed.`
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.stack || error.message);
        process.exit(1);
    });
}
