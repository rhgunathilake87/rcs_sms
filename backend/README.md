# Verified SMS — Backend (Firebase / Google Cloud)

- Firestore: `messageRegistry` (hashes), `institutions`, `admins`
- Cloud Function `api` (asia-south1) with these routes:
  - `POST /send-verified-sms`: dashboard (admin login). Registers the hash and calls the SMS gateway stub.
  - `POST /register-hash`: register only (admin login or `x-api-key`, used by the tester app and curl)
  - `POST /verify-hash`: Android app, public
  - `GET  /health`
- Auth emulator for bank admin logins

## Prerequisites

Node.js 22+, Java 11+ (for the emulators), and `npm install -g firebase-tools`.

## Run locally

```bash
cd functions
npm install
cp .secret.local.example .secret.local
npm test            # hash contract tests
npm run serve       # Auth :9099, Firestore :8080, Functions :5001, UI :4000
npm run seed        # in a 2nd terminal; re-run after every emulator restart
```

The seed creates the institution `demo-bank` (Demo Bank PLC) and the admin login
`admin@demobank.lk` / `demo1234`.

## Quick checks

```bash
BASE=http://127.0.0.1:5001/demo-verified-sms/asia-south1/api
curl -X POST $BASE/register-hash -H "Content-Type: application/json" \
  -H "x-api-key: change-me-to-a-long-random-string" \
  -d '{"recipient":"0771234567","message":"Your OTP code is 88219"}'
curl -X POST $BASE/verify-hash -H "Content-Type: application/json" \
  -d '{"hash":"cba327bc12ec12de2ac70d620a2e69f3ff99c146b9d34c3ba25a5371dbb267fa","recipient":"+94771234567"}'
```

## Data model

`messageRegistry/{hash}`: hash, recipient (E.164), institutionId, createdBy, createdAt, expiresAt,
ttlSeconds, queryHits, lastQueriedAt. The message text itself is never stored.

`institutions/{id}`: name, logoUrl, senderId, verified

`admins/{uid}`: email, institutionId

See `HASH_CONTRACT.md` for the Android side.
