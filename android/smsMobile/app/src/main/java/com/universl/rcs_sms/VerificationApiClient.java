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

public class VerificationApiClient {

    // Replace this with your team's real HTTPS endpoint.
    private static final String API_BASE_URL =
            "https://asia-south1-rcs-sms-e803f.cloudfunctions.net/api";

    private static final String VERIFY_HASH_URL =
            API_BASE_URL + "/verify-hash";

    private static final int CONNECT_TIMEOUT_MS = 10000;
    private static final int READ_TIMEOUT_MS = 10000;

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
            HttpURLConnection connection = null;

            try {
                URL url = new URL(VERIFY_HASH_URL);
                connection =
                        (HttpURLConnection) url.openConnection();

                connection.setRequestMethod("POST");
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setDoOutput(true);

                connection.setRequestProperty(
                        "Content-Type",
                        "application/json; charset=UTF-8"
                );
                connection.setRequestProperty(
                        "Accept",
                        "application/json"
                );

                JSONObject requestBody = new JSONObject();
                requestBody.put("hash", hash);
                requestBody.put("recipient", recipient);

                byte[] requestBytes = requestBody.toString()
                        .getBytes(StandardCharsets.UTF_8);

                try (OutputStream output =
                             connection.getOutputStream()) {
                    output.write(requestBytes);
                }

                int responseCode =
                        connection.getResponseCode();

                InputStream responseStream =
                        responseCode >= 200 && responseCode < 300
                                ? connection.getInputStream()
                                : connection.getErrorStream();

                StringBuilder responseText = new StringBuilder();

                if (responseStream != null) {
                    try (InputStream input = responseStream;
                         BufferedReader reader =
                                 new BufferedReader(
                                         new InputStreamReader(
                                                 input,
                                                 StandardCharsets.UTF_8
                                         )
                                 )) {

                        String line;

                        while ((line = reader.readLine()) != null) {
                            responseText.append(line);
                        }
                    }
                }

                if (responseCode < 200 || responseCode >= 300) {
                    throw new Exception(
                            "Server returned HTTP "
                                    + responseCode
                    );
                }

                JSONObject json = new JSONObject(responseText.toString());

                String status = json.optString("status", "UNKNOWN");

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

                final String result = status;
                final String resultId = institutionId;
                final String resultName = institutionName;
                final String resultLogoUrl = logoUrl;
                final boolean resultVerified = institutionVerified;

                mainHandler.post(() -> callback.onSuccess(
                        result,
                        resultId,
                        resultName,
                        resultLogoUrl,
                        resultVerified
                ));

            } catch (Exception e) {
                mainHandler.post(
                        () -> callback.onError(
                                "Verification unavailable. "
                                        + "Please try again."
                        )
                );

            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    public void shutdown() {
        executor.shutdown();
    }
}
