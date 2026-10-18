# Hash Contract v1 (Backend ⇄ Android)

The backend and the Android app must compute **exactly the same hash** for the same SMS.
If any step below differs, every message will come back `INVALID`.

## Formula

```
input = "v1|" + normalizePhone(recipient) + "|" + normalizeBody(messageText)
hash  = lowercase hex SHA-256 of the UTF-8 bytes of input   (64 characters)
```

- **recipient** — the phone number that *received* the SMS, i.e. the user's own number.
  Android often can't read its own number reliably, so the app should ask the user
  to enter it once during onboarding and store it.
- **normalizePhone** — convert to E.164 with Sri Lanka (+94) as the default country:
  `0771234567`, `94771234567`, `0094771234567`, `771234567`, `+94 77 123 4567` → `+94771234567`.
  Keep only ASCII digits 0–9 (plus a leading `+`). Result must match `^\+\d{8,15}$`.
- **normalizeBody** — Unicode NFC → replace `\r\n` and `\r` with `\n` → trim leading/trailing whitespace.
  Nothing else (don't lowercase, don't collapse inner spaces).
- **Multipart SMS** — join the bodies of all parts in order (from
  `Telephony.Sms.Intents.getMessagesFromIntent(intent)`) *before* hashing.
- The sender ID and timestamp are **not** in the hash. Expiry is handled by the server TTL.

## Test vectors (your implementation must produce these)

| recipient        | message                          | expected hash |
|------------------|----------------------------------|---------------|
| `+94771234567`   | `Your OTP code is 88219`         | `cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa` |
| `0771234567`     | `  Your OTP code is 88219\r\n`   | `cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa` |
| `+94771234567`   | `ඔබගේ OTP අංකය 88219`             | `cb2545e69b91ba15f3dac3b5d19deaa93f91106ba9eb2706fc36cc7962253bc3` |

## Kotlin reference implementation

```kotlin
import java.security.MessageDigest
import java.text.Normalizer

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

## Verify endpoint

```
POST {BASE_URL}/verify-hash
Content-Type: application/json

{ "hash": "<64 hex chars>", "recipient": "+94771234567" }
```

Responses (always HTTP 200 for a well-formed request):

```json
{ "status": "VERIFIED",
  "institution": { "id": "demo-bank", "name": "Demo Bank PLC",
                   "logoUrl": "https://...", "verified": true } }
{ "status": "INVALID" }
{ "status": "EXPIRED" }
```

HTTP 400 means the request itself was malformed (bad hash or phone format).

`BASE_URL` during development (Firebase emulator, from the Android emulator):
`http://10.0.2.2:5001/demo-verified-sms/asia-south1/api`
— `10.0.2.2` is the Android emulator's alias for the host PC. Plain HTTP needs
`android:usesCleartextTraffic="true"` (debug builds only).
The production URL will be shared after deployment.
