import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMessageHash, normalizePhone, normalizeBody } from "./hash";

test("phone formats all normalize to the same E.164", () => {
  for (const p of ["0771234567", "+94771234567", "94771234567", "0094771234567", "771234567", "+94 77 123 4567"]) {
    assert.equal(normalizePhone(p), "+94771234567");
  }
});

test("rejects garbage phone numbers", () => {
  assert.throws(() => normalizePhone("abc"));
  assert.throws(() => normalizePhone("123"));
});

test("body normalization", () => {
  assert.equal(normalizeBody("  Hello\r\nWorld \n"), "Hello\nWorld");
});

test("contract test vectors (share these with the Android dev)", () => {
  assert.equal(
    computeMessageHash("+94771234567", "Your OTP code is 88219"),
    "cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa"
  );
  assert.equal(
    computeMessageHash("0771234567", "  Your OTP code is 88219\r\n"),
    "cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa"
  );
  assert.equal(
    computeMessageHash("+94771234567", "ඔබගේ OTP අංකය 88219"),
    "cb2545e69b91ba15f3dac3b5d19deaa93f91106ba9eb2706fc36cc7962253bc3"
  );
});
