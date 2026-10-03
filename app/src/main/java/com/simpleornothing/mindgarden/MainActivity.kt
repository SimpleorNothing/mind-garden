package com.simpleornothing.mindgarden

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private var pendingBackup: String? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private inner class AppBridge {
        @JavascriptInterface
        fun exportGardenBackup(json: String) {
            if (json.length > 12 * 1024 * 1024) return
            runOnUiThread {
                pendingBackup = json
                backupWriter.launch("mind-garden-backup.json")
            }
        }
        @JavascriptInterface
        fun importGardenBackup() {
            runOnUiThread { backupReader.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) }
        }
        @JavascriptInterface
        fun setKeepScreenOn(enabled: Boolean) {
            runOnUiThread {
                if (enabled) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            }
        }
    }

    private fun backupResult(ok: Boolean, message: String) {
        web.evaluateJavascript("window.mindGardenBackupResult && window.mindGardenBackupResult($ok,${JSONObject.quote(message)})", null)
    }
    private val backupWriter = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val json = pendingBackup
        pendingBackup = null
        if (uri != null && json != null) {
            try {
                val stream = contentResolver.openOutputStream(uri) ?: error("Cannot open backup")
                stream.bufferedWriter(Charsets.UTF_8).use { it.write(json) }
                backupResult(true, "백업 파일을 저장했습니다.")
            } catch (_: Exception) { backupResult(false, "백업 파일을 저장하지 못했습니다.") }
        }
    }
    private val backupReader = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            try {
                val stream = contentResolver.openInputStream(uri) ?: error("Cannot open backup")
                val bytes = stream.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        require(output.size() + count <= 12 * 1024 * 1024)
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                require(bytes.size <= 12 * 1024 * 1024)
                val json = bytes.toString(Charsets.UTF_8)
                web.evaluateJavascript("window.mindGardenRestoreBackup && window.mindGardenRestoreBackup(${JSONObject.quote(json)})", null)
            } catch (_: Exception) { backupResult(false, "백업 파일을 읽지 못했습니다.") }
        }
    }

    private val picker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val cb = fileCallback
        fileCallback = null
        if (result.resultCode == Activity.RESULT_OK) {
            cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        } else {
            cb?.onReceiveValue(null)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.settings.allowContentAccess = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.addJavascriptInterface(AppBridge(), "AndroidBridge")
        web.webViewClient = WebViewClient()
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = params?.createIntent() ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    type = "image/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                return try {
                    picker.launch(intent)
                    true
                } catch (_: Exception) {
                    fileCallback = null
                    false
                }
            }
        }
        if (savedInstanceState == null) {
            web.loadUrl("file:///android_asset/index.html")
        } else {
            web.restoreState(savedInstanceState)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::web.isInitialized) {
            web.evaluateJavascript("window.mindGardenRefreshLive && window.mindGardenRefreshLive()", null)
        }
    }

    override fun onPause() {
        if (::web.isInitialized) {
            web.evaluateJavascript(
                "window.mindGardenPauseForBackground && window.mindGardenPauseForBackground()",
                null
            )
        }
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::web.isInitialized) web.saveState(outState)
        super.onSaveInstanceState(outState)
    }
}
