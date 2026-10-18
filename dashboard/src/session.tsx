import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db, GUEST_INSTITUTION_ID, GUEST_MODE } from "./firebase";

export type Institution = {
  id: string;
  name: string;
  logoUrl: string;
  senderId: string;
  verified: boolean;
};

export type Role = "admin" | "guest";

type Session =
  | { state: "loading" }
  | { state: "signedOut"; error?: string }
  | { state: "notAdmin"; user: User }
  | { state: "ready"; user: User; role: Role; institution: Institution };

const SessionContext = createContext<Session>({ state: "loading" });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(() => {
    let stopInstitution: (() => void) | undefined;

    function watchInstitution(user: User, role: Role, institutionId: string) {
      stopInstitution = onSnapshot(
        doc(db, "institutions", institutionId),
        (snap) => {
          const d = snap.data() ?? {};
          setSession({
            state: "ready",
            user,
            role,
            institution: {
              id: institutionId,
              name: d.name ?? institutionId,
              logoUrl: d.logoUrl ?? "",
              senderId: d.senderId ?? "",
              verified: d.verified === true,
            },
          });
        },
        () =>
          role === "admin"
            ? setSession({ state: "notAdmin", user })
            : setSession({ state: "signedOut", error: "The demo bank isn't set up yet." })
      );
    }

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopInstitution?.();
      stopInstitution = undefined;

      // No one signed in: enter as a guest automatically (no login page).
      if (!user) {
        if (!GUEST_MODE) {
          setSession({ state: "signedOut" });
          return;
        }
        setSession({ state: "loading" });
        signInAnonymously(auth).catch(() =>
          setSession({
            state: "signedOut",
            error: "Guest access is unavailable. Enable Anonymous sign-in in Firebase Authentication.",
          })
        );
        return;
      }

      setSession({ state: "loading" });

      if (user.isAnonymous) {
        watchInstitution(user, "guest", GUEST_INSTITUTION_ID);
        return;
      }

      const admin = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
      const institutionId = admin?.exists() ? (admin.get("institutionId") as string) : null;
      if (!institutionId) {
        setSession({ state: "notAdmin", user });
        return;
      }
      watchInstitution(user, "admin", institutionId);
    });

    return () => {
      stopAuth();
      stopInstitution?.();
    };
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

/** Use inside screens that are only rendered when the session is ready. */
export function useReadySession() {
  const s = useSession();
  if (s.state !== "ready") throw new Error("useReadySession used before the session is ready");
  return s;
}
