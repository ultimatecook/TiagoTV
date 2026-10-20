#!/usr/bin/env node
/**
 * Replays a provider's live line-up through the TV's sports board, in
 * node, and compares it with the desktop's own sports functions on the
 * same data. The snapshot is a folder with the panel's answers
 * (get_live_categories.json, get_live_streams.json): it stays on the
 * machine that has it (it is never part of the repository), so the check
 * is skipped where there is none, as in CI.
 *
 *   node apps/webos-lite/tools/sports-snapshot-check.mjs --snapshot <dir> [--at <ISO>]…
 *   TIAGOTV_SNAPSHOT=<dir> node apps/webos-lite/tools/sports-snapshot-check.mjs
 *
 * It checks, at a few times of the snapshot's day:
 *   - the TV's "Hoy" and "En vivo ahora" match the desktop's as it
 *     refreshes (its event and fixture categories: EventRefresh), once the
 *     TV's first load has learned which categories hold event channels;
 *     what only the desktop's very first load shows (every language's
 *     feeds) is listed, not failed;
 *   - every Spanish/English category holding event channels is asked
 *     (0.2.1 capped the list at 30 and lost some);
 *   - the bundle built as for the TV (Chrome 53 target, regexes lowered)
 *     gives the same board and the same En vivo rows as plain node: the
 *     lowered `\p{L}` classes still match accented names.
 * Only counts and match titles are printed, never stream URLs.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { pureLibsPlugin } from './esbuild-pure-libs.mjs';
import { lowerRegexes } from './lower-regex.mjs';

const APP = fileURLToPath(new URL('../', import.meta.url));
const ROOT = join(APP, '..', '..');

const ENTRY = `
import { buildSportsCatalog, KickoffMemory, todaysMatches, isMatchOn } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { MemoryStorage } from './src/core/storage';
import { loadSports, isLive } from './src/data/sports';
import { SportsNotes, isEventSlot, isKeptLive } from './src/data/sports-plan';
import { loadCountryRows, LIVE_COUNTRIES } from './src/data/live';
import { eventCategoryIds, fixtureCategoryIds, streamsByCategory, withFreshEvents } from '../../libs/workspace/dashboard/feature/src/lib/sports/live-catalog';
import { sectionsWithChannels } from '../../libs/workspace/dashboard/feature/src/lib/sports/match-channels';

/** The desktop's board from a line-up: its first load (every channel), or as it refreshes (its event categories only). */
function desktopBoard(categories, streams, date, steady) {
    let list = streams;
    if (steady) {
        const live = { categories, streams };
        const ids = eventCategoryIds(live).concat(fixtureCategoryIds(live, sectionsWithChannels(buildSportsCatalog(categories, streams, date))));
        list = withFreshEvents(live, ids, streamsByCategory(streams, ids)).streams;
    }
    const catalog = buildSportsCatalog(categories, list, date);
    const memory = new KickoffMemory(null);
    memory.remember(Object.values(catalog).reduce((all, content) => all.concat(content.matches), []), date.getTime());
    const kickOff = (m) => m.event.start || memory.kickOffOf(m);
    return todaysMatches(catalog, date, kickOff).map((m) => [m, isMatchOn(m, kickOff(m), date)]);
}

const tick = () => new Promise((done) => setTimeout(done, 20));

export async function run(categories, streams, times) {
    const byCategory = new Map();
    for (const stream of streams) {
        const id = String(stream.category_id);
        if (!byCategory.has(id)) byCategory.set(id, []);
        byCategory.get(id).push(stream);
    }
    const asked = [];
    const client = { streams: async (_kind, id) => { asked.push(String(id)); return byCategory.get(String(id)) || []; } };
    const kept = new Set(categories.filter(isKeptLive).map((c) => String(c.category_id)));
    const withEvents = [...byCategory.keys()].filter((id) => kept.has(id) && byCategory.get(id).some((s) => isEventSlot(s.name)));
    const report = { times: [], keptEventCategories: withEvents.length, countries: {} };
    for (const at of times) {
        const now = () => at;
        const notes = new SportsNotes('check', new MemoryStorage());
        asked.length = 0;
        await loadSports(client, categories, { notes, now });
        await tick();
        const firstAsked = asked.length;
        asked.length = 0;
        const tv = await loadSports(client, categories, { notes, now });
        const learnedAsked = new Set(asked);
        const date = new Date(at);
        const line = (m, live) => (live ? 'LIVE ' : '     ') + m.sectionId + ' | ' + m.event.title;
        report.times.push({
            at: date.toISOString(),
            firstLoadRequests: firstAsked,
            refreshRequests: learnedAsked.size,
            missedEventCategories: withEvents.filter((id) => !learnedAsked.has(id)).length,
            tv: tv.today.map((m) => line(m, isLive(m, date))),
            desktop: desktopBoard(categories, streams, date, true).map(([m, live]) => line(m, live)),
            desktopFirstLoad: desktopBoard(categories, streams, date, false).map(([m, live]) => line(m, live)),
            stats: tv.stats,
        });
    }
    for (const country of LIVE_COUNTRIES) {
        const loaded = await loadCountryRows(client, categories, country.id);
        report.countries[country.id] = loaded.country
            ? loaded.country.rows.map((row) => row.channels.map((channel) => channel.title).join(' / '))
            : [];
    }
    return report;
}
`;

function arg(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

function args(name) {
    const values = [];
    process.argv.forEach((value, index) => {
        if (value === name && process.argv[index + 1]) {
            values.push(process.argv[index + 1]);
        }
    });
    return values;
}

async function bundle(forTv) {
    const result = await esbuild.build({
        absWorkingDir: ROOT,
        stdin: { contents: ENTRY, resolveDir: APP, loader: 'ts', sourcefile: 'sports-snapshot-entry.ts' },
        bundle: true,
        write: false,
        format: 'cjs',
        platform: 'node',
        target: forTv ? ['chrome53', 'es2015'] : ['node20'],
        supported: forTv ? { 'regexp-unicode-property-escapes': true, 'regexp-dot-all-flag': true } : {},
        tsconfig: join(APP, 'tsconfig.app.json'),
        plugins: [pureLibsPlugin()],
        logLevel: 'error',
    });
    const code = result.outputFiles[0].text;
    return forTv ? lowerRegexes(code) : { code, count: 0 };
}

async function main() {
    const dir = arg('--snapshot') || process.env.TIAGOTV_SNAPSHOT;
    const files = dir ? ['get_live_categories.json', 'get_live_streams.json'].map((name) => join(dir, name)) : [];
    if (!dir || !files.every((file) => existsSync(file))) {
        console.log('Sports snapshot check skipped: no snapshot (--snapshot <dir> or TIAGOTV_SNAPSHOT).');
        return;
    }
    const [categories, streams] = files.map((file) => JSON.parse(readFileSync(file, 'utf8')));
    // The snapshot's own time: the latest "Live" name the panel gave.
    const named = streams.filter((s) => /^live\s*\|/i.test(s.name)).map((s) => Number(s.added) * 1000).filter(Number.isFinite);
    const t0 = named.length ? Math.max(...named) + 60000 : Date.now();
    const asked = args('--at').map((iso) => Date.parse(iso));
    const times = asked.length ? asked : [t0, t0 + 2 * 3600000, t0 + 6.5 * 3600000];

    const work = mkdtempSync(join(tmpdir(), 'tiagotv-sports-check-'));
    const require = createRequire(import.meta.url);
    const reports = [];
    try {
        for (const forTv of [false, true]) {
            const built = await bundle(forTv);
            const file = join(work, forTv ? 'tv.cjs' : 'node.cjs');
            writeFileSync(file, built.code);
            reports.push(await require(file).run(categories, streams, times));
            if (forTv) {
                console.log(`TV bundle: ${built.count} regexes lowered`);
            }
        }
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
    const [plain, tv] = reports;
    const problems = [];
    if (JSON.stringify(plain) !== JSON.stringify(tv)) {
        problems.push('the Chrome 53 bundle (lowered regexes) differs from plain node');
    }
    console.log(`${categories.length} categories, ${streams.length} channels; ${plain.keptEventCategories} kept categories hold event channels`);
    for (const time of plain.times) {
        const tvLive = time.tv.filter((line) => line.startsWith('LIVE')).length;
        const deskLive = time.desktop.filter((line) => line.startsWith('LIVE')).length;
        console.log(`\n${time.at}: TV ${time.tv.length} today (${tvLive} live) · desktop ${time.desktop.length} (${deskLive} live) · requests ${time.firstLoadRequests} first, ${time.refreshRequests} per refresh`);
        const tvSet = new Set(time.tv);
        const deskSet = new Set(time.desktop);
        time.tv.forEach((line) => console.log(`  ${deskSet.has(line) ? '  ' : '+ '}${line}`));
        time.desktop.filter((line) => !tvSet.has(line)).forEach((line) => console.log(`  - ${line}  (desktop only)`));
        time.desktopFirstLoad
            .filter((line) => !deskSet.has(line))
            .forEach((line) => console.log(`  · ${line}  (only in the desktop's first load, from every language's feeds)`));
        if (time.missedEventCategories > 0) {
            problems.push(`${time.at}: ${time.missedEventCategories} categories with event channels not asked`);
        }
        if (time.desktop.some((line) => !tvSet.has(line)) || time.tv.some((line) => !deskSet.has(line))) {
            problems.push(`${time.at}: the TV's board differs from the desktop's`);
        }
    }
    for (const [country, rows] of Object.entries(plain.countries)) {
        console.log(`\nEn vivo ${country}: ${rows.length} rows`);
    }
    if (problems.length > 0) {
        console.error(`\nSports snapshot check failed:\n  ${problems.join('\n  ')}`);
        process.exit(1);
    }
    console.log('\nSports snapshot check passed.');
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
