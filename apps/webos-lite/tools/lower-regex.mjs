/**
 * Chrome 53 (LG webOS 4) knows the regex `u` flag but not Unicode property
 * escapes (`\p{L}`, Chrome 64) or the `s` flag (Chrome 62). The shared
 * catalog code uses `\p{L}` to read channel names, and esbuild cannot
 * lower regexes, so this pass rewrites them in the built bundle with
 * regexpu-core: `/[\p{L}]+/u` becomes the same class spelled as ranges.
 *
 * It handles regex literals and `new RegExp("…", "…")` / `RegExp("…")`
 * with literal strings. Anything it cannot rewrite (lookbehind, named
 * groups, a pattern built at run time) is left for gates.mjs to reject.
 */
import { requireHoisted } from './resolve-hoisted.mjs';

const acorn = requireHoisted('acorn');
const rewritePattern = requireHoisted('regexpu-core');

const NEEDS_LOWERING = /\\[pP]\{/;
const OPTIONS = { unicodePropertyEscapes: 'transform', dotAllFlag: 'transform' };

function needsLowering(pattern, flags) {
    return NEEDS_LOWERING.test(pattern) || flags.includes('s');
}

/** The pattern and flags Chrome 53 understands. */
export function lowerPattern(pattern, flags) {
    const lowered = rewritePattern(pattern, flags, OPTIONS);
    return { pattern: lowered, flags: flags.replace('s', '') };
}

/** A `/` the pattern does not escape would end a literal early. */
function hasBareSlash(pattern) {
    let inClass = false;
    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === '\\') {
            i++;
        } else if (char === '[') {
            inClass = true;
        } else if (char === ']') {
            inClass = false;
        } else if (char === '/' && !inClass) {
            return true;
        }
    }
    return false;
}

function literalSource(pattern, flags) {
    return hasBareSlash(pattern)
        ? `new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)})`
        : `/${pattern}/${flags}`;
}

function* walk(node) {
    if (!node || typeof node.type !== 'string') {
        return;
    }
    yield node;
    for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) {
            for (const child of value) {
                yield* walk(child);
            }
        } else if (value && typeof value.type === 'string') {
            yield* walk(value);
        }
    }
}

function stringLiteral(node) {
    return node && node.type === 'Literal' && typeof node.value === 'string'
        ? node
        : null;
}

/** The edits that lower one node, if it is a regex that needs them. */
function editsFor(node) {
    if (node.type === 'Literal' && node.regex) {
        const { pattern, flags } = node.regex;
        if (!needsLowering(pattern, flags)) {
            return [];
        }
        const lowered = lowerPattern(pattern, flags);
        return [
            {
                start: node.start,
                end: node.end,
                text: literalSource(lowered.pattern, lowered.flags),
            },
        ];
    }
    const isRegExpCall =
        (node.type === 'NewExpression' || node.type === 'CallExpression') &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'RegExp';
    const patternNode = isRegExpCall ? stringLiteral(node.arguments[0]) : null;
    const flagsNode = isRegExpCall ? stringLiteral(node.arguments[1]) : null;
    if (!patternNode || (node.arguments.length > 1 && !flagsNode)) {
        return [];
    }
    const flags = flagsNode ? flagsNode.value : '';
    if (!needsLowering(patternNode.value, flags)) {
        return [];
    }
    const lowered = lowerPattern(patternNode.value, flags);
    const edits = [
        {
            start: patternNode.start,
            end: patternNode.end,
            text: JSON.stringify(lowered.pattern),
        },
    ];
    if (flagsNode) {
        edits.push({
            start: flagsNode.start,
            end: flagsNode.end,
            text: JSON.stringify(lowered.flags),
        });
    }
    return edits;
}

/** The bundle with every lowerable regex rewritten; `count` says how many. */
export function lowerRegexes(code) {
    const ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'script',
    });
    const edits = [];
    for (const node of walk(ast)) {
        edits.push(...editsFor(node));
    }
    edits.sort((a, b) => b.start - a.start);
    let out = code;
    for (const edit of edits) {
        out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    }
    return { code: out, count: edits.length };
}
