import { onRequest } from "firebase-functions/v2/https";
import { defineInt, defineSecret, defineString } from "firebase-functions/params";
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

/** API key used by test tools (the Android tester app, curl). The dashboard uses Firebase Auth. */
const ADMIN_API_KEY = defineSecret("ADMIN_API_KEY");
/** Institution used when a request is authorized by API key. */
const INSTITUTION_ID = defineString("INSTITUTION_ID", { default: "demo-bank" });

/** Guest demo mode: anonymous dashboard visitors can send messages as this institution. */
const GUEST_MODE = defineString("GUEST_MODE", { default: "true" });
const GUEST_INSTITUTION_ID = defineString("GUEST_INSTITUTION_ID", { default: "demo-bank" });
const GUEST_HOURLY_LIMIT = defineInt("GUEST_HOURLY_LIMIT", { default: 30 });

const REGISTRY = "messageRegistry";
const INSTITUTIONS = "institutions";
const ADMINS = "admins";
const GUEST_USAGE = "guestUsage";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 3600;
const GUEST_MAX_TTL_SECONDS = 900; // 15 minutes
const MAX_MESSAGE_LENGTH = 1600; // ~10 concatenated SMS parts
const GUEST_MAX_MESSAGE_LENGTH = 320; // 2 SMS parts

type Role = "admin" | "guest" | "apiKey";
type Caller = { role: Role; institutionId: string; actor: string; uid: string };

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
 * Bank-side endpoints. Accepts:
 *  - Authorization: Bearer <ID token> of a user listed in admins/{uid}   -> role "admin"
 *  - Authorization: Bearer <ID token> of an anonymous user (guest mode) -> role "guest"
 *  - x-api-key: <ADMIN_API_KEY>                                         -> role "apiKey" (test tools)
 * Puts the Caller on res.locals.caller.
 */
async function requireBankAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization") ?? "";

  if (authHeader.startsWith("Bearer ")) {
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      res.status(401).json({ error: "Session expired. Reload the page." });
      return;
    }

    const admin = await db.collection(ADMINS).doc(decoded.uid).get();
    if (admin.exists) {
      res.locals.caller = {
        role: "admin",
        institutionId: admin.get("institutionId"),
        actor: decoded.email ?? decoded.uid,
        uid: decoded.uid,
      } satisfies Caller;
      next();
      return;
    }

    if (decoded.firebase?.sign_in_provider === "anonymous" && GUEST_MODE.value() === "true") {
      res.locals.caller = {
        role: "guest",
        institutionId: GUEST_INSTITUTION_ID.value(),
        actor: "guest",
        uid: decoded.uid,
      } satisfies Caller;
      next();
      return;
    }

    res.status(403).json({ error: "This account is not allowed to send messages." });
    return;
  }

  if (apiKeyMatches(req.header("x-api-key") ?? "")) {
    res.locals.caller = {
      role: "apiKey",
      institutionId: INSTITUTION_ID.value(),
      actor: "api-key",
      uid: "api-key",
    } satisfies Caller;
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

/** Per-guest rate limit: GUEST_HOURLY_LIMIT messages per rolling hour window. */
async function consumeGuestQuota(uid: string): Promise<boolean> {
  const ref = db.collection(GUEST_USAGE).doc(uid);
  const limit = GUEST_HOURLY_LIMIT.value();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    let windowStart = snap.exists ? (snap.get("windowStart") as number) : now;
    let count = snap.exists ? (snap.get("count") as number) : 0;
    if (now - windowStart > 3_600_000) {
      windowStart = now;
      count = 0;
    }
    if (count >= limit) return false;
    tx.set(ref, { windowStart, count: count + 1 });
    return true;
  });
}

type RegisterInput = { recipient: unknown; message: unknown; ttlSeconds: unknown };
type Registered = { hash: string; recipient: string; createdAt: Timestamp; expiresAt: Timestamp };

/** Validates input and writes the hash to the registry (registerHashToAMR). */
async function registerMessage(input: RegisterInput, caller: Caller): Promise<Registered | string> {
  const { recipient, message, ttlSeconds } = input;
  const isGuest = caller.role === "guest";
  const maxLength = isGuest ? GUEST_MAX_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH;
  const maxTtl = isGuest ? GUEST_MAX_TTL_SECONDS : MAX_TTL_SECONDS;

  if (typeof recipient !== "string" || typeof message !== "string") {
    return "recipient and message are required strings";
  }
  if (message.trim().length === 0 || message.length > maxLength) {
    return `message must be 1-${maxLength} characters`;
  }

  let phone: string;
  try {
    phone = normalizePhone(recipient);
  } catch {
    return "recipient is not a valid phone number";
  }

  const requested = typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) ? ttlSeconds : DEFAULT_TTL_SECONDS;
  const ttl = Math.min(maxTtl, Math.max(MIN_TTL_SECONDS, Math.round(requested)));

  const hash = computeMessageHash(phone, message);
  const createdAt = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + ttl * 1000);

  // Document ID = hash, so verification is a single direct read (no query needed).
  // The message text itself is never stored — only its hash.
  await db.collection(REGISTRY).doc(hash).set({
    hash,
    recipient: phone,
    institutionId: caller.institutionId,
    createdBy: caller.actor,
    createdByUid: caller.uid,
    createdAt,
    expiresAt,
    ttlSeconds: ttl,
    queryHits: 0,
    lastQueriedAt: null,
  });

  logger.info("Registered hash", { hash, recipient: phone, institutionId: caller.institutionId, role: caller.role, ttl });
  return { hash, recipient: phone, createdAt, expiresAt };
}

/** Shared handler for the two register endpoints. Returns the result or sends an error. */
async function handleRegister(req: Request, res: Response): Promise<Registered | null> {
  const caller = res.locals.caller as Caller;

  if (caller.role === "guest" && !(await consumeGuestQuota(caller.uid))) {
    res.status(429).json({ error: "Demo limit reached: 30 messages per hour. Please try again later." });
    return null;
  }

  const result = await registerMessage(req.body ?? {}, caller);
  if (typeof result === "string") {
    badRequest(res, result);
    return null;
  }
  return result;
}

/**
 * sendLegacySMS — placeholder until an SMS gateway is connected.
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
// headers: Authorization: Bearer <ID token>   (admin or guest)
// body:    { "recipient": "0771234567", "message": "...", "ttlSeconds": 300 }
app.post("/send-verified-sms", requireBankAuth, async (req: Request, res: Response) => {
  const result = await handleRegister(req, res);
  if (!result) return;

  const sms = await sendLegacySms(result.recipient, req.body.message);
  res.status(201).json({
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
  const result = await handleRegister(req, res);
  if (!result) return;

  res.status(201).json({
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
