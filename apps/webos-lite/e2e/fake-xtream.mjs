#!/usr/bin/env node
/**
 * A local Xtream panel for TiagoTV liviano's smoke run (never the real
 * provider): player_api.php over the fictional line-up in fake-catalog.mjs,
 * SVG logos and posters, and streams that stay open like live ones.
 *
 * It enforces the account's single connection the way panels do: a second
 * stream while one is open is refused with 458, and `/__stats` reports
 * the most streams ever open at once. `/__busy?on=1` makes every stream
 * refuse (another device holds the connection); `/__stall?on=1` makes live
 * streams send a few seconds and then hold the connection without data
 * (a stalled channel).
 *
 * A live `.m3u8` is a real HLS playlist over `segment` (an MPEG-TS file),
 * as panels serve it; episodes send `episodeMedia` (two audio tracks)
 * when given, every other stream sends `media`. Episode 1 of each season
 * lists two subtitle files in its info, as some panels do: Spanish SRT
 * (saved as Windows-1252, like many) and English WebVTT, under `/subs/`.
 *
 *   node apps/webos-lite/e2e/fake-xtream.mjs [port] [--media <file>] [--segment <file>]
 *
 * `--media` serves that file for every stream (a WebM clip lets desktop
 * Chromium, which lacks MPEG-TS and H.264, stand in for the TV's player).
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { ACCOUNT, LIVE_CATEGORIES, liveStreams, NO_BACKDROP, SERIES_CATEGORIES, titleName, VOD_CATEGORIES, vodCatalog } from './fake-catalog.mjs';

const LIVE_HOLD_MS = 60000;
/** What a stalled live stream sends before it stops: about 3 s of the clip. */
const STALL_BYTES = 160 * 1024;

/** A subtitle file: a line every two seconds for a minute. */
function subtitleFile(language) {
    const vtt = language === 'en';
    const stamp = (seconds) => `00:00:${String(Math.floor(seconds)).padStart(2, '0')}${vtt ? '.' : ','}${seconds % 1 ? '800' : '000'}`;
    const blocks = [];
    for (let start = 0; start < 60; start += 2) {
        const line = vtt ? `Where is it? Line ${start / 2 + 1}` : `¿Dónde está? Línea ${start / 2 + 1}`;
        blocks.push(`${vtt ? '' : `${start / 2 + 1}\n`}${stamp(start)} --> ${stamp(start + 1.8)}\n${vtt ? line : `<i>${line}</i>`}`);
    }
    const text = `${vtt ? 'WEBVTT\n\n' : ''}${blocks.join('\n\n')}\n`;
    return vtt ? Buffer.from(text, 'utf8') : Buffer.from(text, 'latin1');
}

function hlsPlaylist(base, segments = 6) {
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:2', '#EXT-X-MEDIA-SEQUENCE:0'];
    for (let i = 0; i < segments; i++) {
        lines.push('#EXTINF:2.000000,', `${base}/hls/seg${i}.ts`);
    }
    return `${lines.join('\n')}\n`;
}

function svg(text, width, height, hue) {
    const safe = String(text).replace(/[<>&"]/g, '').slice(0, 28);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="hsl(${hue},45%,22%)"/>
<text x="50%" y="54%" font-family="Arial" font-weight="700" font-size="${Math.round(width / 9)}" fill="#f4f1ea" text-anchor="middle">${safe}</text></svg>`;
}

/** Artwork for a title: a lit gradient with a horizon, no text (the app writes the name). */
function art(name, width, height) {
    const hue = hueOf(name);
    const second = (hue + 40) % 360;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},38%,46%)"/><stop offset="1" stop-color="hsl(${second},42%,14%)"/></linearGradient>
<radialGradient id="l" cx="0.7" cy="0.3" r="0.6"><stop offset="0" stop-color="hsl(${second},70%,75%)" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#l)"/>
<path d="M0 ${height * 0.72} Q ${width * 0.3} ${height * 0.6} ${width * 0.55} ${height * 0.7} T ${width} ${height * 0.66} V ${height} H 0 Z" fill="hsl(${hue},30%,9%)" opacity="0.85"/></svg>`;
}

const hueOf = (text) => [...String(text)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;

/** Prime Video's series (2350), padded to a provider-sized list. */
const BIG_CATEGORY = '2350';

function bigSeries(base) {
    const plot = 'Una serie de relleno del panel local, para probar una lista enorme como las de los proveedores. '.repeat(18);
    const cast = 'Actriz Uno, Actor Dos, Actriz Tres, Actor Cuatro, Actriz Cinco, Actor Seis';
    const old = Math.floor(Date.now() / 1000) - 400 * 86400;
    return Array.from({ length: 1500 }, (_, index) => ({
        num: 80000 + index,
        series_id: 80000 + index,
        name: `RELLENO ${String(index + 1).padStart(4, '0')} (2015)`,
        cover: `${base}/poster/RELLENO%20${index + 1}.svg`,
        plot,
        cast,
        director: 'Directora de prueba',
        genre: 'Drama',
        releaseDate: '2015-01-01',
        last_modified: String(old - index * 3600),
        rating: '6.1',
        backdrop_path: [`${base}/backdrop/RELLENO%20${index + 1}.svg`, `${base}/backdrop/RELLENO%20${index + 1}b.svg`],
        youtube_trailer: '',
        episode_run_time: '45',
        category_id: BIG_CATEGORY,
        category_ids: [Number(BIG_CATEGORY)],
        tmdb: String(900000 + index),
    }));
}

export function startFakeXtream({ port = 0, media = null, segment = null, episodeMedia = null } = {}) {
    const stats = { open: 0, maxOpen: 0, streams: [], api: [], calls: [], refused: 0, segments: 0, subtitles: [] };
    let busy = false;
    let stall = false;
    let big = false;
    const slow = new Map();
    let base = '';
    const logo = (name) => `${base}/logo/${encodeURIComponent(name)}.svg`;
    const live = () =>
        liveStreams().map((entry) => ({
            ...entry,
            stream_icon: entry.stream_icon === 'auto' ? logo(entry.name.replace(/^\|\w+\|\s*/, '')) : entry.stream_icon,
        }));
    // Built on first use: poster URLs need the port the panel listens on.
    let built = null;
    const catalogOf = () =>
        (built ??= vodCatalog({
            poster: (name) => `${base}/poster/${encodeURIComponent(name)}.svg`,
            backdrop: (name) => `${base}/backdrop/${encodeURIComponent(name)}.svg`,
            broken: (name) => `${base}/missing/${encodeURIComponent(name)}.svg`,
        }));

    const send = (res, status, body, type = 'application/json') => {
        res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };

    function api(query) {
        const action = query.get('action') ?? '';
        stats.api.push(action || 'account');
        stats.calls.push({ action: action || 'account', category: query.get('category_id'), at: Date.now() });
        if (query.get('username') !== ACCOUNT.username || query.get('password') !== ACCOUNT.password) {
            return { user_info: { auth: 0 } };
        }
        const category = query.get('category_id');
        const catalog = catalogOf();
        const byCategory = (list) => (category ? list.filter((item) => String(item.category_id) === category) : list);
        switch (action) {
            case '':
                return {
                    user_info: {
                        username: ACCOUNT.username,
                        password: ACCOUNT.password,
                        auth: 1,
                        status: 'Active',
                        exp_date: String(Math.floor(Date.now() / 1000) + 200 * 86400),
                        is_trial: '0',
                        active_cons: busy ? '1' : String(stats.open),
                        max_connections: '1',
                    },
                    server_info: { timezone: 'UTC', timestamp_now: Math.floor(Date.now() / 1000) },
                };
            case 'get_live_categories':
                return LIVE_CATEGORIES;
            case 'get_vod_categories':
                return VOD_CATEGORIES;
            case 'get_series_categories':
                return SERIES_CATEGORIES;
            case 'get_live_streams':
                return byCategory(live());
            case 'get_vod_streams':
                return category ? catalog.vod[category] ?? [] : Object.values(catalog.vod).flat();
            case 'get_series': {
                const list = category ? catalog.series[category] ?? [] : Object.values(catalog.series).flat();
                return big && category === BIG_CATEGORY ? list.concat(bigSeries(base)) : list;
            }
            case 'get_vod_info': {
                const id = Number(query.get('vod_id'));
                const item = Object.values(catalog.vod).flat().find((entry) => entry.stream_id === id);
                return {
                    info: {
                        name: item?.name,
                        plot: 'Una película de prueba del panel local: nada sale de esta máquina.',
                        releasedate: '2021-05-01',
                        duration_secs: 5400,
                        genre: 'Acción, Drama',
                        rating: item?.rating ?? '7',
                        cover_big: item?.stream_icon,
                        backdrop_path: NO_BACKDROP.includes(titleName(item?.name)) ? [] : [item?.stream_icon?.replace('/poster/', '/backdrop/')],
                    },
                    movie_data: { stream_id: id, container_extension: 'mkv' },
                };
            }
            case 'get_series_info': {
                const id = Number(query.get('series_id'));
                const episodes = {};
                for (const season of [1, 2]) {
                    episodes[String(season)] = [1, 2, 3, 4].map((number) => {
                        const episodeId = id * 100 + season * 10 + number;
                        return {
                            id: String(episodeId),
                            episode_num: number,
                            title: `Capítulo ${number}`,
                            container_extension: 'mp4',
                            season,
                            info: { duration_secs: 2700, plot: `Episodio ${number} de la temporada ${season}.`, audio: { codec_name: 'vorbis', tags: { language: 'eng' } } },
                            ...(number === 1
                                ? { subtitles: [{ url: `${base}/subs/${episodeId}.es.srt`, language: 'spa', label: 'Español' }, { file: `${base}/subs/${episodeId}.en.vtt`, lang: 'eng' }] }
                                : {}),
                        };
                    });
                }
                return { info: { name: 'Serie', plot: 'Una serie de prueba.', releaseDate: '2019-01-01', genre: 'Drama', rating: '8.1' }, episodes };
            }
            case 'get_short_epg':
                return {
                    epg_listings: [
                        { title: Buffer.from('Noticias de la mañana').toString('base64'), start_timestamp: String(Math.floor(Date.now() / 1000) - 1200), stop_timestamp: String(Math.floor(Date.now() / 1000) + 2400) },
                        { title: Buffer.from('Fútbol en vivo').toString('base64'), start_timestamp: String(Math.floor(Date.now() / 1000) + 2400), stop_timestamp: String(Math.floor(Date.now() / 1000) + 9600) },
                    ],
                };
            default:
                return { error: `Unknown action ${action}` };
        }
    }

    function stream(req, res, path) {
        // Never record the credentials, only the stream id.
        const [, kind, , , file] = path.split('/');
        stats.streams.push(`${kind}/${file}`);
        if (busy || stats.open >= 1) {
            stats.refused++;
            send(res, busy ? 403 : 458, 'Max connections reached', 'text/plain');
            return;
        }
        if (kind === 'live' && file.endsWith('.m3u8')) {
            // A playlist answers at once: it is no lasting connection.
            send(res, 200, hlsPlaylist(base), 'application/vnd.apple.mpegurl');
            return;
        }
        if (!media) {
            send(res, 404, 'No media', 'text/plain');
            return;
        }
        stats.open++;
        stats.maxOpen = Math.max(stats.maxOpen, stats.open);
        let closed = false;
        const done = () => {
            if (!closed) {
                closed = true;
                stats.open--;
            }
        };
        res.on('close', done);
        if (kind === 'live') {
            // Live streams have no length and do not end (chunked, held open).
            res.writeHead(200, { 'Content-Type': 'video/webm', 'Access-Control-Allow-Origin': '*', Connection: 'close' });
            const body = createReadStream(media, stall ? { start: 0, end: STALL_BYTES - 1 } : {});
            body.on('end', () => setTimeout(() => res.end(), LIVE_HOLD_MS));
            body.pipe(res, { end: false });
            return;
        }
        const source = kind === 'series' && episodeMedia ? episodeMedia : media;
        const size = statSync(source).size;
        const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
        const start = range ? Number(range[1]) : 0;
        const end = range && range[2] ? Number(range[2]) : size - 1;
        res.writeHead(range ? 206 : 200, {
            'Content-Type': 'video/webm',
            'Access-Control-Allow-Origin': '*',
            'Accept-Ranges': 'bytes',
            Connection: 'close',
            'Content-Length': end - start + 1,
            ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
        });
        createReadStream(source, { start, end }).pipe(res);
    }

    const server = createServer((req, res) => {
        const url = new URL(req.url, 'http://local');
        const path = url.pathname;
        if (path === '/player_api.php') {
            const body = api(url.searchParams);
            const action = url.searchParams.get('action') ?? '';
            const delay = /^get_(vod_streams|series)$/.test(action)
                ? slow.get(url.searchParams.get('category_id')) ?? slow.get('all') ?? 0
                : slow.get(url.searchParams.get('category_id')) ?? 0;
            if (delay > 0) {
                setTimeout(() => {
                    if (!res.destroyed) {
                        send(res, 200, body);
                    }
                }, delay);
            } else {
                send(res, 200, body);
            }
        } else if (/^\/(live|movie|series)\//.test(path)) {
            stream(req, res, path);
        } else if (/^\/subs\/\d+\.(es\.srt|en\.vtt)$/.test(path)) {
            stats.subtitles.push(path.slice(6));
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            res.end(subtitleFile(path.endsWith('.vtt') ? 'en' : 'es'));
        } else if (path.startsWith('/hls/')) {
            stats.segments++;
            if (!segment) {
                send(res, 404, 'No segment', 'text/plain');
            } else {
                res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Access-Control-Allow-Origin': '*' });
                createReadStream(segment).pipe(res);
            }
        } else if (path.startsWith('/logo/') || path.startsWith('/poster/') || path.startsWith('/backdrop/')) {
            const name = decodeURIComponent(path.split('/')[2].replace(/\.svg$/, ''));
            const body = path.startsWith('/poster/')
                ? art(name, 342, 513)
                : path.startsWith('/backdrop/')
                  ? art(name, 1280, 720)
                  : svg(name, 400, 200, hueOf(name));
            send(res, 200, body, 'image/svg+xml');
        } else if (path === '/__stats') {
            send(res, 200, { ...stats, busy, stall, big });
        } else if (path === '/__busy') {
            busy = url.searchParams.get('on') === '1';
            send(res, 200, { busy });
        } else if (path === '/__stall') {
            stall = url.searchParams.get('on') === '1';
            send(res, 200, { stall });
        } else if (path === '/__slow') {
            const ms = Number(url.searchParams.get('ms') ?? 0);
            const id = url.searchParams.get('category') ?? 'all';
            if (ms > 0) {
                slow.set(id, ms);
            } else {
                slow.delete(id);
            }
            send(res, 200, { slow: [...slow.entries()] });
        } else if (path === '/__big') {
            big = url.searchParams.get('on') === '1';
            send(res, 200, { big });
        } else {
            send(res, 404, 'Not found', 'text/plain');
        }
    });
    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            base = `http://127.0.0.1:${server.address().port}`;
            resolve({ url: base, stats, server, close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(done); }) });
        });
    });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    const args = process.argv.slice(2);
    const valueOf = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : null);
    const port = Number(args.find((arg) => /^\d+$/.test(arg)) ?? 3299);
    startFakeXtream({ port, media: valueOf('--media'), segment: valueOf('--segment') }).then(({ url }) => console.log(`Fake Xtream panel at ${url} (user ${ACCOUNT.username})`));
}
