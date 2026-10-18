# Verified SMS: Android Integration Guide

The backend and the bank dashboard are deployed. The Android app's job is to:

1. receive an SMS,
2. compute its fingerprint (hash) locally,
3. ask the backend whether that fingerprint was registered by a bank,
4. show a green **Verified**, red **Unverified** or amber **Expired** UI.

No API key or login is needed. The verify endpoint is public and only accepts fingerprints,
never message text.

## 1. Backend

```
Base URL:  https://asia-south1-rcs-sms-e803f.cloudfunctions.net/api
```

Health check (open it in a browser): `.../api/health` returns `{"ok":true}`

### Verify a message

```
POST {BASE_URL}/verify-hash
Content-Type: application/json

{ "hash": "<64 lowercase hex chars>", "recipient": "+94771234567" }
```

Responses are HTTP 200 for any well-formed request:

```json
{ "status": "VERIFIED",
  "institution": { "id": "demo-bank", "name": "Demo Bank PLC",
                   "logoUrl": "", "verified": true } }

{ "status": "INVALID" }

{ "status": "EXPIRED" }
```

- `VERIFIED`: show the green header with `institution.name` (and `logoUrl` if it isn't empty).
- `INVALID`: the message was never registered for this number, or it was changed. Show the red phishing warning.
- `EXPIRED`: it was registered, but the verification window (usually 5 minutes) has passed. Show the amber warning.
- HTTP 400: your request was malformed (bad hash format or phone number).
- Network error or timeout: show a neutral "couldn't verify" state, never green.

## 2. Hash contract v1 (must match the backend exactly)

```
input = "v1|" + normalizePhone(recipient) + "|" + normalizeBody(messageText)
hash  = lowercase hex SHA-256 of the UTF-8 bytes of input
```

- **recipient** is the user's **own** phone number (the number that received the SMS).
  Android can't read it reliably, so ask the user once during onboarding and store it.
- **normalizePhone** converts to E.164 with +94 as the default:
  `0771234567`, `94771234567`, `0094771234567`, `771234567` and `+94 77 123 4567` all become `+94771234567`.
- **normalizeBody** applies Unicode NFC, converts CRLF/CR to LF, and trims the ends. Nothing else.
- **Multipart SMS**: join all parts in order *before* hashing.
- The sender ID and timestamp are **not** part of the hash.

### Test vectors (your code must produce exactly these)

| recipient | message | expected hash |
|---|---|---|
| `+94771234567` | `Your OTP code is 88219` | `cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa` |
| `0771234567` | `  Your OTP code is 88219\r\n` | `cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa` |
| `+94771234567` | `ඔබගේ OTP අංකය 88219` | `cb2545e69b91ba15f3dac3b5d19deaa93f91106ba9eb2706fc36cc7962253bc3` |

## 3. Reference code (Kotlin, tested against the backend)

Change the `package` line to match your app.

### MessageHash.kt

```kotlin
package lk.verifiedsms.tester

import java.security.MessageDigest
import java.text.Normalizer

/** Hash Contract v1 — must match functions/src/hash.ts on the backend byte for byte. */
object MessageHash {
    private const val VERSION = "v1"
    private val E164 = Regex("^\\+\\d{8,15}$")

    fun normalizePhone(raw: String, countryCode: String = "94"): String {
        val trimmed = raw.trim()
        val digits = trimmed.filter { it in '0'..'9' }
        val e164 = when {
            trimmed.startsWith("+") -> "+$digits"
            digits.startsWith("00") -> "+" + digits.drop(2)
            digits.startsWith("0") -> "+$countryCode" + digits.drop(1)
            digits.startsWith(countryCode) && digits.length > 9 -> "+$digits"
            else -> "+$countryCode$digits"
        }
        require(E164.matches(e164)) { "Invalid phone number: $raw" }
        return e164
    }

    fun normalizeBody(body: String): String =
        Normalizer.normalize(body, Normalizer.Form.NFC)
            .replace(Regex("\r\n?"), "\n")
            .trim()

    fun compute(recipient: String, body: String): String {
        val input = "$VERSION|${normalizePhone(recipient)}|${normalizeBody(body)}"
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
```

### Unit test

```kotlin
package lk.verifiedsms.tester

import org.junit.Assert.assertEquals
import org.junit.Test

/** Same test vectors as the backend (functions/src/hash.test.ts). Run: ./gradlew test */
class MessageHashTest {

    @Test
    fun phoneFormatsNormalizeToSameE164() {
        listOf("0771234567", "+94771234567", "94771234567", "0094771234567", "771234567", "+94 77 123 4567")
            .forEach { assertEquals("+94771234567", MessageHash.normalizePhone(it)) }
    }

    @Test
    fun contractVectors() {
        val v1 = "cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa"
        assertEquals(v1, MessageHash.compute("+94771234567", "Your OTP code is 88219"))
        assertEquals(v1, MessageHash.compute("0771234567", "  Your OTP code is 88219\r\n"))
        assertEquals(
            "cb2545e69b91ba15f3dac3b5d19deaa93f91106ba9eb2706fc36cc7962253bc3",
            MessageHash.compute("+94771234567", "ඔබගේ OTP අංකය 88219")
        )
    }
}
```

### Verify call (no extra dependencies: HttpURLConnection + org.json)

```kotlin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

const val BASE_URL = "https://asia-south1-rcs-sms-e803f.cloudfunctions.net/api"

enum class VerifyStatus { VERIFIED, INVALID, EXPIRED }
data class VerifyResult(val status: VerifyStatus, val institutionName: String?, val logoUrl: String?)

suspend fun verifyHash(hash: String, myNumber: String): VerifyResult = withContext(Dispatchers.IO) {
    val body = JSONObject()
        .put("hash", hash)
        .put("recipient", MessageHash.normalizePhone(myNumber))
        .toString()

    val conn = URL("$BASE_URL/verify-hash").openConnection() as HttpURLConnection
    try {
        conn.requestMethod = "POST"
        conn.connectTimeout = 5000
        conn.readTimeout = 5000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (code !in 200..299) throw IOException("HTTP $code $text")

        val json = JSONObject(text)
        val inst = json.optJSONObject("institution")
        VerifyResult(
            status = when (json.getString("status")) {
                "VERIFIED" -> VerifyStatus.VERIFIED
                "EXPIRED" -> VerifyStatus.EXPIRED
                else -> VerifyStatus.INVALID
            },
            institutionName = inst?.takeUnless { it.isNull("name") }?.getString("name"),
            logoUrl = inst?.takeUnless { it.isNull("logoUrl") }?.getString("logoUrl")?.ifBlank { null },
        )
    } finally {
        conn.disconnect()
    }
}
```

### SMS receiver

```kotlin
package lk.verifiedsms.tester

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Listens for android.provider.Telephony.SMS_RECEIVED and verifies in the background. */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (parts.isNullOrEmpty()) return

        // Multipart SMS: join every part in order BEFORE hashing (see HASH_CONTRACT.md).
        val sender = parts[0].displayOriginatingAddress ?: "Unknown"
        val body = parts.joinToString("") { it.displayMessageBody.orEmpty() }
        val receivedAt = parts[0].timestampMillis

        val pending = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Verifier.handleIncoming(appContext, sender, body, receivedAt)
            } finally {
                pending.finish()
            }
        }
    }
}
```

In `handleIncoming(...)`: compute `MessageHash.compute(myNumber, body)`, call `verifyHash(...)`,
save the result, and update the UI.

### AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />

<application ...>
    <receiver
        android:name=".SmsReceiver"
        android:exported="true"
        android:permission="android.permission.BROADCAST_SMS">
        <intent-filter>
            <action android:name="android.provider.Telephony.SMS_RECEIVED" />
        </intent-filter>
    </receiver>
</application>
```

`RECEIVE_SMS` is a runtime permission, so request it from the UI before testing.
The backend uses HTTPS, so no cleartext setting is needed.

## 4. How to test

1. Run the unit test. All three test vectors must pass.
2. Ask Rayan to send a message from the bank dashboard to **your** phone number.
   He'll share the exact text.
3. Either have someone SMS you that exact text, or feed it straight into your hash + verify code.
   Expected result: `VERIFIED` with "Demo Bank PLC".
4. Change one character and check again. Expected: `INVALID`.
5. Wait for the verification window to pass and check again. Expected: `EXPIRED`.

Rayan can watch your checks arrive live on the dashboard's Registry page (the **Checks** column).

## 5. Common mistakes

- Using the sender's number instead of the user's own number as `recipient`.
- Hashing only the first part of a multipart SMS.
- Uppercase hex, or trimming or changing spaces inside the message.
- Showing green on a network error. Only `VERIFIED` should ever be green.
