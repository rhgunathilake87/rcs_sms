package lk.verifiedsms.tester

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val Green = Color(0xFF1B7F3B)
private val Red = Color(0xFFC62828)
private val Amber = Color(0xFFB26A00)
private val Grey = Color(0xFF616161)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MessageStore.init(this)
        enableEdgeToEdge()
        setContent {
            MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()) {
                App()
            }
        }
    }
}

@Composable
private fun App() {
    var tab by remember { mutableIntStateOf(0) }
    val titles = listOf("Inbox", "Test", "Settings")

    Scaffold(modifier = Modifier.fillMaxSize()) { inner ->
        Column(Modifier.padding(inner)) {
            Text(
                "Verified SMS",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(16.dp, 12.dp)
            )
            TabRow(selectedTabIndex = tab) {
                titles.forEachIndexed { i, t ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t) })
                }
            }
            when (tab) {
                0 -> InboxScreen()
                1 -> TestScreen()
                else -> SettingsScreen()
            }
        }
    }
}

// ---------------- Inbox ----------------

@Composable
private fun InboxScreen() {
    val context = LocalContext.current
    val items by MessageStore.items.collectAsState()
    val scope = rememberCoroutineScope()

    var granted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        granted = it
    }

    Column(Modifier.fillMaxSize()) {
        if (!granted) {
            Card(Modifier.fillMaxWidth().padding(16.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Text("SMS permission needed", fontWeight = FontWeight.Bold)
                    Text("Allow the app to receive SMS so incoming messages can be verified.")
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { launcher.launch(Manifest.permission.RECEIVE_SMS) }) {
                        Text("Grant permission")
                    }
                }
            }
        }

        if (items.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("No messages yet.\nSend a test SMS or use the Test tab.", color = Grey)
            }
        } else {
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { MessageStore.clear() }) { Text("Clear all") }
            }
            LazyColumn(
                contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(items, key = { it.id }) { item ->
                    MessageCard(item, onRetry = { scope.launch { Verifier.verify(context, item) } })
                }
            }
        }
    }
}

@Composable
private fun MessageCard(item: SmsItem, onRetry: () -> Unit) {
    var showInfo by remember { mutableStateOf(false) }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        // ---- Trust header ----
        when (item.status) {
            VerifyStatus.VERIFIED -> Row(
                Modifier.fillMaxWidth().background(Green).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val name = item.institutionName ?: "Verified sender"
                Box(
                    Modifier.size(36.dp).background(Color.White, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(initials(name), color = Green, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, color = Color.White, fontWeight = FontWeight.Bold)
                    Text("✓ Verified", color = Color.White, fontSize = 13.sp)
                }
                TextButton(onClick = { showInfo = true }) { Text("ⓘ", color = Color.White, fontSize = 20.sp) }
            }

            VerifyStatus.INVALID -> Banner(Red, "⚠ Unverified sender — potential phishing attempt")
            VerifyStatus.EXPIRED -> Banner(Amber, "⏱ Verification expired — treat with caution")
            VerifyStatus.PENDING -> Banner(Grey, "Verifying…")
            VerifyStatus.ERROR -> Banner(Grey, "Couldn't verify: ${item.error ?: "unknown error"}")
        }

        // ---- Message bubble ----
        Column(Modifier.padding(14.dp)) {
            Text("From: ${item.sender}", style = MaterialTheme.typography.labelMedium, color = Grey)
            Spacer(Modifier.height(6.dp))
            Text(item.body, style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(formatTime(item.receivedAt), style = MaterialTheme.typography.labelSmall, color = Grey)
                Spacer(Modifier.weight(1f))
                if (item.status == VerifyStatus.ERROR || item.status == VerifyStatus.INVALID) {
                    TextButton(onClick = onRetry) { Text("Re-check") }
                }
            }
        }
    }

    if (showInfo) {
        AlertDialog(
            onDismissRequest = { showInfo = false },
            confirmButton = { TextButton(onClick = { showInfo = false }) { Text("OK") } },
            title = { Text("Verified message") },
            text = {
                Column {
                    Text("This message was verified out-of-band against the institution's Authorized Message Registry.")
                    Spacer(Modifier.height(8.dp))
                    Text("Hash:", fontWeight = FontWeight.Bold)
                    SelectionContainer {
                        Text(item.hash, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    }
                }
            }
        )
    }
}

@Composable
private fun Banner(color: Color, text: String) {
    Text(
        text,
        color = Color.White,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.fillMaxWidth().background(color).padding(12.dp)
    )
}

// ---------------- Test tools ----------------

@Composable
private fun TestScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val settings = remember { Settings(context) }

    var message by remember { mutableStateOf("Your OTP code is 88219") }
    var log by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    val localHash = remember(message) {
        runCatching { MessageHash.compute(settings.phone, message) }.getOrElse { "— (${it.message})" }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Your number: ${settings.phone.ifBlank { "not set (go to Settings)" }}")

        OutlinedTextField(
            value = message,
            onValueChange = { message = it },
            label = { Text("Message text") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2
        )

        Text("Local hash:", fontWeight = FontWeight.Bold)
        SelectionContainer { Text(localHash, fontFamily = FontFamily.Monospace, fontSize = 12.sp) }

        HorizontalDivider()

        Text("1. Play the bank", fontWeight = FontWeight.Bold)
        Text("Registers this exact text for your number on the backend (5-minute TTL).", color = Grey)
        Button(
            enabled = !busy,
            onClick = {
                busy = true
                scope.launch {
                    log = try {
                        val serverHash = BackendApi.register(settings.baseUrl, settings.apiKey, settings.phone, message)
                        val match = if (serverHash == localHash) "MATCH ✓" else "MISMATCH ✗"
                        "Registered.\nServer hash: $serverHash\nLocal vs server: $match"
                    } catch (e: Exception) {
                        "Register failed: ${e.message}"
                    }
                    busy = false
                }
            }
        ) { Text("Register as bank") }

        HorizontalDivider()

        Text("2. Receive it", fontWeight = FontWeight.Bold)
        Text(
            "Real test: send the SAME text as an SMS (emulator: ⋯ Extended controls → Phone → SMS message). " +
                "Quick test: the button below runs the same hash + verify flow without the SMS stack.",
            color = Grey
        )
        OutlinedButton(
            enabled = !busy,
            onClick = {
                scope.launch {
                    Verifier.handleIncoming(context, "SIMULATED", message, System.currentTimeMillis())
                    log = "Simulated message added to Inbox."
                }
            }
        ) { Text("Simulate received SMS") }

        if (log.isNotEmpty()) {
            Card(Modifier.fillMaxWidth()) {
                SelectionContainer {
                    Text(log, Modifier.padding(12.dp), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                }
            }
        }
    }
}

// ---------------- Settings ----------------

@Composable
private fun SettingsScreen() {
    val context = LocalContext.current
    val settings = remember { Settings(context) }

    var phone by remember { mutableStateOf(settings.phone) }
    var baseUrl by remember { mutableStateOf(settings.baseUrl) }
    var apiKey by remember { mutableStateOf(settings.apiKey) }
    var saved by remember { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedTextField(
            value = phone, onValueChange = { phone = it },
            label = { Text("Your phone number (e.g. 0771234567)") },
            modifier = Modifier.fillMaxWidth(), singleLine = true
        )
        OutlinedTextField(
            value = baseUrl, onValueChange = { baseUrl = it },
            label = { Text("Backend base URL") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = apiKey, onValueChange = { apiKey = it },
            label = { Text("Bank API key (test only)") },
            modifier = Modifier.fillMaxWidth(), singleLine = true
        )
        Button(onClick = {
            saved = try {
                MessageHash.normalizePhone(phone)
                settings.phone = phone
                settings.baseUrl = baseUrl
                settings.apiKey = apiKey
                "Saved. Number used for hashing: ${MessageHash.normalizePhone(phone)}"
            } catch (e: IllegalArgumentException) {
                e.message ?: "Invalid phone number"
            }
        }) { Text("Save") }
        if (saved.isNotEmpty()) Text(saved)

        HorizontalDivider()
        Text(
            "Emulator: http://10.0.2.2:5001/demo-verified-sms/asia-south1/api\n" +
                "Real phone on same Wi-Fi: http://<your-PC-IP>:5001/demo-verified-sms/asia-south1/api",
            color = Grey, fontSize = 13.sp
        )
    }
}

// ---------------- helpers ----------------

private fun initials(name: String): String =
    name.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }

private fun formatTime(millis: Long): String =
    SimpleDateFormat("dd MMM, HH:mm:ss", Locale.getDefault()).format(Date(millis))
