package de.balumail.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import org.json.JSONObject
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    companion object {
        private const val PORT = Balu.PORT
        private val TOKEN get() = Balu.TOKEN
    }

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val askNotify = registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
        askBattery()
    }

    private val pickFiles = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        fileCallback?.onReceiveValue(uris.toTypedArray())
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        web = WebView(this)
        web.setBackgroundColor(0xFFEEF1F5.toInt())
        val root = FrameLayout(this)
        root.setBackgroundColor(0xFFEEF1F5.toInt())
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)

        // Abstand zu Statusleiste, Navigationsleiste und Tastatur
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime() or WindowInsetsCompat.Type.displayCutout())
            v.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            setSupportMultipleWindows(false)
            mediaPlaybackRequiresUserGesture = true
            textZoom = 100
        }

        web.addJavascriptInterface(object {
            @android.webkit.JavascriptInterface
            fun openUrl(url: String) {
                if (!Regex("(?i)^(https?|tel|sms|geo):.*").matches(url)) return
                try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {}
            }
        }, "BaluNative")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == "127.0.0.1") return false
                // Alle externen Links im Browser bzw. in der passenden App öffnen
                try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (_: Exception) {}
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = cb
                pickFiles.launch("*/*")
                return true
            }
        }

        web.setDownloadListener { url, _, disposition, mimetype, _ ->
            saveDownload(url, disposition, mimetype)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.bmBack && window.bmBack()) ? 1 : 0") { r ->
                    if (r != "1") { isEnabled = false; onBackPressedDispatcher.onBackPressed(); isEnabled = true }
                }
            }
        })

        startServer()
        setupBackground()
    }

    /** Benachrichtigungen erlauben lassen und die Hintergrundprüfung starten. */
    private fun setupBackground() {
        Notifier.init(this)
        MailService.start(this)
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else askBattery()
    }

    /** Einmalig fragen, ob Balu-Mail vom Akku-Sparen ausgenommen werden darf (sonst schläft die Prüfung ein). */
    @SuppressLint("BatteryLife")
    private fun askBattery() {
        val pm = getSystemService(PowerManager::class.java)
        val prefs = getSharedPreferences("balu", MODE_PRIVATE)
        if (pm.isIgnoringBatteryOptimizations(packageName) || prefs.getBoolean("akku_gefragt", false)) return
        prefs.edit().putBoolean("akku_gefragt", true).apply()
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {}
    }

    private fun startServer() {
        web.loadDataWithBaseURL(null,
            "<html><body style='margin:0;display:flex;height:100vh;align-items:center;justify-content:center;font-family:sans-serif;color:#1a6fe6;background:#eef1f5'>Balu-Mail wird gestartet …</body></html>",
            "text/html", "utf-8", null)
        Balu.ensureServer(this)
        thread {
            val deadline = System.currentTimeMillis() + 20000
            while (System.currentTimeMillis() < deadline) {
                try { Socket().use { it.connect(InetSocketAddress("127.0.0.1", PORT), 300) }; break }
                catch (_: Exception) {
                    Balu.lastError?.let { err -> runOnUiThread { Toast.makeText(this, "Fehler beim Start: $err", Toast.LENGTH_LONG).show() }; Balu.lastError = null }
                    Thread.sleep(150)
                }
            }
            val m = mailtoFrom(intent)
            fun enc(v: String) = URLEncoder.encode(v, "UTF-8").replace("+", "%20")
            val extra = when {
                m != null -> "&mailto=" + enc(m)
                intent?.getStringExtra("open") != null -> "&open=" + enc(intent.getStringExtra("open")!!)
                else -> ""
            }
            runOnUiThread { web.loadUrl("http://127.0.0.1:$PORT/#t=$TOKEN&a=1$extra") }
        }
    }

    /** mailto-Link aus dem Aufruf einer anderen App zusammensetzen (inkl. Betreff/Text aus Extras). */
    private fun mailtoFrom(i: Intent?): String? {
        val d = i?.data ?: return null
        if (d.scheme?.lowercase() != "mailto") return null
        var url = d.toString()
        val q = mutableListOf<String>()
        fun enc(v: String) = URLEncoder.encode(v, "UTF-8").replace("+", "%20")
        i.getStringArrayExtra(Intent.EXTRA_EMAIL)?.takeIf { it.isNotEmpty() }?.let { q += "to=" + enc(it.joinToString(",")) }
        i.getStringArrayExtra(Intent.EXTRA_CC)?.takeIf { it.isNotEmpty() }?.let { q += "cc=" + enc(it.joinToString(",")) }
        i.getStringArrayExtra(Intent.EXTRA_BCC)?.takeIf { it.isNotEmpty() }?.let { q += "bcc=" + enc(it.joinToString(",")) }
        i.getStringExtra(Intent.EXTRA_SUBJECT)?.let { if (!url.contains("subject=", true)) q += "subject=" + enc(it) }
        i.getCharSequenceExtra(Intent.EXTRA_TEXT)?.let { if (!url.contains("body=", true)) q += "body=" + enc(it.toString()) }
        if (q.isNotEmpty()) url += (if (url.contains("?")) "&" else "?") + q.joinToString("&")
        return url
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra("open")?.let { ref ->
            val p = ref.split("|")
            if (p.size >= 3) web.evaluateJavascript(
                "window.bmOpenMail && window.bmOpenMail(${JSONObject.quote(p[0])}, ${JSONObject.quote(p[1])}, ${JSONObject.quote(p[2])})", null)
            return
        }
        val m = mailtoFrom(intent) ?: return
        web.evaluateJavascript("window.bmMailto && window.bmMailto(${JSONObject.quote(m)})", null)
    }

    private fun saveDownload(url: String, disposition: String?, mimetype: String?) {
        thread {
            try {
                var name = Regex("filename\\*=UTF-8''([^;]+)").find(disposition ?: "")?.groupValues?.get(1)
                    ?.let { URLDecoder.decode(it, "UTF-8") }
                    ?: URLUtil.guessFileName(url, disposition, mimetype)
                name = name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
                val conn = URL(url).openConnection() as HttpURLConnection
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, mimetype ?: "application/octet-stream")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)!!
                conn.inputStream.use { input -> contentResolver.openOutputStream(uri)!!.use { input.copyTo(it) } }
                runOnUiThread {
                    Toast.makeText(this, "„$name“ wurde in „Downloads“ gespeichert", Toast.LENGTH_LONG).show()
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, mimetype).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                    } catch (_: Exception) {}
                }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this, "Download fehlgeschlagen: ${e.message}", Toast.LENGTH_LONG).show() }
            }
        }
    }

    override fun onDestroy() {
        (web.parent as? ViewGroup)?.removeView(web)
        web.destroy()
        super.onDestroy()
    }
}
