import { FormEvent, useState } from "react";
import { sendVerifiedSms, SendResult } from "../api";
import { PhonePreview } from "../components/PhonePreview";
import { useReadySession } from "../session";
import { formatClock, formatPhone, smsSegments } from "../util";

const ALL_TTL_OPTIONS = [
  { seconds: 60, label: "1 minute" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 3600, label: "1 hour" },
];
const GUEST_MAX_TTL = 900;
const GUEST_MAX_LENGTH = 320;

export function SendPage() {
  const { institution, role } = useReadySession();
  const isGuest = role === "guest";
  const ttlOptions = isGuest ? ALL_TTL_OPTIONS.filter((o) => o.seconds <= GUEST_MAX_TTL) : ALL_TTL_OPTIONS;
  const maxLength = isGuest ? GUEST_MAX_LENGTH : 1600;

  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState(300);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [sentText, setSentText] = useState("");
  const [copied, setCopied] = useState(false);

  const seg = smsSegments(message);

  function insertOtp() {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const minutes = Math.round(ttlSeconds / 60);
    setMessage(
      `Your ${institution.name} OTP is ${code}. Valid for ${minutes} minute${minutes === 1 ? "" : "s"}. Never share it with anyone.`
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const r = await sendVerifiedSms({ recipient, message, ttlSeconds });
      setResult(r);
      setSentText(message.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(sentText);
    setCopied(true);
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Send a verified message</h1>
        <p>
          The registry stores a fingerprint of the message for the recipient's number. Their phone checks it
          the moment the SMS arrives.
        </p>
      </header>

      <div className="send-grid">
        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>Recipient's mobile number</span>
            <input
              inputMode="tel"
              placeholder="077 123 4567"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
            />
            {isGuest && <small className="field-note">Use your own number to try it on your phone.</small>}
          </label>

          <label className="field">
            <span className="field-row">
              Message
              <button type="button" className="link-btn" onClick={insertOtp}>
                Insert sample OTP
              </button>
            </span>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={maxLength}
            />
            <small className="field-note">
              {[...message].length} characters, {seg.parts} SMS part{seg.parts === 1 ? "" : "s"}
              {seg.unicode ? " (Unicode: 70 characters per SMS)" : ""}
            </small>
          </label>

          <label className="field">
            <span>Verification window</span>
            <select value={ttlSeconds} onChange={(e) => setTtlSeconds(Number(e.target.value))}>
              {ttlOptions.map((o) => (
                <option key={o.seconds} value={o.seconds}>
                  {o.label}
                </option>
              ))}
            </select>
            <small className="field-note">After this, the customer's phone shows the message as expired.</small>
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Send verified SMS"}
          </button>

          {result && (
            <div className="result" role="status">
              <h2>Registered for {formatPhone(result.recipient)}</h2>
              <dl>
                <dt>Fingerprint</dt>
                <dd className="mono wrap">{result.hash}</dd>
                <dt>Valid until</dt>
                <dd>{formatClock(Date.parse(result.expiresAt))}</dd>
                <dt>SMS delivery</dt>
                <dd>
                  {result.sms.status === "NOT_CONFIGURED" ? (
                    <>
                      No SMS gateway is connected yet. Send this exact text to the recipient's phone by SMS, or
                      paste it into the app's Test tab.{" "}
                      <button type="button" className="link-btn" onClick={copyText}>
                        {copied ? "Copied" : "Copy message text"}
                      </button>
                    </>
                  ) : (
                    result.sms.status
                  )}
                </dd>
              </dl>
            </div>
          )}
        </form>

        <PhonePreview institution={institution} message={message} />
      </div>
    </section>
  );
}
