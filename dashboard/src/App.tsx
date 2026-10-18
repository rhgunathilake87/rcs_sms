import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth, USING_EMULATORS } from "./firebase";
import { useSession } from "./session";
import { Seal } from "./components/Seal";
import { Login } from "./pages/Login";
import { SendPage } from "./pages/SendPage";
import { RegistryPage } from "./pages/RegistryPage";
import { InstitutionPage } from "./pages/InstitutionPage";

type Page = "send" | "registry" | "institution";

const NAV: { id: Page; label: string }[] = [
  { id: "send", label: "Send message" },
  { id: "registry", label: "Registry" },
  { id: "institution", label: "Institution" },
];

export function App() {
  const session = useSession();
  const [page, setPage] = useState<Page>("send");

  if (session.state === "loading") return <div className="center muted">Loading…</div>;
  if (session.state === "signedOut") return <Login />;

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
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const { institution, user } = session;

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
          <div className="side-user">{user.email}</div>
          <button className="link-btn" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        {page === "send" && <SendPage />}
        {page === "registry" && <RegistryPage />}
        {page === "institution" && <InstitutionPage />}
      </main>
    </div>
  );
}
