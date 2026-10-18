package com.universl.rcs_sms;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.util.Log;

public class VerificationApiClient {

    // Replace this with your team's real HTTPS endpoint.
    private static final String API_BASE_URL =
            "https://asia-south1-rcs-sms-e803f.cloudfunctions.net/api";

    private static final String VERIFY_HASH_URL =
            API_BASE_URL + "/verify-hash";

    private static final int CONNECT_TIMEOUT_MS = 10000;
    private static final int READ_TIMEOUT_MS = 10000;

    private static final String TAG = "VerificationApiClient";

    private final ExecutorService executor =
            Executors.newSingleThreadExecutor();

    private final Handler mainHandler =
            new Handler(Looper.getMainLooper());

    public interface Callback {
        void onSuccess(
                String status,
                String institutionId,
                String institutionName,
                String logoUrl,
                boolean institutionVerified
        );

        void onError(String message);
    }

    public void verifyHash(
            String hash,
            String recipient,
            Callback callback
    ) {
        executor.execute(() -> {
            Log.d(TAG, "Starting hash verification request");
            Log.d(TAG, "Endpoint: " + VERIFY_HASH_URL);

            HttpURLConnection connection = null;

            try {
                URL url = new URL(VERIFY_HASH_URL);
                connection = (HttpURLConnection) url.openConnection();

                connection.setRequestMethod("POST");
                connection.setRequestProperty(
                        "Content-Type", "application/json; charset=UTF-8"
                );
                connection.setRequestProperty(
                        "Accept", "application/json"
                );
                connection.setDoOutput(true);

                JSONObject requestJson = new JSONObject();
                requestJson.put("hash", hash);
                requestJson.put("recipient", recipient);

                Log.d(TAG, "Request JSON created");
                Log.d(TAG, "Request fields: hash, recipient");

                try (java.io.OutputStream os = connection.getOutputStream()) {
                    os.write(requestJson.toString().getBytes(
                            java.nio.charset.StandardCharsets.UTF_8
                    ));
                }

                Log.d(TAG, "Request sent; waiting for backend response");

                int responseCode = connection.getResponseCode();
                Log.d(TAG, "HTTP response code: " + responseCode);

                java.io.InputStream responseStream =
                        responseCode >= 200 && responseCode < 400
                                ? connection.getInputStream()
                                : connection.getErrorStream();

                if (responseStream == null) {
                    throw new java.io.IOException(
                            "Backend returned HTTP " + responseCode
                                    + " without a response body"
                    );
                }

                StringBuilder responseText = new StringBuilder();

                try (java.io.BufferedReader reader =
                             new java.io.BufferedReader(
                                     new java.io.InputStreamReader(
                                             responseStream,
                                             java.nio.charset.StandardCharsets.UTF_8
                                     ))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        responseText.append(line);
                    }
                }

                Log.d(TAG, "HTTP Response Code: " + responseCode);
                Log.d(TAG, "Full Response Body: " + responseText);

                if (responseCode < 200 || responseCode >= 300) {
                    Log.e(TAG, "Backend returned a non-success HTTP status");
                    throw new java.io.IOException(
                            "Server returned HTTP " + responseCode
                    );
                }

                JSONObject json = new JSONObject(responseText.toString());

                String status = json.optString("status", "UNKNOWN");
                Log.d(TAG, "Parsed verification status: " + status);

                if (!status.equals("VERIFIED")
                        && !status.equals("INVALID")
                        && !status.equals("EXPIRED")) {
                    status = "UNKNOWN";
                }

                JSONObject institution = json.optJSONObject("institution");

                String institutionId = "";
                String institutionName = "";
                String logoUrl = "";
                boolean institutionVerified = false;

                if (institution != null) {
                    institutionId = institution.optString("id", "");
                    institutionName = institution.optString("name", "");
                    logoUrl = institution.optString("logoUrl", "");
                    institutionVerified = institution.optBoolean("verified", false);
                }

                Log.d(TAG, "Institution object present: "
                        + (institution != null));
                Log.d(TAG, "Institution verified flag: "
                        + institutionVerified);

                final String result = status;
                final String resultId = institutionId;
                final String resultName = institutionName;
                final String resultLogoUrl = logoUrl;
                final boolean resultVerified = institutionVerified;

                mainHandler.post(() -> {
                    Log.d(TAG, "Delivering result to MainActivity callback");

                    callback.onSuccess(
                            result,
                            resultId,
                            resultName,
                            resultLogoUrl,
                            resultVerified
                    );
                });

            } catch (Exception e) {
                Log.e(TAG, "Hash verification request failed: "
                        + e.getClass().getSimpleName()
                        + ": " + e.getMessage(), e);

                mainHandler.post(() ->
                        callback.onError(
                                "Verification unavailable. Please try again."
                        )
                );

            } finally {
                if (connection != null) {
                    connection.disconnect();
                    Log.d(TAG, "HTTP connection closed");
                }
            }
        });
    }

    public void shutdown() {
        executor.shutdown();
    }
}
