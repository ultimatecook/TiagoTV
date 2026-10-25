package com.tiagotv.androidtv

import org.junit.Assert.assertEquals
import org.junit.Test

class BridgeEventsTest {
    @Test
    fun `simple events carry only their type`() {
        assertEquals("{\"type\":\"playing\"}", BridgeEvents.simple("playing"))
    }

    @Test
    fun `ready and time events say null for an unknown duration`() {
        assertEquals("{\"type\":\"ready\",\"duration\":null}", BridgeEvents.ready(null))
        assertEquals("{\"type\":\"ready\",\"duration\":90.5}", BridgeEvents.ready(90.5))
        assertEquals(
            "{\"type\":\"timeupdate\",\"currentTime\":12.25,\"duration\":null}",
            BridgeEvents.time("timeupdate", 12.25, Double.NaN),
        )
    }

    @Test
    fun `an error keeps the HTTP status and the code, never a URL`() {
        assertEquals(
            "{\"type\":\"error\",\"status\":458,\"code\":\"ERROR_CODE_IO_BAD_HTTP_STATUS\"}",
            BridgeEvents.error(458, "ERROR_CODE_IO_BAD_HTTP_STATUS"),
        )
        assertEquals("{\"type\":\"error\",\"status\":null,\"code\":\"x\"}", BridgeEvents.error(null, "x"))
    }

    @Test
    fun `tracks list both kinds with their flags`() {
        val json = BridgeEvents.tracks(
            listOf(TrackInfo("a:0:0", "en", "English", selected = true, forced = false)),
            listOf(TrackInfo("t:1:0", "es", null, selected = false, forced = true)),
        )
        assertEquals(
            "{\"type\":\"tracks\",\"audio\":[{\"id\":\"a:0:0\",\"language\":\"en\",\"label\":\"English\",\"selected\":true,\"forced\":false}]," +
                "\"text\":[{\"id\":\"t:1:0\",\"language\":\"es\",\"label\":null,\"selected\":false,\"forced\":true}]}",
            json,
        )
    }

    @Test
    fun `strings are escaped as JavaScript literals`() {
        assertEquals("\"a\\\"b\\\\c\\nd\\u2028e\"", BridgeEvents.quote("a\"b\\c\nd e"))
    }

    @Test
    fun `the call delivers the event only when the page listens`() {
        assertEquals(
            "window.__tiagotvNativeEvent&&window.__tiagotvNativeEvent({\"type\":\"ended\"});",
            BridgeEvents.call(BridgeEvents.simple("ended")),
        )
    }
}
