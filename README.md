# RCS SMS: Verified SMS Anti-Phishing Prototype

Banks register a SHA-256 fingerprint of each SMS in a cloud registry; the customer's
Android app fingerprints incoming SMS and checks it, showing Verified / Unverified / Expired.

| Folder | What | Owner |
|---|---|---|
| `backend/` | Firebase Cloud Functions + Firestore registry | Rayan |
| `dashboard/` | Bank admin web console (React + Vite) | Rayan |
| `android/` | Customer Android app | Didul |
| `android-tester/` | Test app used to prove the flow end to end | Rayan |
| `docs/` | Hash contract and Android integration guide | |

Live:
- API: https://asia-south1-rcs-sms-e803f.cloudfunctions.net/api
- Dashboard: https://rcs-sms-e803f.web.app

See each folder's README for setup.
