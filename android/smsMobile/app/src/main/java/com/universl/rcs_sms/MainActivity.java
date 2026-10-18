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

import android.content.SharedPreferences;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;

import java.util.List;

public class MainActivity extends AppCompatActivity {

    private RecyclerView smsRecyclerView;
    private TextView inboxMessage;
    private SmsAdapter smsAdapter;
    private final List<SmsItem> smsList = new ArrayList<>();
    private VerificationApiClient apiClient = new VerificationApiClient();
    private EditText mobileNumberInput;
    private Button saveMobileNumberButton;
    private LinearLayout phoneNumberSection;

    private static final String PREFS_NAME = "SmsVerifierPrefs";
    private static final String KEY_RECIPIENT_NUMBER = "recipient_number";

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
        //requestPhoneNumberPermission();
        setContentView(R.layout.activity_main);

        mobileNumberInput = findViewById(R.id.mobileNumberInput);
        saveMobileNumberButton = findViewById(R.id.saveMobileNumberButton);
        phoneNumberSection = findViewById(R.id.phoneNumberSection);

        SharedPreferences prefs =
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        String savedNumber = prefs.getString(KEY_RECIPIENT_NUMBER, null);

        if (savedNumber != null) {
            mobileNumberInput.setText(savedNumber);
            phoneNumberSection.setVisibility(View.GONE);
        }

        saveMobileNumberButton.setOnClickListener(v -> saveMobileNumber());

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

    private void saveMobileNumber() {
        String enteredNumber = mobileNumberInput.getText()
                .toString()
                .trim();

        try {
            String normalizedNumber =
                    HashGenerator.normalizePhone(enteredNumber);

            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putString(KEY_RECIPIENT_NUMBER, normalizedNumber)
                    .apply();

            mobileNumberInput.setText(normalizedNumber);
            phoneNumberSection.setVisibility(View.GONE);

            Toast.makeText(
                    this,
                    "Mobile number saved",
                    Toast.LENGTH_SHORT
            ).show();

        } catch (IllegalArgumentException e) {
            mobileNumberInput.setError(
                    "Enter a valid mobile number"
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
        SharedPreferences prefs =
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        String recipient = prefs.getString(KEY_RECIPIENT_NUMBER, null);

        if (recipient == null || recipient.isEmpty()) {
            phoneNumberSection.setVisibility(View.VISIBLE);

            Toast.makeText(
                    this,
                    "Please save your mobile number first",
                    Toast.LENGTH_SHORT
            ).show();

            return;
        }

        sms.setVerificationStatus("CHECKING");
        smsAdapter.notifyDataSetChanged();

        String hash = HashGenerator.generateMessageHash(
                recipient,
                sms.getBody(),
                sms.getTimestamp()
        );

        apiClient.verifyHash(hash, recipient,
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
                        sms.setVerificationStatus(
                                "UNAVAILABLE - retry later"
                        );
                        smsAdapter.notifyDataSetChanged();
                    }
                });
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