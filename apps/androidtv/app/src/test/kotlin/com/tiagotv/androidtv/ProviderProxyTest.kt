package com.tiagotv.androidtv

import org.junit.Assert.assertEquals
import org.junit.Test

class ProviderProxyTest {
    @Test
    fun `content types split into mime and charset`() {
        assertEquals("application/json" to "utf-8", ProviderProxy.splitContentType("application/json; charset=UTF-8").let { it.first to it.second?.lowercase() })
        assertEquals("text/plain" to "windows-1252", ProviderProxy.splitContentType("text/plain;charset=\"windows-1252\""))
        assertEquals("application/json" to "utf-8", ProviderProxy.splitContentType("application/json"))
        assertEquals("image/png" to null, ProviderProxy.splitContentType("image/png"))
        assertEquals("application/octet-stream" to null, ProviderProxy.splitContentType(null))
    }
}
