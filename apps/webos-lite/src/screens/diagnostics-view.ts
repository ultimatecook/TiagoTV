import { activity, type Activity } from '../core/activity';
import { serverOffset } from '../core/clock';
import { clear, h } from '../core/dom';
import { pad2 } from '../core/format';
import { registerRevealer, onActivate } from '../core/nav';
import { redact } from '../core/redact';
import { requestLog, type RequestRecord } from '../core/request-log';
import { requestQueueState } from '../core/request-queue';
import { every, type Stop } from '../core/timers';
import { storageUse } from '../data/catalog-persist';
import { crestBook } from '../data/crests';
import { channelCount, isLive } from '../data/sports';
import type { App } from '../app';

/**
 * Ajustes → Diagnóstico: what the TV is doing with the provider, for a
 * photo when something does not load: the queue, the latest requests (by
 * action and category name, never a URL, user or password), the catalog
 * and the sports board, the clock and the storage. It updates itself
 * every couple of seconds while it shows; the D-pad walks the request
 * list, which scrolls.
 */
const TICK_MS = 2000;
const VIEW_TOP = 40;
const VIEW_BOTTOM = 60;

const ACTIVITY: Readonly<Record<Activity, string>> = {
    idle: 'Libre',
    preview: 'Vista previa (En vivo)',
    fullscreen: 'Pantalla completa: cargas en pausa',
};

function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

function size(chars: number): string {
    if (chars <= 0) {
        return '—';
    }
    return chars >= 1024 * 1024 ? `${(chars / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(chars / 1024))} KB`;
}

function clock(at: number): string {
    const date = new Date(at);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function offsetText(offset: number | null): string {
    if (offset === null) {
        return 'Sin dato (Comprobar cuenta lo pide)';
    }
    const minutes = Math.round(Math.abs(offset) / 60000);
    if (minutes < 2) {
        return 'Igual que el servidor';
    }
    const amount = minutes >= 120 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
    return `La tele va ${amount} ${offset > 0 ? 'atrasada' : 'adelantada'}: los partidos en vivo pueden no verse`;
}

function accentsOk(): boolean {
    try {
        return 'Atlético'.normalize('NFD').replace(/[̀-ͯ]/g, '') === 'Atletico';
    } catch {
        return false;
    }
}

function offsetWithin(el: HTMLElement, ancestor: HTMLElement): number {
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== ancestor) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
    }
    return top;
}

export class DiagnosticsView {
    readonly el = h('div', 'diag');
    private readonly content = h('div', 'diag__content');
    private readonly values = new Map<string, HTMLElement>();
    private readonly log = h('div', 'diag__log');
    private shownLog = '';
    private scrollY = 0;
    private ticker: Stop | null = null;

    constructor(private readonly app: App) {
        this.el.appendChild(this.content);
        registerRevealer(this.el, { reveal: (target) => this.reveal(target) });
        const button = (text: string, run: () => void, extra = '') => onActivate(h('div', { className: `button button--small ${extra}`, text }), run);
        this.content.appendChild(h('h2', { className: 'settings__title', text: 'Diagnóstico' }));
        this.content.appendChild(h('p', { className: 'settings__subtitle', text: 'Para sacar una foto si algo no carga. No muestra direcciones, usuarios ni contraseñas.' }));
        this.content.appendChild(
            h(
                'div',
                'diag__actions',
                button('Reintentar cargas', () => {
                    this.app.retryLoads();
                    this.update(true);
                }, 'button--primary'),
                button('Actualizar', () => this.update(true))
            )
        );
        const card = h('div', 'settings__card diag__card');
        for (const [key, title] of [
            ['version', 'Versión'],
            ['activity', 'Actividad'],
            ['queue', 'Cola de cargas'],
            ['clock', 'Reloj'],
            ['text', 'Texto con acentos'],
            ['movies', 'Películas'],
            ['series', 'Series'],
            ['errors', 'Categorías con error'],
            ['sports', 'Deportes hoy'],
            ['sportsLoads', 'Cargas de deportes'],
            ['crests', 'Escudos'],
            ['storage', 'Datos guardados'],
        ]) {
            const value = h('span', 'diag__value');
            this.values.set(key, value);
            card.appendChild(h('div', 'diag__row', h('span', { className: 'diag__key', text: title }), value));
        }
        this.content.appendChild(card);
        this.content.appendChild(h('h3', { className: 'diag__heading', text: 'Últimas cargas' }));
        this.content.appendChild(this.log);
    }

    /** Starts the updates (the section shows). */
    start(): void {
        this.update(true);
        if (!this.ticker) {
            this.ticker = every('diagnostics', TICK_MS, () => this.update());
        }
    }

    stop(): void {
        if (this.ticker) {
            this.ticker();
            this.ticker = null;
        }
    }

    private set(key: string, text: string): void {
        const el = this.values.get(key);
        const shown = redact(text, this.app.client.secrets);
        if (el && el.textContent !== shown) {
            el.textContent = shown;
        }
    }

    /** `full`: the storage too (reading it all is not for every tick). */
    update(full = false): void {
        const now = Date.now();
        const queue = requestQueueState(now);
        this.set('version', `TiagoTV liviano ${this.app.version}`);
        this.set('activity', ACTIVITY[activity()]);
        const running = queue.running ? `ocupada: ${queue.running.label} (${seconds(queue.running.ageMs)})` : 'libre';
        this.set(
            'queue',
            `${queue.paused ? 'en pausa, ' : ''}${running} · ${queue.waiting} esperando${queue.watchdogs > 0 ? ` · ${queue.watchdogs} liberadas por demora` : ''}`
        );
        this.set('clock', offsetText(serverOffset()));
        this.set('text', accentsOk() ? 'Bien' : 'Sin normalize: los nombres con acentos pueden no cruzarse');
        this.catalog();
        this.sports(now);
        const book = crestBook();
        const crests = book.stats;
        this.set(
            'crests',
            `${book.keptCount()} guardados · hoy ${crests.espn} de ESPN, ${crests.sportsDb} de TheSportsDB, ${crests.misses} sin escudo${crests.sportsDbDown ? ' · TheSportsDB sin conexión' : ''}`
        );
        if (full) {
            const use = storageUse();
            this.set('storage', `${size(use.chars * 2)} de unos 5 MB · catálogo ${size(use.catalogChars * 2)}`);
        }
        this.renderLog(requestLog());
    }

    private catalog(): void {
        const statuses = this.app.store.statuses();
        for (const kind of ['movie', 'series'] as const) {
            const mine = statuses.filter((status) => status.kind === kind);
            const count = (state: string) => mine.filter((status) => status.state === state).length;
            const titles = this.app.store.titles(kind).length;
            this.set(
                kind === 'movie' ? 'movies' : 'series',
                mine.length === 0
                    ? 'Sin categorías todavía'
                    : `${count('ok')} cargadas · ${count('kept')} guardadas · ${count('waiting')} pendientes · ${count('failed')} con error · ${titles} títulos`
            );
        }
        const failed = statuses.filter((status) => status.error);
        this.set('errors', failed.length === 0 ? 'Ninguna' : failed.slice(0, 4).map((status) => `${status.name} (${status.kind === 'movie' ? 'películas' : 'series'}): ${status.error}`).join(' · '));
    }

    private sports(now: number): void {
        const board = this.app.sports;
        const data = board.data;
        if (!data) {
            this.set('sports', board.loading ? 'Cargando…' : board.lastError ? 'No se pudo cargar' : 'Sin cargar todavía');
            this.set('sportsLoads', '—');
            return;
        }
        const date = new Date(now);
        const live = data.today.filter((match) => isLive(match, date)).length;
        this.set('sports', `${data.today.length} partidos · ${live} en vivo ahora · ${channelCount(data)} canales${data.complete ? '' : ' (faltan categorías)'}`);
        const stats = data.stats;
        this.set(
            'sportsLoads',
            `${stats.requested} categorías pedidas · ${stats.failed} con error · ${stats.stored} listas guardadas · ${stats.foreign} de otros idiomas · ${clock(data.loadedAt)}`
        );
    }

    private renderLog(records: readonly RequestRecord[]): void {
        const signature = records.map((record) => record.at).join(',');
        const focused = this.log.querySelector('.focused');
        if (signature === this.shownLog || focused) {
            return;
        }
        this.shownLog = signature;
        clear(this.log);
        if (records.length === 0) {
            this.log.appendChild(h('p', { className: 'diag__empty', text: 'Todavía no hubo cargas.' }));
            return;
        }
        for (const record of records) {
            const row = h(
                'div',
                `diag__entry${record.result === 'ok' ? '' : ' is-error'}`,
                h('span', { className: 'diag__at', text: clock(record.at) }),
                h('span', { className: 'diag__what', text: redact(record.label ? `${record.action} · ${record.label}` : record.action, this.app.client.secrets) }),
                h('span', { className: 'diag__ms', text: seconds(record.ms) }),
                h('span', { className: 'diag__size', text: size(record.bytes) }),
                h('span', { className: 'diag__result', text: record.result })
            );
            // Focusable (OK does nothing): the D-pad walks and scrolls the list.
            row.classList.add('f');
            this.log.appendChild(row);
        }
    }

    private reveal(target: HTMLElement): void {
        const height = this.el.offsetHeight || 900;
        const top = offsetWithin(target, this.content);
        const bottom = top + target.offsetHeight;
        let next = this.scrollY;
        if (top - VIEW_TOP < this.scrollY) {
            next = Math.max(0, top - VIEW_TOP);
        } else if (bottom + VIEW_BOTTOM > this.scrollY + height) {
            next = bottom + VIEW_BOTTOM - height;
        }
        if (next !== this.scrollY) {
            this.scrollY = next;
            this.content.style.transform = `translate3d(0, ${-next}px, 0)`;
        }
    }
}
