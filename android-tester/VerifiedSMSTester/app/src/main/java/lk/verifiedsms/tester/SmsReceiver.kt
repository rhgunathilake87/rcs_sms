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
