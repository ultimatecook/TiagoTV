/* Runs before the app in the Android smoke run (smoke-android.mjs): stands
   in for the Android app's bridge, window.TiagoTVNative (apps/androidtv,
   NativeBridge.kt), and answers as PlayerHost does, through
   window.__tiagotvNativeEvent: tracks, ready and playing a moment after
   play(), then timeupdate four times a second; paused, seeked, and an
   error for an HLS candidate (as desktop Chromium's player refuses HLS in
   the LG smoke) or for every stream once fail(status) was called.
   Episodes get two audio tracks (English, Spanish) and two text tracks.
   window.__fakeNative records the calls (never a URL) for the checks. */
(() => {
    const calls = [];
    const state = {
        attached: false,
        time: 0,
        duration: null,
        paused: false,
        timer: null,
        failStatus: 0,
        stalled: false,
        tracks: { audio: [], text: [] },
    };

    const emit = (event) => {
        if (typeof window.__tiagotvNativeEvent === 'function') {
            window.__tiagotvNativeEvent(event);
        }
    };
    const record = (name, args = []) =>
        calls.push([name].concat(args.map(String)).join(':'));
    const clearTimer = () => {
        if (state.timer !== null) {
            clearTimeout(state.timer);
            clearInterval(state.timer);
            state.timer = null;
        }
    };
    const tracksFor = (url) => {
        if (/\/series\//.test(url)) {
            return {
                audio: [
                    {
                        id: 'a:0:0',
                        language: 'en',
                        label: 'English',
                        selected: true,
                    },
                    {
                        id: 'a:0:1',
                        language: 'es',
                        label: 'Español',
                        selected: false,
                    },
                ],
                text: [
                    {
                        id: 't:1:0',
                        language: 'en',
                        label: 'English',
                        selected: false,
                    },
                    {
                        id: 't:1:1',
                        language: 'es',
                        label: 'Español',
                        selected: false,
                    },
                ],
            };
        }
        return {
            audio: [{ id: 'a:0:0', language: '', label: '', selected: true }],
            text: [],
        };
    };
    const sendTracks = () =>
        emit({
            type: 'tracks',
            audio: state.tracks.audio,
            text: state.tracks.text,
        });
    const select = (list, id) =>
        list.forEach((track) => (track.selected = track.id === id));

    window.TiagoTVNative = {
        play(url, kind, startAt) {
            record('play', [kind, startAt]);
            clearTimer();
            state.attached = true;
            state.time = startAt || 0;
            state.paused = false;
            state.duration = kind === 'file' ? 60 : null;
            state.tracks = tracksFor(url);
            const failWith = state.failStatus || (kind === 'hls' ? -1 : 0);
            state.timer = setTimeout(() => {
                if (!state.attached) {
                    return;
                }
                if (failWith) {
                    emit({
                        type: 'error',
                        status: failWith > 0 ? failWith : null,
                    });
                    return;
                }
                sendTracks();
                emit({ type: 'ready', duration: state.duration });
                emit({ type: 'playing' });
                state.timer = setInterval(() => {
                    if (!state.paused && !state.stalled) {
                        state.time += 0.25;
                    }
                    emit({
                        type: 'timeupdate',
                        currentTime: state.time,
                        duration: state.duration,
                    });
                }, 250);
            }, 120);
        },
        pause() {
            record('pause');
            state.paused = true;
            emit({ type: 'paused' });
        },
        resume() {
            record('resume');
            state.paused = false;
            emit({ type: 'playing' });
        },
        seek(seconds) {
            record('seek', [seconds]);
            state.time = seconds;
            emit({
                type: 'seeked',
                currentTime: seconds,
                duration: state.duration,
            });
        },
        stop() {
            record('stop');
            state.attached = false;
            clearTimer();
        },
        setVolume(level) {
            record('setVolume', [level]);
        },
        setProfile(profile) {
            record('setProfile', [profile]);
        },
        selectAudio(id) {
            record('selectAudio', [id]);
            select(state.tracks.audio, id);
            sendTracks();
        },
        selectSubtitle(id) {
            record('selectSubtitle', [id]);
            select(state.tracks.text, id);
            sendTracks();
        },
        setSubtitlesRaised(raised) {
            record('setSubtitlesRaised', [raised]);
        },
        exit() {
            record('exit');
        },
    };

    window.__fakeNative = {
        calls,
        reset: () => calls.splice(0, calls.length),
        /** Every stream from now on is refused with `status` (0 to stop). */
        fail: (status) => (state.failStatus = status),
        /** The picture freezes: time stops moving (the stall watch must notice). */
        stall: (on) => (state.stalled = on),
        state: () => ({
            attached: state.attached,
            time: state.time,
            paused: state.paused,
        }),
    };
})();
