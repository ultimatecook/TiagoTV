import { store, type JsonStore } from '../core/storage';

/**
 * "Últimos canales vistos" (the Home's last row): the live channels that
 * played on this TV, latest first, kept in localStorage
 * (`tiagotv.lite.recientes`).
 */
export interface RecentChannel {
    readonly id: number;
    readonly title: string;
    readonly logo: string | null;
    /** "España", the programme… what the card says under the name. */
    readonly subtitle: string | null;
    readonly country: string | null;
    readonly at: number;
}

const KEY = 'tiagotv.lite.recientes';
const MAX = 12;

export class RecentChannels {
    constructor(private readonly from: JsonStore = store) {}

    all(): RecentChannel[] {
        const value = this.from.read<RecentChannel[]>(KEY, []);
        return Array.isArray(value) ? value.filter((entry) => entry && typeof entry.id === 'number') : [];
    }

    add(channel: Omit<RecentChannel, 'at'>, now = Date.now()): void {
        const entries = this.all().filter((entry) => entry.id !== channel.id);
        entries.unshift({ ...channel, at: now });
        this.from.write(KEY, entries.slice(0, MAX));
    }
}

export const recentChannels = new RecentChannels();
