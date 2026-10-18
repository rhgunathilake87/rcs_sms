# Verified SMS Tester (Android)

Test app used to prove the system end to end. It receives SMS, computes the hash locally,
calls `/verify-hash`, and shows Verified / Unverified / Expired.

- Settings: your phone number + backend URL
  `https://asia-south1-rcs-sms-e803f.cloudfunctions.net/api`
- Test tab: "Simulate received SMS" runs the same flow without a real SMS.
- "Register as bank" needs the bank API key. It is TEST ONLY and is never stored in code.

The production customer app is in `../android/`.
