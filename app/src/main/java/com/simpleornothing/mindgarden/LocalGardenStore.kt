package com.simpleornothing.mindgarden

import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract as Docs
import android.util.AtomicFile
import android.webkit.WebView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

/** Two rotating snapshots in a user-selected internal shared folder survive uninstall. */
class LocalGardenStore(
    private val activity: AppCompatActivity,
    private val web: WebView,
    private val chooseFolder: (Uri) -> Unit
) {
    private val resolver = activity.contentResolver
    private val prefs = activity.getSharedPreferences("garden-local-store", 0)
    private val worker = Executors.newSingleThreadExecutor()
    private val internal = AtomicFile(File(activity.filesDir, "garden-local.json"))
    private var pending: Pair<String, String>? = null
    private var prepared = false
    private val keys = setOf("mindGardenMetaV1", "sun", "myPlants", "room", "plantX", "plantY", "plantSize", "roomX", "roomY", "roomScale", "mindGardenFocusSessionV1")
    private val limit = 12 * 1024 * 1024

    private fun reply(id: String, value: JSONObject) = activity.runOnUiThread {
        web.evaluateJavascript("window.mindGardenLocalResult && window.mindGardenLocalResult(${JSONObject.quote(id)},$value)", null)
    }
    private fun work(id: String, action: () -> JSONObject) { worker.execute {
        try { reply(id, action().put("ok", true)) }
        catch (_: Exception) { reply(id, JSONObject().put("ok", false).put("error", "정원 저장 폴더를 읽거나 쓰지 못했습니다. 기존 저장 파일은 보관됩니다.")) }
    } }
    private fun tree(): Uri? {
        val uri = prefs.getString("tree", null)?.let(Uri::parse) ?: return null
        return uri.takeIf { resolver.persistedUriPermissions.any { p -> p.uri == uri && p.isReadPermission && p.isWritePermission } }
    }
    fun request(id: String, operation: String, payload: String) {
        if (payload.length > limit) { reply(id, JSONObject().put("ok", false).put("error", "정원 사진의 저장 용량을 초과했습니다.")); return }
        when (operation) {
            "prepare" -> {
                if (tree() != null) prepare(id, payload)
                else {
                    pending = id to payload
                    AlertDialog.Builder(activity).setTitle("휴대폰에 정원 저장")
                        .setMessage("내장 저장공간의 Documents 안에 정원 저장 폴더를 선택해 주세요. 자동으로 저장되며, 재설치 후 같은 폴더를 선택하면 복원됩니다.")
                        .setPositiveButton("폴더 선택") { _, _ -> chooseFolder(Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADocuments")) }
                        .setNegativeButton("나중에") { _, _ -> folderSelected(null) }
                        .setOnCancelListener { folderSelected(null) }.show()
                }
            }
            "save" -> work(id) {
                check(prepared)
                val state = checked(payload)
                val bytes = payload.toByteArray(Charsets.UTF_8)
                val output = internal.startWrite()
                try { output.write(bytes); internal.finishWrite(output) }
                catch (e: Exception) { internal.failWrite(output); throw e }
                val result = JSONObject()
                val uri = tree()
                if (uri != null) saveShared(uri, state)
                else result.put("warning", "앱 안에 저장 중입니다. 재설치 시 복원하려면 앱을 다시 열어 내장 저장 폴더를 선택해 주세요.")
                result
            }
        }
    }
    fun folderSelected(uri: Uri?) {
        val request = pending ?: return
        pending = null
        if (uri != null) {
            try {
                require(uri.authority == "com.android.externalstorage.documents" && Docs.getTreeDocumentId(uri).startsWith("primary:"))
                resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                prefs.edit().putString("tree", uri.toString()).apply()
            } catch (_: Exception) {
                Toast.makeText(activity, "휴대폰 내장 저장공간의 폴더를 선택해 주세요.", Toast.LENGTH_LONG).show()
                pending = request
                chooseFolder(Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADocuments"))
                return
            }
        }
        prepare(request.first, request.second)
    }
    private fun checked(text: String): JSONObject {
        require(text.toByteArray(Charsets.UTF_8).size <= limit)
        val state = JSONObject(text)
        require(state.getInt("version") == 1)
        val values = state.getJSONObject("values")
        values.keys().forEach { key -> require(key in keys && values.get(key) is String) }
        if (values.has("myPlants")) org.json.JSONArray(values.getString("myPlants"))
        for (key in listOf("mindGardenMetaV1", "mindGardenFocusSessionV1")) if (values.has(key)) JSONObject(values.getString(key))
        return state
    }
    private fun prepare(id: String, payload: String) = work(id) {
        val current = checked(payload)
        val uri = tree()
        // Always inspect shared snapshots before allowing a write: never erase unreadable history.
        val shared = uri?.let { readShared(it) }
        val old = try { checked(internal.readFully().toString(Charsets.UTF_8)) } catch (_: Exception) { null }
        val result = JSONObject()
        if (current.getJSONObject("values").length() == 0) {
            listOfNotNull(shared, old).maxByOrNull { it.optString("savedAt") }?.let { result.put("state", it) }
        }
        if (uri == null) result.put("warning", "앱 안에 저장 중입니다. 재설치 시 복원하려면 앱을 다시 열어 내장 저장 폴더를 선택해 주세요.")
        prepared = true
        result
    }
    private fun children(tree: Uri, parent: Uri): Map<String, Uri> {
        val query = Docs.buildChildDocumentsUriUsingTree(tree, Docs.getDocumentId(parent))
        val found = mutableMapOf<String, Uri>()
        val cursor = resolver.query(query, arrayOf(Docs.Document.COLUMN_DOCUMENT_ID, Docs.Document.COLUMN_DISPLAY_NAME), null, null, null) ?: error("Cannot list folder")
        cursor.use { while (it.moveToNext()) found[it.getString(1)] = Docs.buildDocumentUriUsingTree(tree, it.getString(0)) }
        return found
    }
    private fun folder(tree: Uri): Uri {
        val parent = Docs.buildDocumentUriUsingTree(tree, Docs.getTreeDocumentId(tree))
        if (Docs.getTreeDocumentId(tree).substringAfterLast('/').substringAfterLast(':') == "MindGarden") return parent
        return children(tree, parent)["MindGarden"] ?: Docs.createDocument(resolver, parent, Docs.Document.MIME_TYPE_DIR, "MindGarden") ?: error("Cannot create folder")
    }
    private fun read(uri: Uri): String {
        val stream = resolver.openInputStream(uri) ?: error("Cannot read")
        return stream.use {
            val out = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (true) { val count = it.read(buffer); if (count < 0) break; require(out.size() + count <= limit * 2 + 2048); out.write(buffer, 0, count) }
            out.toString("UTF-8")
        }
    }
    private fun digest(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    private fun decode(raw: String): JSONObject {
        val wrapper = JSONObject(raw)
        val payload = wrapper.getString("payload")
        require(wrapper.getString("sha256") == digest(payload))
        return checked(payload)
    }
    private fun readShared(tree: Uri): JSONObject? {
        val files = children(tree, folder(tree))
        val present = listOf("garden-0.json", "garden-1.json").mapNotNull { files[it] }
        val valid = present.mapNotNull { try { decode(read(it)) } catch (_: Exception) { null } }
        require(present.isEmpty() || valid.isNotEmpty())
        return valid.maxByOrNull { it.optString("savedAt") }
    }
    private fun saveShared(tree: Uri, state: JSONObject) {
        val parent = folder(tree)
        val files = children(tree, parent)
        val slots = (0..1).map { n -> files["garden-$n.json"]?.let { try { decode(read(it)).optString("savedAt") } catch (_: Exception) { null } } }
        val slot = if (slots[0] == null) 0 else if (slots[1] == null) 1 else if (slots[0]!! <= slots[1]!!) 0 else 1
        val name = "garden-$slot.json"
        val uri = files[name] ?: Docs.createDocument(resolver, parent, "application/json", name) ?: error("Cannot create snapshot")
        val payload = state.toString()
        val wrapper = JSONObject().put("payload", payload).put("sha256", digest(payload)).toString()
        val stream = resolver.openOutputStream(uri, "wt") ?: error("Cannot write snapshot")
        stream.bufferedWriter(Charsets.UTF_8).use { it.write(wrapper) }
        require(decode(read(uri)).toString() == payload)
    }
}
