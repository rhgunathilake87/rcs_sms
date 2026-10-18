import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, USING_EMULATORS } from "../firebase";

export function Login() {
  const [email, setEmail] = useState(USING_EMULATORS ? "admin@demobank.lk" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(
        code.includes("network")
          ? "Can't reach the sign-in service. Check that the emulators are running."
          : "That email and password don't match a bank admin account."
      );
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-panel">
        <h1 className="login-title">Verified SMS</h1>
        <p className="login-lede">
          Bank console for sending messages your customers can check against the registry.
        </p>

        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>Work email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {USING_EMULATORS && (
          <p className="hint">
            Local emulators: run <code>npm run seed</code> in the backend, then sign in with{" "}
            <code>admin@demobank.lk</code> / <code>demo1234</code>.
          </p>
        )}
      </div>
    </main>
  );
}
