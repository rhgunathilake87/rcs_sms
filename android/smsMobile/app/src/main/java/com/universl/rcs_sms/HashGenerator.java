package com.universl.rcs_sms;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.Locale;

public final class HashGenerator {

    private static final String VERSION = "v1";
    private static final String DEFAULT_COUNTRY_CODE = "94";

    private HashGenerator() {
    }

    public static String normalizePhone(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("Phone number cannot be null");
        }

        String trimmed = raw.trim();
        String digits = trimmed.replaceAll("[^0-9]", "");

        final String e164;

        if (trimmed.startsWith("+")) {
            e164 = "+" + digits;
        } else if (digits.startsWith("00")) {
            e164 = "+" + digits.substring(2);
        } else if (digits.startsWith("0")) {
            e164 = "+" + DEFAULT_COUNTRY_CODE
                    + digits.substring(1);
        } else if (digits.startsWith(DEFAULT_COUNTRY_CODE)
                && digits.length() > 9) {
            e164 = "+" + digits;
        } else {
            e164 = "+" + DEFAULT_COUNTRY_CODE + digits;
        }

        if (!e164.matches("^\\+\\d{8,15}$")) {
            throw new IllegalArgumentException(
                    "Invalid phone number: " + raw
            );
        }

        return e164;
    }

    public static String normalizeBody(String body) {
        if (body == null) {
            throw new IllegalArgumentException(
                    "Message body cannot be null"
            );
        }

        return Normalizer.normalize(body, Normalizer.Form.NFC)
                .replaceAll("\\r\\n?", "\n")
                .trim();
    }

    public static String buildPayload(String recipient, String body) {
        return VERSION + "|"
                + normalizePhone(recipient) + "|"
                + normalizeBody(body);
    }

    public static String sha256(String input) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder(bytes.length * 2);

            for (byte b : bytes) {
                hex.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            }

            return hex.toString();

        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable", e
            );
        }
    }

    public static String generateMessageHash(
            String recipient,
            String body,
            long timestamp
    ) {
        // Timestamp is deliberately excluded in Hash Contract v1.
        return sha256(buildPayload(recipient, body));
    }
}
