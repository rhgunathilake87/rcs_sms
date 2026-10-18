package com.universl.rcs_sms;

import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MockVerificationService {

    private final ExecutorService executor =
            Executors.newSingleThreadExecutor();

    private final Handler mainHandler =
            new Handler(Looper.getMainLooper());

    public interface Callback {
        void onResult(String status);
    }

    public void verify(
            String hash,
            String recipient,
            String simulatedStatus,
            Callback callback
    ) {
        executor.execute(() -> {
            String status;

            if (hash == null || hash.length() != 64
                    || recipient == null
                    || recipient.trim().isEmpty()) {
                status = "UNKNOWN";
            } else if ("VERIFIED".equals(simulatedStatus)
                    || "INVALID".equals(simulatedStatus)
                    || "EXPIRED".equals(simulatedStatus)) {
                status = simulatedStatus;
            } else {
                status = "UNKNOWN";
            }

            final String result = status;

            mainHandler.post(() -> callback.onResult(result));
        });
    }

    public void shutdown() {
        executor.shutdown();
    }
}

