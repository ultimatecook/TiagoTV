package com.tiagotv.androidtv

import androidx.media3.common.C
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException

class PlayerHostTest {
    @Test
    fun `a refused stream that has not started is not retried`() {
        assertEquals(C.TIME_UNSET, PlayerHost.retryDelayMs(started = false, status = 458, default = 1000L))
        assertEquals(C.TIME_UNSET, PlayerHost.retryDelayMs(started = false, status = 404, default = 1000L))
    }

    @Test
    fun `network errors and errors after the start keep the player's own retries`() {
        assertEquals(1000L, PlayerHost.retryDelayMs(started = false, status = null, default = 1000L))
        assertEquals(2000L, PlayerHost.retryDelayMs(started = true, status = 458, default = 2000L))
    }

    @Test
    fun `an error chain without an HTTP status has none`() {
        assertNull(PlayerHost.httpStatusOf(null))
        assertNull(PlayerHost.httpStatusOf(IOException("read", RuntimeException("socket"))))
        var deep: Throwable = IOException("leaf")
        repeat(12) { deep = IOException("wrap $it", deep) }
        assertNull(PlayerHost.httpStatusOf(deep))
    }
}
