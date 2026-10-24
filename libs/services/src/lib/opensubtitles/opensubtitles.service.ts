import { inject, Injectable, signal } from '@angular/core';
import {
    hasOpenSubtitlesKey,
    normalizeOpenSubtitlesSettings,
    type OpenSubtitlesSettings,
} from '@iptvnator/shared/interfaces';
import { SettingsStore } from '../settings-store.service';
import { OpenSubtitlesApi, type OpenSubtitlesQuota } from './opensubtitles-api';
import {
    isOpenSubtitlesError,
    OpenSubtitlesError,
    type OpenSubtitlesErrorKind,
} from './opensubtitles-error';
import {
    buildSearchQueries,
    pickBestSubtitle,
    searchLanguages,
    subtitleCacheKey,
    type SubtitleLookup,
} from './opensubtitles-match';
import { SubtitleCache } from './subtitle-cache';
import { hasSubtitleCues, srtToVtt } from './subtitle-convert';

/** A subtitle ready to attach: WebVTT text in one of the asked languages. */
export interface FoundSubtitle {
    readonly name: string;
    /** The language asked for that found it (an OpenSubtitles code). */
    readonly language: string;
    readonly content: string;
    /** True when it came from the cache and cost no download. */
    readonly fromCache: boolean;
}

/**
 * Whether the app can look subtitles up: `unavailable` without the desktop
 * bridge (browser build, older installer), `no-key` before an API key is
 * typed in Settings.
 */
export type OpenSubtitlesAvailability = 'ready' | 'unavailable' | 'no-key';

/**
 * Finds a subtitle for a movie or episode on OpenSubtitles: the cache
 * first, then a search by TMDB id, IMDB id or name (see
 * `buildSearchQueries`) in the user's language, then the second language;
 * the best match is downloaded (one of the day's downloads), converted to
 * WebVTT and cached.
 */
@Injectable({ providedIn: 'root' })
export class OpenSubtitlesService {
    private readonly api = inject(OpenSubtitlesApi);
    private readonly settings = inject(SettingsStore);
    private readonly cache = inject(SubtitleCache);

    /** Downloads left today, as the last answer said; null until one did. */
    readonly remainingDownloads = signal<number | null>(null);
    /** The last failure's kind; null after a success. */
    readonly lastError = signal<OpenSubtitlesErrorKind | null>(null);

    /** False in the browser build and in installers without the bridge. */
    hasBridge(): boolean {
        return this.api.available;
    }

    account(): OpenSubtitlesSettings {
        return normalizeOpenSubtitlesSettings(this.settings.openSubtitles?.());
    }

    availability(
        account: OpenSubtitlesSettings = this.account()
    ): OpenSubtitlesAvailability {
        if (!this.api.available) {
            return 'unavailable';
        }
        return hasOpenSubtitlesKey(account) ? 'ready' : 'no-key';
    }

    /** The languages a search asks for, the user's first. */
    languages(account: OpenSubtitlesSettings = this.account()): string[] {
        return [account.language, account.secondLanguage].filter(
            (code): code is string => !!code
        );
    }

    /** A cached subtitle of the title in one of the languages, if any. */
    async cached(
        lookup: SubtitleLookup,
        languages: readonly string[] = this.languages()
    ): Promise<FoundSubtitle | null> {
        for (const language of languages) {
            const entry = await this.cache.get(
                subtitleCacheKey(lookup, language)
            );
            if (entry) {
                return {
                    name: entry.name,
                    language,
                    content: entry.content,
                    fromCache: true,
                };
            }
        }
        return null;
    }

    /** The title's subtitle; rejects with an `OpenSubtitlesError`. */
    async find(
        lookup: SubtitleLookup,
        account: OpenSubtitlesSettings = this.account()
    ): Promise<FoundSubtitle> {
        try {
            const found =
                (await this.cached(lookup, this.languages(account))) ??
                (await this.download(lookup, account));
            this.lastError.set(null);
            return found;
        } catch (error) {
            const failure = isOpenSubtitlesError(error)
                ? error
                : new OpenSubtitlesError('network');
            this.lastError.set(failure.kind);
            throw failure;
        }
    }

    /** Signs in with the account as typed; its downloads left today. */
    async testAccount(
        account: OpenSubtitlesSettings
    ): Promise<OpenSubtitlesQuota> {
        const normalized = normalizeOpenSubtitlesSettings(account);
        if (!normalized.username || !normalized.password) {
            // Without a login the key alone is checked by a search.
            await this.api.search(normalized, {
                languages: 'es',
                query: 'test',
            });
            return { remaining: null, allowed: null };
        }
        const { quota } = await this.api.login(normalized, true);
        this.remainingDownloads.set(quota.remaining);
        return quota;
    }

    private async download(
        lookup: SubtitleLookup,
        account: OpenSubtitlesSettings
    ): Promise<FoundSubtitle> {
        if (this.availability(account) !== 'ready') {
            throw new OpenSubtitlesError(
                this.api.available ? 'no-key' : 'unavailable'
            );
        }
        for (const language of this.languages(account)) {
            const codes = searchLanguages(language);
            for (const query of buildSearchQueries(lookup, codes)) {
                const chosen = pickBestSubtitle(
                    await this.api.search(account, query),
                    codes,
                    lookup
                );
                if (!chosen) {
                    continue;
                }
                const file = await this.api.download(account, chosen.fileId);
                this.remainingDownloads.set(file.remaining);
                const content = srtToVtt(file.text);
                if (!hasSubtitleCues(content)) {
                    throw new OpenSubtitlesError('network');
                }
                const name = chosen.release || lookup.title;
                await this.cache.put({
                    key: subtitleCacheKey(lookup, language),
                    name,
                    language,
                    content,
                    at: Date.now(),
                });
                return { name, language, content, fromCache: false };
            }
        }
        throw new OpenSubtitlesError('not-found');
    }
}
