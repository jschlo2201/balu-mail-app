package de.balumail.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Benachrichtigungen – wird aus dem Python-Teil (notify_loop) aufgerufen. */
object Notifier {
    const val CH_MAIL = "neue_mail"
    const val CH_SERVICE = "hintergrund"
    @Volatile private var ctx: Context? = null

    fun init(c: Context) {
        val app = c.applicationContext
        ctx = app
        val nm = app.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH_MAIL, "Neue E-Mails", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Meldung bei neuen E-Mails in den Posteingängen"
        })
        nm.createNotificationChannel(NotificationChannel(CH_SERVICE, "Hintergrundprüfung", NotificationManager.IMPORTANCE_MIN).apply {
            description = "Dauerhafter Hinweis, dass Balu-Mail im Hintergrund nach neuen E-Mails sieht"
            setShowBadge(false)
        })
    }

    private fun allowed(c: Context) = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun open(c: Context, ref: String, req: Int): PendingIntent {
        val i = Intent(c, MainActivity::class.java)
            .setAction("de.balumail.OPEN")
            .putExtra("open", ref)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    @JvmStatic
    fun newMail(accId: String, accEmail: String, from: String, subject: String, folder: String, uid: String) {
        val c = ctx ?: return
        if (!allowed(c)) return
        val id = ("$accId|$folder|$uid").hashCode()
        val n = NotificationCompat.Builder(c, CH_MAIL)
            .setSmallIcon(R.drawable.ic_stat_mail)
            .setColor(0xFF1A6FE6.toInt())
            .setContentTitle(from)
            .setContentText(subject)
            .setStyle(NotificationCompat.BigTextStyle().bigText(subject))
            .setSubText(accEmail)
            .setCategory(NotificationCompat.CATEGORY_EMAIL)
            .setGroup("konto_$accId")
            .setAutoCancel(true)
            .setContentIntent(open(c, "$accId|$folder|$uid", id))
            .build()
        try { NotificationManagerCompat.from(c).notify(id, n) } catch (_: SecurityException) {}
    }

    @JvmStatic
    fun summary(accId: String, accEmail: String, count: Int, senders: String) {
        val c = ctx ?: return
        if (!allowed(c)) return
        val id = ("sum|$accId").hashCode()
        val n = NotificationCompat.Builder(c, CH_MAIL)
            .setSmallIcon(R.drawable.ic_stat_mail)
            .setColor(0xFF1A6FE6.toInt())
            .setContentTitle("$count neue E-Mails")
            .setContentText(senders)
            .setSubText(accEmail)
            .setCategory(NotificationCompat.CATEGORY_EMAIL)
            .setAutoCancel(true)
            .setContentIntent(open(c, "$accId|INBOX|", id))
            .build()
        try { NotificationManagerCompat.from(c).notify(id, n) } catch (_: SecurityException) {}
    }

    fun serviceNotification(c: Context) = NotificationCompat.Builder(c, CH_SERVICE)
        .setSmallIcon(R.drawable.ic_stat_mail)
        .setContentTitle("Balu-Mail")
        .setContentText("Sieht im Hintergrund nach neuen E-Mails")
        .setPriority(NotificationCompat.PRIORITY_MIN)
        .setOngoing(true)
        .setContentIntent(PendingIntent.getActivity(c, 1, Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE))
        .build()
}
