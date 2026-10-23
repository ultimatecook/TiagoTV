package com.tiagotv.androidtv

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * `window.TiagoTVNative`: what the page calls
 * (apps/webos-lite/src/player/native-bridge.ts). The WebView calls these
 * on its own thread; each one is posted to the main thread, in order, so
 * a `stop` always lands before the `play` that follows it. Answers come
 * back as events (PlayerHost → BridgeEvents → evaluateJavascript).
 */
class NativeBridge(private val host: PlayerHost, private val onExit: () -> Unit) {
    private val main = Handler(Looper.getMainLooper())

    private fun onMain(block: () -> Unit) {
        main.post(block)
    }

    @JavascriptInterface
    fun play(url: String, kind: String, startAt: Double) = onMain { host.play(url, kind, startAt) }

    @JavascriptInterface
    fun pause() = onMain { host.pause() }

    @JavascriptInterface
    fun resume() = onMain { host.resume() }

    @JavascriptInterface
    fun seek(seconds: Double) = onMain { host.seek(seconds) }

    @JavascriptInterface
    fun stop() = onMain { host.stop() }

    @JavascriptInterface
    fun setVolume(level: Double) = onMain { host.setVolume(level) }

    @JavascriptInterface
    fun setProfile(profile: String) = onMain { host.setProfile(profile) }

    @JavascriptInterface
    fun selectAudio(id: String) = onMain { host.selectAudio(id) }

    @JavascriptInterface
    fun selectSubtitle(id: String) = onMain { host.selectSubtitle(id) }

    @JavascriptInterface
    fun setSubtitlesRaised(raised: Boolean) = onMain { host.setSubtitlesRaised(raised) }

    @JavascriptInterface
    fun exit() = onMain { onExit() }
}
