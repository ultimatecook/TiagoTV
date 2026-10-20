import { shortDate } from '../core/format';

/**
 * The account `player_api.php` describes (`user_info`): whether it may
 * play, until when, and how many streams it may open at once.
 */
export type AccountStatus = 'active' | 'expired' | 'disabled' | 'denied';

export interface AccountInfo {
    readonly status: AccountStatus;
    readonly expiresAt: Date | null;
    readonly maxConnections: number | null;
    readonly activeConnections: number | null;
    readonly trial: boolean;
}

interface RawUserInfo {
    readonly auth?: unknown;
    readonly status?: unknown;
    readonly exp_date?: unknown;
    readonly max_connections?: unknown;
    readonly active_cons?: unknown;
    readonly is_trial?: unknown;
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function isTruthyFlag(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
}

export function parseAccount(raw: unknown, now = new Date()): AccountInfo {
    const info =
        raw && typeof raw === 'object'
            ? ((raw as { user_info?: RawUserInfo }).user_info ?? null)
            : null;
    if (!info || typeof info !== 'object') {
        return {
            status: 'denied',
            expiresAt: null,
            maxConnections: null,
            activeConnections: null,
            trial: false,
        };
    }
    const expiry = toNumber(info.exp_date);
    const expiresAt = expiry && expiry > 0 ? new Date(expiry * 1000) : null;
    const status = String(info.status ?? '').toLowerCase();
    const auth = info.auth;
    let resolved: AccountStatus = 'active';
    if (auth === 0 || auth === '0' || auth === false) {
        resolved = 'denied';
    } else if (status === 'expired' || (expiresAt && expiresAt < now)) {
        resolved = 'expired';
    } else if (status && status !== 'active') {
        resolved = 'disabled';
    }
    return {
        status: resolved,
        expiresAt,
        maxConnections: toNumber(info.max_connections),
        activeConnections: toNumber(info.active_cons),
        trial: isTruthyFlag(info.is_trial),
    };
}

/** Every allowed stream is open elsewhere: playing now would be refused. */
export function isAccountBusy(info: AccountInfo): boolean {
    return (
        info.maxConnections !== null &&
        info.maxConnections > 0 &&
        info.activeConnections !== null &&
        info.activeConnections >= info.maxConnections
    );
}

/** Why the account cannot play, in Spanish; null when it can. */
export function accountProblem(info: AccountInfo): string | null {
    switch (info.status) {
        case 'denied':
            return 'Usuario o contraseña incorrectos.';
        case 'expired':
            return info.expiresAt
                ? `La cuenta venció el ${shortDate(info.expiresAt)}.`
                : 'La cuenta está vencida.';
        case 'disabled':
            return 'La cuenta está desactivada en el proveedor.';
        default:
            return null;
    }
}

export const STATUS_LABEL: Readonly<Record<AccountStatus, string>> = {
    active: 'Activa',
    expired: 'Vencida',
    disabled: 'Desactivada',
    denied: 'Rechazada',
};

export function connectionsLabel(info: AccountInfo): string {
    const max = info.maxConnections;
    if (max === null) {
        return 'Conexiones: sin dato';
    }
    const word = max === 1 ? 'conexión' : 'conexiones';
    return info.activeConnections === null
        ? `${max} ${word}`
        : `${info.activeConnections} de ${max} ${word} en uso`;
}

export function expiryLabel(info: AccountInfo): string {
    return info.expiresAt
        ? `Vence el ${shortDate(info.expiresAt)}`
        : 'Sin vencimiento';
}

/** "Activa · vence el 12/03/2027 · 0 de 1 conexión en uso". */
export function accountSummary(info: AccountInfo): string {
    const parts = [
        STATUS_LABEL[info.status],
        expiryLabel(info).toLowerCase(),
        connectionsLabel(info),
    ];
    if (info.trial) {
        parts.push('prueba');
    }
    return parts.join(' · ');
}
