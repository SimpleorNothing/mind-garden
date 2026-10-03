package com.simpleornothing.mindgarden

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.text.InputType
import android.util.Base64
import android.webkit.WebView
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.KeyStore
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Private-repository snapshots. Token stays encrypted in native storage. */
class GardenGitHubStore(private val activity: Activity, private val web: WebView) {
    private val prefs = activity.getSharedPreferences("garden_github", Context.MODE_PRIVATE)
    private val executor = Executors.newSingleThreadExecutor()
    private val alias = "mind-garden-github-token-v1"
    private val path = "mind-garden/app-state.json"
    private class ApiError(val code: Int, message: String) : Exception(message)
    private fun trusted() = web.url?.startsWith("file:///android_asset/") == true
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun seal(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        return Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    }
    private fun token(): String {
        val bytes = Base64.decode(prefs.getString("token", "") ?: "", Base64.NO_WRAP)
        require(bytes.size > 12)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        }
        return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
    }
    fun connected(): Boolean = try { token().isNotBlank() } catch (_: Exception) { false }
    private fun api(route: String, access: String, method: String = "GET", body: JSONObject? = null,
                    accept: String = "application/vnd.github+json"): Pair<Int, String> {
        require(route.startsWith("/repos/"))
        val connection = URL("https://api.github.com$route").openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15000; connection.readTimeout = 20000
            connection.requestMethod = method
            connection.setRequestProperty("Authorization", "Bearer $access")
            connection.setRequestProperty("Accept", accept)
            connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
            connection.setRequestProperty("User-Agent", "Mind-Garden")
            if (body != null) {
                connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (code !in 200..299 && code != 404) throw ApiError(code, when(code) {
                401,403 -> "GitHub 권한을 확인하고 다시 연결해주세요."
                409,422 -> "GitHub의 기록이 변경돼 덮어쓰기를 중단했습니다."
                else -> "GitHub 응답 오류 ($code)"
            })
            return code to text
        } finally { connection.disconnect() }
    }
    private fun repoInfo(repository: String, access: String): JSONObject {
        require(repository.matches(Regex("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")))
        val result = api("/repos/$repository", access)
        if (result.first == 404) throw ApiError(404, "비공개 저장소 접근 권한을 확인해주세요.")
        val info = JSONObject(result.second)
        require(info.getBoolean("private")) { "사진과 기록은 비공개 저장소에만 저장합니다." }
        return info
    }
    fun connect() { activity.runOnUiThread {
        if (!trusted()) return@runOnUiThread
        val layout = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; setPadding(40, 12, 40, 12) }
        val repository = EditText(activity).apply {
            setText(prefs.getString("repository", "SimpleorNothing/files")); hint = "비공개 저장소: 소유자/이름"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        val input = EditText(activity).apply { hint = "GitHub fine-grained token"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        layout.addView(repository); layout.addView(input)
        val dialog = AlertDialog.Builder(activity).setTitle("GitHub 연결")
            .setMessage("선택한 비공개 저장소에만 Contents: Read and write 권한을 준 토큰을 입력하세요. 토큰은 앱에서 암호화해 보관합니다. 재설치 후 다시 연결하면 기록을 자동으로 불러옵니다.")
            .setView(layout).setNegativeButton("취소", null).setPositiveButton("연결", null).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val repo = repository.text.toString().trim(); val access = input.text.toString().trim()
                if (access.isEmpty()) { input.error = "토큰을 입력해주세요."; return@setOnClickListener }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = false
                executor.execute {
                    try {
                        val info = repoInfo(repo, access)
                        val encrypted = seal(access)
                        require(prefs.edit().putString("repository", repo).putString("branch", info.getString("default_branch"))
                            .putString("token", encrypted).commit()) { "연결 정보를 저장하지 못했습니다." }
                        activity.runOnUiThread { input.setText(""); dialog.dismiss(); if (trusted()) web.evaluateJavascript("window.mindGardenGitHubConnected && window.mindGardenGitHubConnected()", null) }
                    } catch (e: Exception) { activity.runOnUiThread {
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = true
                        Toast.makeText(activity, e.message ?: "연결 실패", Toast.LENGTH_LONG).show()
                    } }
                }
            }
        }; dialog.show()
    } }
    fun request(id: String, operation: String, payload: String) {
        executor.execute {
            val result = try {
                val access = token(); val repository = prefs.getString("repository", "") ?: ""
                // Re-check visibility and authorization before every read/write.
                val info = repoInfo(repository, access)
                val branch = info.getString("default_branch")
                val route = "/repos/$repository/contents/$path"
                val query = "?ref=" + URLEncoder.encode(branch, "UTF-8")
                if (operation == "load") {
                    val metadata = api(route + query, access)
                    if (metadata.first == 404) JSONObject().put("ok", true).put("sha", "").put("state", JSONObject.NULL)
                    else {
                        val item = JSONObject(metadata.second)
                        val json = if (item.optString("encoding") == "base64") {
                            String(Base64.decode(item.getString("content"), Base64.DEFAULT), Charsets.UTF_8)
                        } else {
                            val raw = api(route + query, access, accept = "application/vnd.github.raw+json")
                            require(raw.first == 200) { "정원 파일을 불러오지 못했습니다." }; raw.second
                        }
                        JSONObject().put("ok", true).put("sha", item.getString("sha")).put("state", JSONObject(json))
                    }
                } else if (operation == "save") {
                    val input = JSONObject(payload); val state = input.getJSONObject("state")
                    require(state.getInt("version") == 1); state.getJSONObject("values")
                    val bytes = state.toString().toByteArray(Charsets.UTF_8)
                    require(bytes.size <= 12 * 1024 * 1024) { "사진 용량이 커 GitHub 저장 한도(12MB)를 넘었습니다." }
                    val body = JSONObject().put("message", "Save private Mind Garden state")
                        .put("branch", branch).put("content", Base64.encodeToString(bytes, Base64.NO_WRAP))
                    val sha = input.optString("sha"); if (sha.isNotEmpty()) body.put("sha", sha)
                    val saved = api(route, access, "PUT", body)
                    require(saved.first in 200..299) { "정원 저장에 실패했습니다." }
                    JSONObject().put("ok", true).put("sha", JSONObject(saved.second).getJSONObject("content").getString("sha"))
                } else throw IllegalArgumentException("지원하지 않는 요청입니다.")
            } catch (e: Exception) { JSONObject().put("ok", false).put("code", (e as? ApiError)?.code ?: 0)
                .put("message", if (e is ApiError || e is IllegalArgumentException) e.message else "GitHub 연결 실패. 기기 데이터는 유지됩니다.") }
            activity.runOnUiThread { if (trusted()) web.evaluateJavascript("window.mindGardenGitHubResponse && window.mindGardenGitHubResponse(${JSONObject.quote(id)},$result)", null) }
        }
    }
}
