import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { timingSafeEqual } from "crypto";
import { computeMessageHash, isValidHash, normalizePhone } from "./hash";

initializeApp();
const db = getFirestore();

/** API key used by test tools (the Android tester app, curl). The dashboard uses admin login. */
const ADMIN_API_KEY = defineSecret("ADMIN_API_KEY");
/** Institution used when a request is authorized by API key instead of an admin login. */
const INSTITUTION_ID = defineString("INSTITUTION_ID", { default: "demo-bank" });

const REGISTRY = "messageRegistry";
const INSTITUTIONS = "institutions";
const ADMINS = "admins";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 3600;
const MAX_MESSAGE_LENGTH = 1600; // ~10 concatenated SMS parts

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "16kb" }));

// ---------- helpers ----------

function badRequest(res: Response, message: string) {
  res.status(400).json({ error: message });
}

function apiKeyMatches(provided: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_API_KEY.value());
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Bank-only endpoints. Accepts either:
 *  - Authorization: Bearer <Firebase ID token> of a user listed in admins/{uid}  (web dashboard)
 *  - x-api-key: <ADMIN_API_KEY>                                                   (test tools)
 * Sets res.locals.institutionId and res.locals.actor.
 */
async function requireBankAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization") ?? "";

  if (authHeader.startsWith("Bearer ")) {
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      const admin = await db.collection(ADMINS).doc(decoded.uid).get();
      if (!admin.exists) {
        res.status(403).json({ error: "This account is not a bank admin" });
        return;
      }
      res.locals.institutionId = admin.get("institutionId");
      res.locals.actor = decoded.email ?? decoded.uid;
      next();
      return;
    } catch {
      res.status(401).json({ error: "Session expired. Sign in again." });
      return;
    }
  }

  if (apiKeyMatches(req.header("x-api-key") ?? "")) {
    res.locals.institutionId = INSTITUTION_ID.value();
    res.locals.actor = "api-key";
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

type RegisterInput = { recipient: unknown; message: unknown; ttlSeconds: unknown };
type Registered = { hash: string; recipient: string; createdAt: Timestamp; expiresAt: Timestamp };

/** Validates input and writes the hash to the registry (registerHashToAMR). */
async function registerMessage(
  input: RegisterInput,
  institutionId: string,
  actor: string
): Promise<Registered | string> {
  const { recipient, message, ttlSeconds } = input;

  if (typeof recipient !== "string" || typeof message !== "string") {
    return "recipient and message are required strings";
  }
  if (message.trim().length === 0 || message.length > MAX_MESSAGE_LENGTH) {
    return `message must be 1-${MAX_MESSAGE_LENGTH} characters`;
  }

  let phone: string;
  try {
    phone = normalizePhone(recipient);
  } catch {
    return "recipient is not a valid phone number";
  }

  const requested = typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) ? ttlSeconds : DEFAULT_TTL_SECONDS;
  const ttl = Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.round(requested)));

  const hash = computeMessageHash(phone, message);
  const createdAt = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + ttl * 1000);

  // Document ID = hash, so verification is a single direct read (no query needed).
  // The message text itself is never stored — only its hash.
  await db.collection(REGISTRY).doc(hash).set({
    hash,
    recipient: phone,
    institutionId,
    createdBy: actor,
    createdAt,
    expiresAt,
    ttlSeconds: ttl,
    queryHits: 0,
    lastQueriedAt: null,
  });

  logger.info("Registered hash", { hash, recipient: phone, institutionId, ttl });
  return { hash, recipient: phone, createdAt, expiresAt };
}

/**
 * sendLegacySMS — placeholder until an SMS gateway is connected (Step 6).
 * Replace the body with a gateway call (e.g. Twilio or a local bulk SMS provider).
 */
async function sendLegacySms(recipient: string, _message: string): Promise<{ status: string; detail: string }> {
  logger.info("SMS gateway not configured; message not sent", { recipient });
  return {
    status: "NOT_CONFIGURED",
    detail: "No SMS gateway connected yet. Send the exact same text to the recipient manually.",
  };
}

// ---------- Endpoint: send a verified SMS (web dashboard) ----------
//
// POST /send-verified-sms
// headers: Authorization: Bearer <ID token>
// body:    { "recipient": "0771234567", "message": "...", "ttlSeconds": 300 }
app.post("/send-verified-sms", requireBankAuth, async (req: Request, res: Response) => {
  const result = await registerMessage(req.body ?? {}, res.locals.institutionId, res.locals.actor);
  if (typeof result === "string") return badRequest(res, result);

  const sms = await sendLegacySms(result.recipient, req.body.message);
  return res.status(201).json({
    hash: result.hash,
    recipient: result.recipient,
    createdAt: result.createdAt.toDate().toISOString(),
    expiresAt: result.expiresAt.toDate().toISOString(),
    sms,
  });
});

// ---------- Endpoint 1: register a message hash only ----------
//
// POST /register-hash
// headers: Authorization: Bearer <ID token>   or   x-api-key: <ADMIN_API_KEY>
// body:    { "recipient": "0771234567", "message": "Your OTP code is 88219", "ttlSeconds": 300 }
app.post("/register-hash", requireBankAuth, async (req: Request, res: Response) => {
  const result = await registerMessage(req.body ?? {}, res.locals.institutionId, res.locals.actor);
  if (typeof result === "string") return badRequest(res, result);

  return res.status(201).json({
    hash: result.hash,
    recipient: result.recipient,
    expiresAt: result.expiresAt.toDate().toISOString(),
  });
});

// ---------- Endpoint 2: verify a hash (called silently by the Android app) ----------
//
// POST /verify-hash
// body: { "hash": "<64 hex chars>", "recipient": "+94771234567" }
// returns: { "status": "VERIFIED" | "INVALID" | "EXPIRED", "institution"?: {...} }
app.post("/verify-hash", async (req: Request, res: Response) => {
  const { hash, recipient } = req.body ?? {};

  if (!isValidHash(hash) || typeof recipient !== "string") {
    return badRequest(res, "hash (64 hex chars) and recipient are required");
  }

  let phone: string;
  try {
    phone = normalizePhone(recipient);
  } catch {
    return badRequest(res, "recipient is not a valid phone number");
  }

  const ref = db.collection(REGISTRY).doc(hash.toLowerCase());
  const snap = await ref.get();

  if (!snap.exists || snap.get("recipient") !== phone) {
    return res.json({ status: "INVALID" });
  }

  await ref.update({
    queryHits: FieldValue.increment(1),
    lastQueriedAt: FieldValue.serverTimestamp(),
  });

  const expiresAt = snap.get("expiresAt") as Timestamp;
  if (expiresAt.toMillis() < Date.now()) {
    return res.json({ status: "EXPIRED" });
  }

  const institutionId = snap.get("institutionId") as string;
  const inst = await db.collection(INSTITUTIONS).doc(institutionId).get();

  return res.json({
    status: "VERIFIED",
    institution: {
      id: institutionId,
      name: inst.get("name") ?? institutionId,
      logoUrl: inst.get("logoUrl") ?? null,
      verified: inst.get("verified") ?? false,
    },
  });
});

// ---------- health check & error handler ----------

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal error" });
});

// Mumbai region: closest Google Cloud region to Sri Lanka.
export const api = onRequest(
  { region: "asia-south1", secrets: [ADMIN_API_KEY], maxInstances: 5 },
  app
);
