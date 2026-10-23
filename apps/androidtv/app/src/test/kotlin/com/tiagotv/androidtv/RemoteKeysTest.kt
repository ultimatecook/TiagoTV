package com.tiagotv.androidtv

import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteKeysTest {
    @Test
    fun `back and escape become the LG remote's Back`() {
        assertEquals(461, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_BACK))
        assertEquals(461, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_ESCAPE))
        assertTrue(RemoteKeys.isBack(KeyEvent.KEYCODE_BACK))
        assertFalse(RemoteKeys.isBack(KeyEvent.KEYCODE_CHANNEL_UP))
    }

    @Test
    fun `channel and media keys map to the page's codes`() {
        assertEquals(33, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_CHANNEL_UP))
        assertEquals(34, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_CHANNEL_DOWN))
        assertEquals(33, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_MEDIA_NEXT))
        assertEquals(179, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
        assertEquals(415, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_MEDIA_PLAY))
        assertEquals(19, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_MEDIA_PAUSE))
        assertEquals(413, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_MEDIA_STOP))
        assertEquals(417, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD))
        assertEquals(412, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_MEDIA_REWIND))
        assertEquals(457, RemoteKeys.liteKeyCode(KeyEvent.KEYCODE_INFO))
    }

    @Test
    fun `the keys the WebView delivers itself are left alone`() {
        for (code in listOf(
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_0, KeyEvent.KEYCODE_9,
            KeyEvent.KEYCODE_PAGE_UP, KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_HOME,
        )) {
            assertNull("key $code", RemoteKeys.liteKeyCode(code))
        }
    }

    @Test
    fun `the script asks the page and falls back to false`() {
        assertEquals("window.__tiagotvNativeKey?window.__tiagotvNativeKey(461):false", RemoteKeys.script(461))
    }
}
