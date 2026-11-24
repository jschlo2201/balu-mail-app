package de.balumail.app

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/** Wählbares App-Symbol: je Symbol ein Activity-Alias im Manifest, genau einer ist aktiv. */
object AppIcon {
    val IDS = listOf("balu", "leuchten", "siegel", "stempel", "origami")
    @Volatile private var ctx: Context? = null

    fun init(c: Context) { ctx = c.applicationContext }

    @JvmStatic
    fun set(id: String) {
        val c = ctx ?: return
        if (id !in IDS) return
        val pm = c.packageManager
        fun cn(i: String) = ComponentName(c.packageName, "de.balumail.app.Logo_$i")
        // erst das neue einschalten, dann die anderen aus – so gibt es nie keinen Startpunkt
        if (pm.getComponentEnabledSetting(cn(id)) != PackageManager.COMPONENT_ENABLED_STATE_ENABLED &&
            !(id == "balu" && pm.getComponentEnabledSetting(cn(id)) == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)) {
            pm.setComponentEnabledSetting(cn(id), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
        }
        for (i in IDS) if (i != id) {
            val on = pm.getComponentEnabledSetting(cn(i)).let {
                it == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || (i == "balu" && it == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)
            }
            if (on) pm.setComponentEnabledSetting(cn(i), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
        }
    }
}
