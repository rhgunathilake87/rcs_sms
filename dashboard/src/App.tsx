import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { APK_URL, auth, GUEST_MODE, USING_EMULATORS } from "./firebase";
import { useSession } from "./session";
import { Seal } from "./components/Seal";
import { Login } from "./pages/Login";
import { SendPage } from "./pages/SendPage";
import { RegistryPage } from "./pages/RegistryPage";
import { InstitutionPage } from "./pages/InstitutionPage";
import { AppPage } from "./pages/AppPage";

type Page = "send" | "registry" | "app" | "institution";

const NAV: { id: Page; label: string }[] = [
  { id: "send", label: "Send message" },
  { id: "registry", label: "Registry" },
  { id: "app", label: "Android app" },
  { id: "institution", label: "Institution" },
];

export function App() {
  const session = useSession();
  const [page, setPage] = useState<Page>("send");
  const [showLogin, setShowLogin] = useState(false);

  const role = session.state === "ready" ? session.role : null;
  useEffect(() => {
    if (role === "admin") setShowLogin(false);
  }, [role]);

  if (session.state === "loading") return <div className="center muted">Loading…</div>;

  if (session.state === "signedOut") return <Login notice={session.error} />;

  if (session.state === "notAdmin") {
    return (
      <div className="center">
        <div className="stack narrow">
          <h1>No bank access</h1>
          <p>
            {session.user.email} is signed in but isn't linked to an institution. Ask the registry operator to add
            this account as a bank admin.
          </p>
          <button className="btn" onClick={() => signOut(auth)}>
            {GUEST_MODE ? "Back to demo" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  if (showLogin && session.role === "guest") return <Login onBack={() => setShowLogin(false)} />;

  const { institution, user } = session;
  const isGuest = session.role === "guest";

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <Seal name={institution.name} logoUrl={institution.logoUrl} size={40} />
          <div>
            <div className="side-name">{institution.name}</div>
            <div className={institution.verified ? "side-status ok" : "side-status"}>
              {institution.verified ? "✓ Verified sender" : "Pending verification"}
            </div>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "nav-item on" : "nav-item"}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => setPage(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          {USING_EMULATORS && <div className="env-tag">Local emulators</div>}
          {isGuest ? (
            <>
              <div className="side-user">Guest demo</div>
              <button className="link-btn" onClick={() => setShowLogin(true)}>
                Admin sign in
              </button>
            </>
          ) : (
            <>
              <div className="side-user">{user.email}</div>
              <button className="link-btn" onClick={() => signOut(auth)}>
                Sign out
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="main">
        {isGuest && (
          <div className="demo-banner">
            <span>
              <strong>Demo mode.</strong> You're sending as {institution.name}. Use your own phone number, and only you
              will see the messages you send.
            </span>
            {APK_URL && page !== "app" && (
              <button className="link-btn" onClick={() => setPage("app")}>
                Get the Android app
              </button>
            )}
          </div>
        )}
        {page === "send" && <SendPage />}
        {page === "registry" && <RegistryPage />}
        {page === "app" && <AppPage />}
        {page === "institution" && <InstitutionPage />}
      </main>
    </div>
  );
}
