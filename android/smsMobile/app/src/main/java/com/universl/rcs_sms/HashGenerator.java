package com.universl.rcs_sms;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

public final class HashGenerator {

    private HashGenerator() {
        // Utility class: no instances needed.
    }

    /**
     * Builds a deterministic payload for hashing.
     *
     * This is a prototype format. The backend must use
     * exactly the same field order and separators.
     */
    public static String buildPayload(
            String recipient,
            String messageBody,
            long timestamp
    ) {
        if (recipient == null || recipient.isEmpty()) {
            throw new IllegalArgumentException(
                    "Recipient cannot be empty"
            );
        }

        if (messageBody == null) {
            throw new IllegalArgumentException(
                    "Message body cannot be null"
            );
        }

        return "v1\n"
                + recipient + "\n"
                + timestamp + "\n"
                + messageBody;
    }

    /**
     * Calculates a SHA-256 hash and returns 64 lowercase
     * hexadecimal characters.
     */
    public static String sha256(String input) {
        if (input == null) {
            throw new IllegalArgumentException(
                    "Input cannot be null"
            );
        }

        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hashBytes = digest.digest(
                    input.getBytes(StandardCharsets.UTF_8)
            );

            StringBuilder hex = new StringBuilder(
                    hashBytes.length * 2
            );

            for (byte b : hashBytes) {
                hex.append(
                        String.format(
                                Locale.ROOT,
                                "%02x",
                                b & 0xff
                        )
                );
            }

            return hex.toString();

        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable", e
            );
        }
    }

    /**
     * Convenience method for generating the message hash.
     */
    public static String generateMessageHash(
            String recipient,
            String messageBody,
            long timestamp
    ) {
        String payload = buildPayload(
                recipient,
                messageBody,
                timestamp
        );

        return sha256(payload);
    }
}