package lk.verifiedsms.tester

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class VerifyResult(val status: VerifyStatus, val institutionName: String?)

/** Plain HttpURLConnection + org.json, so no extra Gradle dependencies are needed. */
object BackendApi {

    suspend fun verify(baseUrl: String, hash: String, recipient: String): VerifyResult =
        withContext(Dispatchers.IO) {
            val json = post(
                "$baseUrl/verify-hash",
                JSONObject().put("hash", hash).put("recipient", recipient),
                apiKey = null,
            )
            val status = when (json.getString("status")) {
                "VERIFIED" -> VerifyStatus.VERIFIED
                "EXPIRED" -> VerifyStatus.EXPIRED
                else -> VerifyStatus.INVALID
            }
            val inst = json.optJSONObject("institution")
            val name = if (inst == null || inst.isNull("name")) null else inst.getString("name")
            VerifyResult(status, name)
        }

    /** TEST ONLY: plays the bank dashboard's role. Returns the hash the server stored. */
    suspend fun register(baseUrl: String, apiKey: String, recipient: String, message: String): String =
        withContext(Dispatchers.IO) {
            val json = post(
                "$baseUrl/register-hash",
                JSONObject().put("recipient", recipient).put("message", message),
                apiKey = apiKey,
            )
            json.getString("hash")
        }

    private fun post(url: String, body: JSONObject, apiKey: String?): JSONObject {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 4000
            conn.readTimeout = 5000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            if (apiKey != null) conn.setRequestProperty("x-api-key", apiKey)

            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IOException("HTTP $code ${text.take(200)}")
            return JSONObject(text)
        } finally {
            conn.disconnect()
        }
    }
}
