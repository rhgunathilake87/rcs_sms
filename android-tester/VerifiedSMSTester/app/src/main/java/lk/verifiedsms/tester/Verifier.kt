package lk.verifiedsms.tester

import android.content.Context

/** computeLocalHash + performSilentQuery + update the inbox. */
object Verifier {

    suspend fun handleIncoming(context: Context, sender: String, body: String, receivedAt: Long) {
        MessageStore.init(context)
        val item = SmsItem(id = System.nanoTime(), sender = sender, body = body, receivedAt = receivedAt)
        MessageStore.upsert(item)
        verify(context, item)
    }

    suspend fun verify(context: Context, item: SmsItem) {
        MessageStore.init(context)
        val settings = Settings(context)

        if (settings.phone.isBlank()) {
            MessageStore.upsert(item.copy(status = VerifyStatus.ERROR, error = "Set your phone number in Settings"))
            return
        }

        val hash = try {
            MessageHash.compute(settings.phone, item.body)
        } catch (e: IllegalArgumentException) {
            MessageStore.upsert(item.copy(status = VerifyStatus.ERROR, error = e.message))
            return
        }

        MessageStore.upsert(item.copy(hash = hash, status = VerifyStatus.PENDING, error = null))

        val updated = try {
            val result = BackendApi.verify(settings.baseUrl, hash, MessageHash.normalizePhone(settings.phone))
            item.copy(hash = hash, status = result.status, institutionName = result.institutionName, error = null)
        } catch (e: Exception) {
            item.copy(hash = hash, status = VerifyStatus.ERROR, error = e.message ?: e.javaClass.simpleName)
        }
        MessageStore.upsert(updated)
    }
}
