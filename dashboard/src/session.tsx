import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

export type Institution = {
  id: string;
  name: string;
  logoUrl: string;
  senderId: string;
  verified: boolean;
};

type Session =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "notAdmin"; user: User }
  | { state: "ready"; user: User; institution: Institution };

const SessionContext = createContext<Session>({ state: "loading" });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(() => {
    let stopInstitution: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopInstitution?.();
      stopInstitution = undefined;

      if (!user) {
        setSession({ state: "signedOut" });
        return;
      }

      setSession({ state: "loading" });
      const admin = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
      const institutionId = admin?.exists() ? (admin.get("institutionId") as string) : null;
      if (!institutionId) {
        setSession({ state: "notAdmin", user });
        return;
      }

      stopInstitution = onSnapshot(
        doc(db, "institutions", institutionId),
        (snap) => {
          const d = snap.data() ?? {};
          setSession({
            state: "ready",
            user,
            institution: {
              id: institutionId,
              name: d.name ?? institutionId,
              logoUrl: d.logoUrl ?? "",
              senderId: d.senderId ?? "",
              verified: d.verified === true,
            },
          });
        },
        () => setSession({ state: "notAdmin", user })
      );
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
  if (s.state !== "ready") throw new Error("useReadySession used before sign-in");
  return s;
}
