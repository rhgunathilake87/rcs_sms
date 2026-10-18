package com.universl.rcs_sms;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Telephony;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.text.TextUtils;

import java.util.List;

public class MainActivity extends AppCompatActivity {

    private RecyclerView smsRecyclerView;
    private TextView inboxMessage;
    private SmsAdapter smsAdapter;
    private final List<SmsItem> smsList = new ArrayList<>();
    private VerificationApiClient apiClient = new VerificationApiClient();

    private final ActivityResultLauncher<String> smsPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestPermission(),
                    granted -> {
                        if (granted) {
                            loadInboxMessages();
                        } else {
                            inboxMessage.setText(
                                    "SMS permission was denied. " +
                                            "Allow SMS access to load your inbox."
                            );
                        }
                    }
            );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestPhoneNumberPermission();
        setContentView(R.layout.activity_main);

        smsRecyclerView = findViewById(R.id.smsRecyclerView);
        inboxMessage = findViewById(R.id.inboxMessage);

        smsRecyclerView.setLayoutManager(
                new LinearLayoutManager(this)
        );

        smsAdapter = new SmsAdapter(smsList, this::verifySms);
        smsRecyclerView.setAdapter(smsAdapter);

        if (ContextCompat.checkSelfPermission(
                this, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED) {
            loadInboxMessages();
        } else {
            smsPermissionLauncher.launch(Manifest.permission.READ_SMS);
        }
    }

    private void loadInboxMessages() {
        smsList.clear();

        Uri inboxUri = Telephony.Sms.Inbox.CONTENT_URI;

        String[] projection = {
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
        };

        try (Cursor cursor = getContentResolver().query(
                inboxUri,
                projection,
                null,
                null,
                Telephony.Sms.DATE + " DESC"
        )) {
            if (cursor == null) {
                inboxMessage.setText("Unable to read the SMS inbox.");
                return;
            }

            int senderColumn =
                    cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS);
            int bodyColumn =
                    cursor.getColumnIndexOrThrow(Telephony.Sms.BODY);
            int dateColumn =
                    cursor.getColumnIndexOrThrow(Telephony.Sms.DATE);

            while (cursor.moveToNext()) {
                String sender = cursor.getString(senderColumn);
                String body = cursor.getString(bodyColumn);
                long timestamp = cursor.getLong(dateColumn);

                smsList.add(new SmsItem(sender, body, timestamp));
            }

        } catch (SecurityException e) {
            inboxMessage.setText("SMS access was denied.");
            return;
        } catch (Exception e) {
            inboxMessage.setText("Could not load SMS messages.");
            return;
        }

        smsAdapter.notifyDataSetChanged();

        if (smsList.isEmpty()) {
            inboxMessage.setText("No messages found in the SMS inbox.");
        } else {
            inboxMessage.setText(
                    "Loaded " + smsList.size() + " messages"
            );
        }
    }

    private String getPhoneNumberFromSim() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(
                    android.Manifest.permission.READ_PHONE_NUMBERS)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return null;
            }
        }

        try {
            TelephonyManager telephonyManager =
                    (TelephonyManager) getSystemService(TELEPHONY_SERVICE);

            if (telephonyManager != null) {
                String number = telephonyManager.getLine1Number();

                if (!TextUtils.isEmpty(number)) {
                    return number;
                }
            }
        } catch (SecurityException e) {
            // Permission is missing.
        }

        return null;
    }

    private void requestPhoneNumberPermission() {
        if (android.os.Build.VERSION.SDK_INT >=
                android.os.Build.VERSION_CODES.O &&
                checkSelfPermission(
                        android.Manifest.permission.READ_PHONE_NUMBERS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {

            requestPermissions(
                    new String[]{
                            android.Manifest.permission.READ_PHONE_NUMBERS
                    },
                    200
            );
        }
    }

    private void verifySms(SmsItem sms) {
        String recipient = getPhoneNumberFromSim();

        if (recipient == null || recipient.trim().isEmpty()) {
            Toast.makeText(
                    this,
                    "Could not detect your phone number. Please enter it manually.",
                    Toast.LENGTH_LONG
            ).show();
            return;
        }

        sms.setVerificationStatus("CHECKING");
        smsAdapter.notifyDataSetChanged();

        try {
            String hash = HashGenerator.generateMessageHash(
                    recipient,
                    sms.getBody(),
                    sms.getTimestamp()
            );

            apiClient.verifyHash(
                    hash,
                    recipient,
                    new VerificationApiClient.Callback() {
                        @Override
                        public void onSuccess(
                                String status,
                                String institutionId,
                                String institutionName,
                                String logoUrl,
                                boolean institutionVerified
                        ) {
                            sms.setVerificationStatus(status);

                            sms.setInstitutionDetails(
                                    institutionId,
                                    institutionName,
                                    logoUrl,
                                    institutionVerified
                            );

                            smsAdapter.notifyDataSetChanged();
                        }

                        @Override
                        public void onError(String message) {
                            sms.setVerificationStatus("UNAVAILABLE - retry later");
                            smsAdapter.notifyDataSetChanged();
                        }
                    }
            );

        } catch (Exception e) {
            sms.setVerificationStatus("UNAVAILABLE - retry later");
            smsAdapter.notifyDataSetChanged();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (smsRecyclerView != null &&
                ContextCompat.checkSelfPermission(
                        this, Manifest.permission.READ_SMS
                ) == PackageManager.PERMISSION_GRANTED) {
            loadInboxMessages();
        }
    }

    @Override
    protected void onDestroy() {
        apiClient.shutdown();
        super.onDestroy();
    }
}