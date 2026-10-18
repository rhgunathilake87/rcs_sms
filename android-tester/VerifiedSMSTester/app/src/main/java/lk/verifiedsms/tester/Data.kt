package lk.verifiedsms.tester

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

enum class VerifyStatus { PENDING, VERIFIED, INVALID, EXPIRED, ERROR }

data class SmsItem(
    val id: Long,
    val sender: String,
    val body: String,
    val receivedAt: Long,
    val hash: String = "",
    val status: VerifyStatus = VerifyStatus.PENDING,
    val institutionName: String? = null,
    val error: String? = null,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id).put("sender", sender).put("body", body).put("receivedAt", receivedAt)
        .put("hash", hash).put("status", status.name)
        .put("institutionName", institutionName ?: JSONObject.NULL)
        .put("error", error ?: JSONObject.NULL)

    companion object {
        fun fromJson(o: JSONObject) = SmsItem(
            id = o.getLong("id"),
            sender = o.getString("sender"),
            body = o.getString("body"),
            receivedAt = o.getLong("receivedAt"),
            hash = o.optString("hash"),
            status = runCatching { VerifyStatus.valueOf(o.getString("status")) }.getOrDefault(VerifyStatus.ERROR),
            institutionName = if (o.isNull("institutionName")) null else o.getString("institutionName"),
            error = if (o.isNull("error")) null else o.getString("error"),
        )
    }
}

/** User + test settings. In the real app only the phone number would be here. */
class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var phone: String
        get() = prefs.getString("phone", "") ?: ""
        set(v) = prefs.edit().putString("phone", v.trim()).apply()

    var baseUrl: String
        get() = prefs.getString("baseUrl", DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(v) = prefs.edit().putString("baseUrl", v.trim().trimEnd('/')).apply()

    /** TEST ONLY — lets this app play the bank's role. Never ship an API key in a real app. */
    var apiKey: String
        get() = prefs.getString("apiKey", DEFAULT_API_KEY) ?: DEFAULT_API_KEY
        set(v) = prefs.edit().putString("apiKey", v.trim()).apply()

    companion object {
        // 10.0.2.2 = the host PC as seen from the Android emulator.
        const val DEFAULT_BASE_URL = "http://10.0.2.2:5001/demo-verified-sms/asia-south1/api"
        const val DEFAULT_API_KEY = "change-me-to-a-long-random-string"
    }
}

/** Tiny persistent inbox (SharedPreferences + JSON) shared by the receiver and the UI. */
object MessageStore {
    private lateinit var prefs: SharedPreferences
    private val _items = MutableStateFlow<List<SmsItem>>(emptyList())
    val items: StateFlow<List<SmsItem>> = _items

    @Synchronized
    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.applicationContext.getSharedPreferences("inbox", Context.MODE_PRIVATE)
        val raw = prefs.getString("items", "[]") ?: "[]"
        val arr = JSONArray(raw)
        _items.value = (0 until arr.length()).map { SmsItem.fromJson(arr.getJSONObject(it)) }
    }

    @Synchronized
    fun upsert(item: SmsItem) {
        val list = (_items.value.filterNot { it.id == item.id } + item).sortedByDescending { it.receivedAt }
        _items.value = list
        save(list)
    }

    @Synchronized
    fun clear() {
        _items.value = emptyList()
        save(emptyList())
    }

    private fun save(list: List<SmsItem>) {
        val arr = JSONArray()
        list.forEach { arr.put(it.toJson()) }
        prefs.edit().putString("items", arr.toString()).apply()
    }
}
