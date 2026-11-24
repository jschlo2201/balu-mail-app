package de.balumail.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Nach dem Einschalten des Handys bzw. nach einem App-Update die Hintergrundprüfung wieder starten. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (i.action == Intent.ACTION_BOOT_COMPLETED || i.action == Intent.ACTION_MY_PACKAGE_REPLACED) MailService.start(c)
    }
}
