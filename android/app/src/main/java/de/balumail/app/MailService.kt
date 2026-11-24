package de.balumail.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/** Hält Balu-Mail im Hintergrund am Laufen, damit neue E-Mails gemeldet werden können. */
class MailService : Service() {
    companion object {
        fun start(c: Context) {
            try { ContextCompat.startForegroundService(c, Intent(c, MailService::class.java)) } catch (_: Exception) {}
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Notifier.init(this)
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        try {
            ServiceCompat.startForeground(this, 4711, Notifier.serviceNotification(this), type)
        } catch (_: Exception) {
            stopSelf(); return START_NOT_STICKY
        }
        Balu.ensureServer(this)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
