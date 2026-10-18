import { API_BASE, auth } from "./firebase";

export type SendResult = {
  hash: string;
  recipient: string;
  createdAt: string;
  expiresAt: string;
  sms: { status: string; detail: string };
};

/** Registers the hash and (once a gateway is connected) sends the SMS. */
export async function sendVerifiedSms(input: {
  recipient: string;
  message: string;
  ttlSeconds: number;
}): Promise<SendResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("You're signed out. Sign in again to send messages.");
  const token = await user.getIdToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/send-verified-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(`Can't reach the backend at ${API_BASE}. Check that the emulators are running.`);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  return body as SendResult;
}
