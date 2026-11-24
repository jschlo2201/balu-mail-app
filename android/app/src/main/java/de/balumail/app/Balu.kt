package de.balumail.app

import android.content.Context
import android.util.Base64
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import java.security.SecureRandom
import kotlin.concurrent.thread

/** Gemeinsamer Start des eingebauten Balu-Mail-Servers (für Fenster und Hintergrunddienst). */
object Balu {
    const val PORT = 8025
    @Volatile var serverStarted = false
    @Volatile var lastError: String? = null
    val TOKEN: String by lazy {
        val b = ByteArray(24); SecureRandom().nextBytes(b)
        Base64.encodeToString(b, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    @Synchronized
    fun ensureServer(ctx: Context) {
        if (serverStarted) return
        serverStarted = true
        val app = ctx.applicationContext
        Notifier.init(app)
        AppIcon.init(app)
        Updater.init(app)
        if (!Python.isStarted()) Python.start(AndroidPlatform(app))
        val dataDir = app.filesDir.absolutePath
        thread(name = "balu-server", isDaemon = true) {
            try {
                lastError = null
                // Play-Store-Version: keine eigenen Updates (Google-Play-Richtlinie)
                if (BuildConfig.FLAVOR == "play")
                    Python.getInstance().getModule("os").get("environ")?.callAttr("__setitem__", "BALU_PLAY", "1")
                Python.getInstance().getModule("balu.balumail").callAttr("run_android", dataDir, TOKEN, PORT)
            } catch (e: Throwable) {
                lastError = e.message
            } finally {
                serverStarted = false
            }
        }
    }
}
