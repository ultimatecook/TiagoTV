package com.tiagotv.androidtv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PageViewportTest {
    /** Records what the page's viewport asks of a WebView, starting from a WebView's own defaults. */
    private class Recorded : PageViewport.Settings {
        override var useWideViewPort = false
        override var loadWithOverviewMode = false
        override var textZoom = 130
        override var builtInZoomControls = true
        override var displayZoomControls = true
        var zoomSupported = true

        override fun setSupportZoom(support: Boolean) {
            zoomSupported = support
        }
    }

    private fun applied(): Recorded = Recorded().also { PageViewport.apply(it) }

    @Test
    fun `the page lays out at its 1920px canvas and is scaled to the screen`() {
        val settings = applied()
        assertTrue(settings.useWideViewPort)
        assertTrue(settings.loadWithOverviewMode)
    }

    @Test
    fun `the system's font size cannot reflow the page`() {
        assertEquals(100, PageViewport.TEXT_ZOOM)
        assertEquals(100, applied().textZoom)
    }

    @Test
    fun `nothing zooms the canvas`() {
        val settings = applied()
        assertFalse(settings.zoomSupported)
        assertFalse(settings.builtInZoomControls)
        assertFalse(settings.displayZoomControls)
    }
}
