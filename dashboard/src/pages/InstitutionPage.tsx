import { FormEvent, useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Seal } from "../components/Seal";
import { useReadySession } from "../session";

export function InstitutionPage() {
  const { institution, role } = useReadySession();
  const readOnly = role === "guest";
  const [name, setName] = useState(institution.name);
  const [senderId, setSenderId] = useState(institution.senderId);
  const [logoUrl, setLogoUrl] = useState(institution.logoUrl);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(institution.name);
    setSenderId(institution.senderId);
    setLogoUrl(institution.logoUrl);
  }, [institution.name, institution.senderId, institution.logoUrl]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await updateDoc(doc(db, "institutions", institution.id), {
        name: name.trim(),
        senderId: senderId.trim().toUpperCase(),
        logoUrl: logoUrl.trim(),
      });
      setStatus("Changes saved. Customers see the new name on their next verified message.");
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Institution</h1>
        <p>This is the identity customers see in the verified header above your messages.</p>
      </header>

      <div className="identity">
        <Seal name={name || institution.name} logoUrl={logoUrl} size={64} />
        <div>
          <div className="identity-name">{name || institution.name}</div>
          <div className={institution.verified ? "status-ok" : "status-pending"}>
            {institution.verified
              ? "✓ Verified institution. Customers see the green verified header."
              : "Pending verification. The registry operator must approve this institution."}
          </div>
          <div className="muted mono small">ID: {institution.id}</div>
        </div>
      </div>

      {readOnly && <p className="muted">Demo mode: the bank profile can only be changed by a bank admin.</p>}

      <form onSubmit={save} className="stack narrow">
        <fieldset disabled={readOnly} className="plain-fieldset stack">
        <label className="field">
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </label>
        <label className="field">
          <span>SMS sender ID</span>
          <input value={senderId} onChange={(e) => setSenderId(e.target.value)} maxLength={11} />
          <small className="field-note">The alphanumeric name your SMS arrives from, up to 11 characters.</small>
        </label>
        <label className="field">
          <span>Logo URL</span>
          <input type="url" placeholder="https://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          <small className="field-note">Square image. Leave empty to show your initials.</small>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {status && <p className="success" role="status">{status}</p>}
        {!readOnly && (
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        )}
        </fieldset>
      </form>

      <div className="note">
        <h2>Message signing</h2>
        <p>
          Each message is fingerprinted with SHA-256 over the recipient's number and the exact message text
          (hash contract v1). The bank's API key is held as a server secret and is never shown in this console.
          Only fingerprints are stored; message text never leaves the send request.
        </p>
      </div>
    </section>
  );
}
