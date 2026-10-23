package com.tiagotv.androidtv

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.LoadControl
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView

/**
 * The native player behind the page: one ExoPlayer, one stream at a time.
 * `play` stops and clears whatever played before it prepares the next
 * stream (the provider's account allows a single connection), and
 * `stop` frees it. What happens goes to the page as events
 * (BridgeEvents); the page's "Fluidez" picks the buffers (setProfile:
 * `stable` waits for more before it starts and keeps more ahead).
 *
 * Embedded subtitles are drawn by the PlayerView's SubtitleView (styled in
 * MainActivity) once the page selects a track; audio tracks are switched
 * with track-selection overrides. The track ids are "a:<group>:<track>"
 * and "t:<group>:<track>" over the player's current tracks.
 */
@OptIn(UnstableApi::class)
class PlayerHost(
    private val context: Context,
    private val playerView: PlayerView,
    private val userAgent: String,
    private val emit: (String) -> Unit,
    private val keepScreenOn: (Boolean) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private var player: ExoPlayer? = null
    private var profile = PROFILE_STABLE
    private var readySent = false
    private var ticking = false

    private val ticker = object : Runnable {
        override fun run() {
            if (!ticking) {
                return
            }
            player?.let { emit(BridgeEvents.time("timeupdate", it.currentPosition / 1000.0, durationOf(it))) }
            handler.postDelayed(this, TICK_MS)
        }
    }

    private val listener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_READY -> if (!readySent) {
                    readySent = true
                    player?.let { emit(BridgeEvents.ready(durationOf(it))) }
                }
                Player.STATE_BUFFERING -> emit(BridgeEvents.simple("waiting"))
                Player.STATE_ENDED -> {
                    keepScreenOn(false)
                    emit(BridgeEvents.simple("ended"))
                }
                else -> Unit
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) {
                keepScreenOn(true)
                emit(BridgeEvents.simple("playing"))
            }
        }

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
            if (!playWhenReady) {
                keepScreenOn(false)
                emit(BridgeEvents.simple("paused"))
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            keepScreenOn(false)
            emit(BridgeEvents.error(httpStatusOf(error), error.errorCodeName))
        }

        override fun onTracksChanged(tracks: Tracks) {
            emit(tracksEvent(tracks))
        }

        override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                player?.let { emit(BridgeEvents.time("seeked", it.currentPosition / 1000.0, durationOf(it))) }
            }
        }
    }

    /** Opens `url` after closing whatever played: HLS, MPEG-TS or a file. */
    fun play(url: String, kind: String, startAtSeconds: Double) {
        stop()
        val player = ensurePlayer()
        readySent = false
        val mime = when (kind) {
            "hls" -> MimeTypes.APPLICATION_M3U8
            "ts" -> MimeTypes.VIDEO_MP2T
            else -> null
        }
        val item = MediaItem.Builder().setUri(url).apply { if (mime != null) setMimeType(mime) }.build()
        if (startAtSeconds > 0) {
            player.setMediaItem(item, (startAtSeconds * 1000).toLong())
        } else {
            player.setMediaItem(item)
        }
        player.prepare()
        player.playWhenReady = true
        ticking = true
        handler.removeCallbacks(ticker)
        handler.postDelayed(ticker, TICK_MS)
    }

    /** Closes the stream and its connection; nothing is reported. */
    fun stop() {
        ticking = false
        handler.removeCallbacks(ticker)
        player?.let {
            it.stop()
            it.clearMediaItems()
        }
        keepScreenOn(false)
    }

    fun pause() {
        player?.playWhenReady = false
    }

    fun resume() {
        player?.playWhenReady = true
    }

    fun seek(seconds: Double) {
        player?.seekTo((seconds.coerceAtLeast(0.0) * 1000).toLong())
    }

    fun setVolume(level: Double) {
        player?.volume = level.toFloat().coerceIn(0f, 1f)
    }

    /** The buffers are fixed when the player is built: a change rebuilds it (while stopped). */
    fun setProfile(name: String) {
        val next = if (name == PROFILE_NORMAL) PROFILE_NORMAL else PROFILE_STABLE
        if (next != profile) {
            profile = next
            releasePlayer()
        }
    }

    fun selectAudio(id: String) {
        val player = player ?: return
        val target = find(player, id, C.TRACK_TYPE_AUDIO) ?: return
        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
            .setOverrideForType(TrackSelectionOverride(target.first.mediaTrackGroup, target.second))
            .build()
    }

    /** A text track id, or "" for none: the page decides, never the player. */
    fun selectSubtitle(id: String) {
        val player = player ?: return
        val builder = player.trackSelectionParameters.buildUpon().clearOverridesOfType(C.TRACK_TYPE_TEXT)
        if (id.isEmpty()) {
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        } else {
            val target = find(player, id, C.TRACK_TYPE_TEXT) ?: return
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                .setOverrideForType(TrackSelectionOverride(target.first.mediaTrackGroup, target.second))
        }
        player.trackSelectionParameters = builder.build()
    }

    /** The subtitles move up while the page's OSD shows its progress bar. */
    fun setSubtitlesRaised(raised: Boolean) {
        playerView.subtitleView?.setBottomPaddingFraction(if (raised) RAISED_PADDING else BOTTOM_PADDING)
    }

    fun release() {
        stop()
        releasePlayer()
    }

    private fun ensurePlayer(): ExoPlayer {
        player?.let { return it }
        val built = ExoPlayer.Builder(context)
            .setLoadControl(loadControlFor(profile))
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSourceFactory()))
            .setAudioAttributes(AudioAttributes.DEFAULT, true)
            .build()
        built.addListener(listener)
        // No subtitles until the page picks a track.
        built.trackSelectionParameters = built.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .build()
        playerView.player = built
        player = built
        return built
    }

    private fun releasePlayer() {
        ticking = false
        handler.removeCallbacks(ticker)
        playerView.player = null
        player?.removeListener(listener)
        player?.release()
        player = null
    }

    private fun loadControlFor(profile: String): LoadControl {
        val builder = DefaultLoadControl.Builder()
        if (profile == PROFILE_STABLE) {
            // Starts once 5 s are in, keeps up to 3 minutes ahead of a file.
            builder.setBufferDurationsMs(60_000, 180_000, 5_000, 10_000)
        }
        return builder.build()
    }

    private fun dataSourceFactory(): DataSource.Factory {
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)
            .setAllowCrossProtocolRedirects(true)
        return DefaultDataSource.Factory(context, http)
    }

    private fun durationOf(player: Player): Double? {
        val duration = player.duration
        return if (duration == C.TIME_UNSET || player.isCurrentMediaItemLive) null else duration / 1000.0
    }

    /** "a:<group>:<track>" over the current tracks, of `type`. */
    private fun find(player: Player, id: String, type: Int): Pair<Tracks.Group, Int>? {
        val parts = id.split(':')
        if (parts.size != 3) {
            return null
        }
        val groupIndex = parts[1].toIntOrNull() ?: return null
        val trackIndex = parts[2].toIntOrNull() ?: return null
        val group = player.currentTracks.groups.getOrNull(groupIndex) ?: return null
        return if (group.type == type && trackIndex in 0 until group.length) group to trackIndex else null
    }

    private fun tracksEvent(tracks: Tracks): String {
        val audio = ArrayList<TrackInfo>()
        val text = ArrayList<TrackInfo>()
        tracks.groups.forEachIndexed { groupIndex, group ->
            val (prefix, into) = when (group.type) {
                C.TRACK_TYPE_AUDIO -> "a" to audio
                C.TRACK_TYPE_TEXT -> "t" to text
                else -> return@forEachIndexed
            }
            for (trackIndex in 0 until group.length) {
                if (!group.isTrackSupported(trackIndex)) {
                    continue
                }
                val format = group.getTrackFormat(trackIndex)
                into.add(
                    TrackInfo(
                        id = "$prefix:$groupIndex:$trackIndex",
                        language = format.language,
                        label = format.label,
                        selected = group.isTrackSelected(trackIndex),
                        forced = (format.selectionFlags and C.SELECTION_FLAG_FORCED) != 0,
                    ),
                )
            }
        }
        return BridgeEvents.tracks(audio, text)
    }

    companion object {
        const val PROFILE_STABLE = "stable"
        const val PROFILE_NORMAL = "normal"
        private const val TICK_MS = 500L
        private const val BOTTOM_PADDING = 0.08f
        private const val RAISED_PADDING = 0.22f

        /** The HTTP status a refused stream failed with, from the error's causes. */
        fun httpStatusOf(error: Throwable?): Int? {
            var cause = error
            var depth = 0
            while (cause != null && depth < 8) {
                if (cause is HttpDataSource.InvalidResponseCodeException) {
                    return cause.responseCode
                }
                cause = cause.cause
                depth++
            }
            return null
        }
    }
}
