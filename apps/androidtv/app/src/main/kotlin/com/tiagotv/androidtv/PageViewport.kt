package com.tiagotv.androidtv

import android.webkit.WebSettings

/**
 * The WebView settings the page's layout rests on. The page draws a fixed
 * 1920×1080 canvas (its viewport meta, width=1920) and scales it to the
 * screen itself (apps/webos-lite, src/core/fit.ts), so the WebView must
 * lay it out at that width whatever the screen (a 1080p set, the
 * projector, a 4K panel), keep the system's font size out of it (a
 * large-text setting would reflow every label) and never zoom it.
 */
object PageViewport {
    /** The page's own sizes, whatever the system's font-size setting. */
    const val TEXT_ZOOM = 100

    /** The settings the page depends on, so a test can record them without a WebView. */
    interface Settings {
        var useWideViewPort: Boolean
        var loadWithOverviewMode: Boolean
        var textZoom: Int
        var builtInZoomControls: Boolean
        var displayZoomControls: Boolean
        fun setSupportZoom(support: Boolean)
    }

    fun apply(settings: Settings) {
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.textZoom = TEXT_ZOOM
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
    }

    fun apply(webSettings: WebSettings) = apply(Adapter(webSettings))

    private class Adapter(private val target: WebSettings) : Settings {
        override var useWideViewPort: Boolean
            get() = target.useWideViewPort
            set(value) {
                target.useWideViewPort = value
            }
        override var loadWithOverviewMode: Boolean
            get() = target.loadWithOverviewMode
            set(value) {
                target.loadWithOverviewMode = value
            }
        override var textZoom: Int
            get() = target.textZoom
            set(value) {
                target.textZoom = value
            }
        override var builtInZoomControls: Boolean
            get() = target.builtInZoomControls
            set(value) {
                target.builtInZoomControls = value
            }
        override var displayZoomControls: Boolean
            get() = target.displayZoomControls
            set(value) {
                target.displayZoomControls = value
            }

        override fun setSupportZoom(support: Boolean) = target.setSupportZoom(support)
    }
}
