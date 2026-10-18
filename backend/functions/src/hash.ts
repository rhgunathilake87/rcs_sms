import { createHash } from "crypto";

/**
 * HASH CONTRACT v1 — must match the Android app byte for byte.
 *
 *   input  = "v1|" + normalizePhone(recipient) + "|" + normalizeBody(message)
 *   output = lowercase hex SHA-256 of the UTF-8 bytes of input
 */
export const HASH_VERSION = "v1";

const E164 = /^\+\d{8,15}$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;

/** Converts local or international formats to E.164 (default country: Sri Lanka, +94). */
export function normalizePhone(raw: string, defaultCountryCode = "94"): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  let e164: string;
  if (hasPlus) e164 = "+" + digits;                                   // +94 77 123 4567
  else if (digits.startsWith("00")) e164 = "+" + digits.slice(2);       // 0094771234567
  else if (digits.startsWith("0")) e164 = "+" + defaultCountryCode + digits.slice(1); // 0771234567
  else if (digits.startsWith(defaultCountryCode) && digits.length > 9) e164 = "+" + digits; // 94771234567
  else e164 = "+" + defaultCountryCode + digits;                        // 771234567

  if (!E164.test(e164)) throw new Error(`Invalid phone number: ${raw}`);
  return e164;
}

/** Unicode NFC, CRLF/CR -> LF, trim leading/trailing whitespace. Inner text untouched. */
export function normalizeBody(body: string): string {
  return body.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

export function computeMessageHash(recipient: string, message: string): string {
  const input = `${HASH_VERSION}|${normalizePhone(recipient)}|${normalizeBody(message)}`;
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function isValidHash(value: unknown): value is string {
  return typeof value === "string" && HEX64.test(value);
}
