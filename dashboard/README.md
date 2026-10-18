# Verified SMS — Bank Dashboard (React + Vite + TypeScript)

Visitors enter straight into a **guest demo** (no login, Firebase anonymous sign-in).
Bank admins can still sign in from the "Admin sign in" link.

Screens:

- **Send message**: recipient, message and verification window; calls `/send-verified-sms`,
  with a live preview of the verified header the customer will see.
- **Registry**: live table of registered fingerprints (Active/Expired, time left, phone checks).
  It reads Firestore directly; security rules limit each admin to their own institution.
- **Android app**: QR code + download button for the Android APK (Google Drive link in `VITE_APK_URL`).
- **Institution**: display name, SMS sender ID and logo shown to customers, plus verified status (read-only for guests).

Guest limits (enforced by the backend): 30 messages per hour, 15-minute max verification window,
and each guest sees only the messages they sent.

## Run locally (Zorin / Linux)

You need three terminals.

```bash
# Terminal 1: backend emulators (Auth, Firestore, Functions)
cd verified-sms-backend/functions
npm install
npm run serve

# Terminal 2: seed the demo bank and admin login (run again after each emulator restart)
cd verified-sms-backend/functions
npm run seed

# Terminal 3: dashboard
cd verified-sms-dashboard
npm install
npm run dev
```

Open http://localhost:5173 and sign in with `admin@demobank.lk` / `demo1234`.

## End-to-end test with the Android tester app

1. Dashboard → **Send message**: enter your phone number, click **Insert sample OTP**, then **Send verified SMS**.
2. Click **Copy message text**, paste it into the tester app's Test tab, and tap **Simulate received SMS**
   (or have someone send that exact text to your phone).
3. The phone shows the green verified card. On the dashboard's **Registry** page, that row's
   **Checks** count goes up immediately.

## Configuration

`.env.development` points at the local emulators. For deployment (Step 4), copy
`.env.example` to `.env.production` and fill in the Firebase web app config.
