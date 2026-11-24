package de.balumail.app

import android.app.Activity
import android.app.Application
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.io.File

/**
 * Selbst-Update der Handy-App über die Paketinstallation von Android.
 * Beim ersten Mal fragt Android einmal nach; danach ist Balu-Mail selbst „Installationsquelle“
 * und Android 12+ spielt weitere Updates ohne Rückfrage ein.
 */
object Updater {
    @Volatile private var ctx: Context? = null
    @Volatile private var visible = 0

    fun init(c: Context) {
        if (ctx != null) return
        val app = c.applicationContext as Application
        ctx = app
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStarted(a: Activity) { visible++ }
            override fun onActivityStopped(a: Activity) { if (visible > 0) visible-- }
            override fun onActivityCreated(a: Activity, b: Bundle?) {}
            override fun onActivityResumed(a: Activity) {}
            override fun onActivityPaused(a: Activity) {}
            override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
            override fun onActivityDestroyed(a: Activity) {}
        })
    }

    @JvmStatic fun appVersion(): String {
        val c = ctx ?: return ""
        return try { c.packageManager.getPackageInfo(c.packageName, 0).versionName ?: "" } catch (_: Exception) { "" }
    }

    /** App gerade auf dem Bildschirm? Dann nicht neu installieren. */
    @JvmStatic fun isForeground(): Boolean = visible > 0

    /** WLAN o. ä. ohne Datenvolumen-Begrenzung? */
    @JvmStatic fun unmetered(): Boolean {
        val c = ctx ?: return false
        val cm = c.getSystemService(ConnectivityManager::class.java) ?: return false
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }

    @JvmStatic fun install(path: String): Boolean {
        val c = ctx ?: return false
        return try {
            val f = File(path)
            val pi = c.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                setAppPackageName(c.packageName)
                if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
                if (Build.VERSION.SDK_INT >= 34) setRequestUpdateOwnership(true)
            }
            val id = pi.createSession(params)
            pi.openSession(id).use { s ->
                f.inputStream().use { inp ->
                    s.openWrite("balu-mail.apk", 0, f.length()).use { out -> inp.copyTo(out, 1 shl 20); s.fsync(out) }
                }
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val pending = PendingIntent.getBroadcast(c, id, Intent(c, InstallReceiver::class.java), flags)
                s.commit(pending.intentSender)
            }
            true
        } catch (e: Exception) {
            false
        }
    }
}

/** Ergebnis der Installation: Muss Android nachfragen, gibt es eine Benachrichtigung zum Antippen. */
class InstallReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999) != PackageInstaller.STATUS_PENDING_USER_ACTION) return
        @Suppress("DEPRECATION")
        val confirm = (if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                       else i.getParcelableExtra(Intent.EXTRA_INTENT)) ?: return
        confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        Notifier.init(c)
        val n = NotificationCompat.Builder(c, Notifier.CH_MAIL)
            .setSmallIcon(R.drawable.ic_stat_mail)
            .setColor(0xFF1A6FE6.toInt())
            .setContentTitle("Balu-Mail-Update bereit")
            .setContentText("Einmal antippen und „Aktualisieren“ wählen – künftige Updates laufen dann automatisch.")
            .setStyle(NotificationCompat.BigTextStyle().bigText("Einmal antippen und „Aktualisieren“ wählen – künftige Updates laufen dann automatisch."))
            .setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(c, 4712, confirm, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            .build()
        try { NotificationManagerCompat.from(c).notify(4712, n) } catch (_: SecurityException) {}
    }
}
