/**
 * What the LG TV's engine (Chrome 53, webOS 4.10) cannot run, checked on
 * the built files: one unsupported token is a blank screen on the TV.
 *
 *   - syntax: the bundle must parse as ES2015 (classic script);
 *   - APIs: no call to a built-in Chrome 53 lacks and the banner does not
 *     polyfill;
 *   - Angular: none of it may reach the bundle (see esbuild-pure-libs.mjs);
 *   - CSS: no flex/grid `gap`, Grid, `inset`, `:has`, `color-mix`… and,
 *     for a 2019 TV, transitions and animations of transform and opacity
 *     only, and no blur.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { requireHoisted } from './resolve-hoisted.mjs';

const acorn = requireHoisted('acorn');

export const SYNTAX_ECMA_VERSION = 2015;

/** Built-ins the bundle may use because polyfills.js adds them. */
export const POLYFILLED = [
    'Object.entries',
    'Object.values',
    'Object.assign',
    'Object.getOwnPropertyDescriptors',
    'String.prototype.padStart',
    'String.prototype.padEnd',
    'Array.prototype.includes',
    'Promise.prototype.finally',
];

const FORBIDDEN_APIS = [
    [/\.replaceAll\(/, 'String.prototype.replaceAll (Chrome 85)'],
    [/\.matchAll\(/, 'String.prototype.matchAll (Chrome 73)'],
    [/\.flatMap\(|\.flat\(/, 'Array.prototype.flat/flatMap (Chrome 69)'],
    [/\.at\(/, '.at() (Chrome 92)'],
    [/\.findLast(Index)?\(/, 'Array.prototype.findLast (Chrome 97)'],
    [/\.to(Sorted|Reversed|Spliced)\(/, 'change-array-by-copy (Chrome 110)'],
    [/\.trim(Start|End)\(/, 'trimStart/trimEnd (Chrome 66)'],
    [/\bObject\.fromEntries\b/, 'Object.fromEntries (Chrome 73)'],
    [/\bObject\.hasOwn\b/, 'Object.hasOwn (Chrome 93)'],
    [/\bObject\.groupBy\b/, 'Object.groupBy (Chrome 117)'],
    [/\bstructuredClone\b/, 'structuredClone (Chrome 98)'],
    [/\brandomUUID\b/, 'crypto.randomUUID (Chrome 92)'],
    [/\bPromise\.(allSettled|any)\b/, 'Promise.allSettled/any (Chrome 76)'],
    [/\bglobalThis\b/, 'globalThis (Chrome 71)'],
    [/\bqueueMicrotask\b/, 'queueMicrotask (Chrome 71)'],
    [/\bAbortController\b/, 'AbortController (Chrome 66)'],
    [/\bResizeObserver\b/, 'ResizeObserver (Chrome 64)'],
    [/\bBigInt\(|\bWeakRef\b|\bFinalizationRegistry\b/, 'BigInt/WeakRef (Chrome 67+)'],
    [/\bSymbol\.asyncIterator\b/, 'async iteration (Chrome 63)'],
    [/\.(append|prepend|replaceWith|replaceChildren)\(/, 'ParentNode.append & co. (Chrome 54+)'],
    [/\.toggleAttribute\(/, 'Element.toggleAttribute (Chrome 69)'],
    [/\.scrollTo\(|scrollIntoView\(\s*\{/, 'scroll options (Chrome 61)'],
    [/\bformatToParts\b|\bIntl\.(RelativeTimeFormat|ListFormat|Segmenter)\b/, 'newer Intl APIs'],
];

const ANGULAR = /ɵɵ|\bngDevMode\b|@angular\/|\bInjectionToken\b/;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Problems are `{ file, line, message }`. */
export function checkSyntax(code, file, ecmaVersion = SYNTAX_ECMA_VERSION) {
    try {
        acorn.parse(code, { ecmaVersion, sourceType: 'script' });
        return [];
    } catch (error) {
        const excerpt = code
            .slice(Math.max(0, error.pos - 60), error.pos + 40)
            .replace(/\s+/g, ' ');
        return [
            {
                file,
                line: error.loc?.line ?? 0,
                message: `not ES${ecmaVersion}: ${error.message} near "${excerpt}"`,
            },
        ];
    }
}

/** Calls of built-ins Chrome 53 lacks. Skips string and comment contents. */
export function checkApis(code, file) {
    const problems = [];
    const tokens = [];
    acorn.tokenizer(code, {
        ecmaVersion: 'latest',
        onToken: (token) => tokens.push(token),
    });
    // Rebuild the code with strings, templates and regexes blanked out.
    let skeleton = '';
    let last = 0;
    for (const token of tokens) {
        const label = token.type.label;
        const opaque =
            label === 'string' || label === 'template' || label === 'regexp';
        skeleton += code.slice(last, token.start);
        skeleton += opaque
            ? code.slice(token.start, token.end).replace(/[^\n]/g, ' ')
            : code.slice(token.start, token.end);
        last = token.end;
    }
    for (const [pattern, name] of FORBIDDEN_APIS) {
        const match = pattern.exec(skeleton);
        if (match) {
            problems.push({
                file,
                line: lineOf(skeleton, match.index),
                message: `uses ${name}`,
            });
        }
    }
    const angular = ANGULAR.exec(skeleton);
    if (angular) {
        problems.push({
            file,
            line: lineOf(skeleton, angular.index),
            message: `Angular code reached the bundle ("${angular[0]}")`,
        });
    }
    return problems;
}

/**
 * Runs `polyfills.js` (the bundle's banner) in a fresh realm without the
 * built-ins it promises, and checks it puts each of them back.
 */
export function checkPolyfills(code, file) {
    const context = vm.createContext({});
    vm.runInContext(
        POLYFILLED.map((name) => `delete ${name};`).join('\n'),
        context
    );
    try {
        vm.runInContext(`var window = this;\n${code}`, context);
    } catch (error) {
        return [{ file, line: 1, message: `polyfills throw: ${error.message}` }];
    }
    const missing = POLYFILLED.filter(
        (name) => vm.runInContext(`typeof ${name}`, context) !== 'function'
    );
    const checks = [
        ["Object.entries({ a: 1 })[0].join('=')", 'a=1'],
        ["'7'.padStart(2, '0')", '07'],
        ["'7'.padEnd(3, 'ab')", '7ab'],
    ];
    const wrong = checks
        .filter(([expression, expected]) => {
            try {
                return vm.runInContext(expression, context) !== expected;
            } catch {
                return true;
            }
        })
        .map(([expression]) => expression);
    return [
        ...missing.map((name) => ({
            file,
            line: 1,
            message: `polyfill missing: ${name}`,
        })),
        ...wrong.map((expression) => ({
            file,
            line: 1,
            message: `polyfill wrong: ${expression}`,
        })),
    ];
}

const CSS_RULES = [
    [/(^|[;{\s])(gap|row-gap|column-gap|grid-gap)\s*:/, 'flex/grid gap (Chrome 84): use margins'],
    [/display\s*:\s*(inline-)?grid\b|grid-template|grid-(area|column|row)\s*:/, 'CSS Grid (Chrome 57)'],
    [/display\s*:\s*(flow-root|contents)\b/, 'display flow-root/contents (Chrome 58+)'],
    [/backdrop-filter/, 'backdrop-filter'],
    [/color-mix\(/, 'color-mix()'],
    [/:(has|where|is)\(/, ':has/:where/:is'],
    [/:focus-(visible|within)/, ':focus-visible/:focus-within (Chrome 60+)'],
    [/:not\([^)]*,/, 'complex :not() (Chrome 88)'],
    [/aspect-ratio/, 'aspect-ratio (Chrome 88)'],
    [/@container|container-(type|name)\s*:|\d+(cqw|cqh)\b/, 'container queries'],
    [/\d(dvh|svh|lvh|dvw|svw|lvw)\b/, 'dynamic viewport units'],
    [/(^|[;{\s])inset(-inline|-block)?(-start|-end)?\s*:/, 'inset (Chrome 87): use top/right/bottom/left'],
    [/(margin|padding|border)-(inline|block)\b|(^|[;{\s])(inline|block)-size\s*:/, 'logical properties'],
    [/position\s*:\s*sticky/, 'position: sticky (Chrome 56)'],
    [/place-(items|content|self)\s*:/, 'place-* (Chrome 59)'],
    [/\b(clamp|min|max)\(/, 'CSS math functions (Chrome 79)'],
    [/\benv\(/, 'env() (Chrome 69)'],
    [/#([0-9a-fA-F]{4}|[0-9a-fA-F]{8})\b/, 'hex colour with alpha (Chrome 62): use rgba()'],
    [/\b(rgba?|hsla?)\(\s*[\d.]+%?\s+[\d.]/, 'space-separated colour syntax (Chrome 65)'],
    [/(^|[;{\s])(translate|rotate|scale)\s*:/, 'individual transform properties'],
    [/scroll-snap|overscroll-behavior/, 'scroll snapping (Chrome 63+)'],
    [/@layer|@property|(^|\s)&[\s.:[]/, '@layer/@property/nesting'],
    [/blur\(/, 'blur(): too heavy for the TV'],
];

const ALLOWED_MOTION = new Set(['transform', 'opacity', 'none']);

function motionProblems(css, file) {
    const problems = [];
    const transition = /transition(-property)?\s*:\s*([^;}]+)/g;
    let match;
    while ((match = transition.exec(css))) {
        for (const part of match[2].split(',')) {
            const property = part.trim().split(/\s+/)[0].replace(/^-webkit-/, '');
            if (!ALLOWED_MOTION.has(property)) {
                problems.push({
                    file,
                    line: lineOf(css, match.index),
                    message: `transition of "${property}": only transform and opacity`,
                });
            }
        }
    }
    const keyframes = /@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g;
    while ((match = keyframes.exec(css))) {
        const declarations = match[1].match(/[\w-]+\s*:/g) ?? [];
        for (const declaration of declarations) {
            const property = declaration.replace(/\s*:$/, '').replace(/^-webkit-/, '');
            if (!ALLOWED_MOTION.has(property)) {
                problems.push({
                    file,
                    line: lineOf(css, match.index),
                    message: `animation of "${property}": only transform and opacity`,
                });
            }
        }
    }
    return problems;
}

export function checkCss(source, file) {
    const css = source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
        comment.replace(/[^\n]/g, ' ')
    );
    const problems = [];
    css.split('\n').forEach((text, index) => {
        for (const [pattern, name] of CSS_RULES) {
            if (pattern.test(text)) {
                problems.push({ file, line: index + 1, message: name });
            }
        }
    });
    return problems.concat(motionProblems(css, file));
}

/** Every gate over a built `dist/webos-lite`, with its banner's source. */
export function checkBuild(dir, polyfillsSource) {
    const read = (name) => readFileSync(join(dir, name), 'utf8');
    const app = read('app.js');
    const banner = app.startsWith(polyfillsSource.trim())
        ? []
        : [{ file: 'app.js', line: 1, message: 'polyfills are not first' }];
    return [
        ...checkSyntax(app, 'app.js'),
        ...checkApis(app, 'app.js'),
        ...checkPolyfills(polyfillsSource, 'polyfills.js'),
        ...banner,
        // The vendored player ships as ES5; it only has to parse.
        ...checkSyntax(read('vendor/mpegts.js'), 'vendor/mpegts.js'),
        ...checkCss(read('app.css'), 'app.css'),
    ];
}

export function formatProblems(problems) {
    return problems
        .map((problem) => `  ${problem.file}:${problem.line} ${problem.message}`)
        .join('\n');
}
