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
