import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { useReadySession } from "../session";
import { formatDateTime, formatDuration, formatPhone, useNow } from "../util";

type Entry = {
  hash: string;
  recipient: string;
  createdAt: number;
  expiresAt: number;
  ttlSeconds: number;
  queryHits: number;
  lastQueriedAt: number | null;
};

type Filter = "all" | "active" | "expired";

const ms = (t: unknown): number | null => (t instanceof Timestamp ? t.toMillis() : null);

export function RegistryPage() {
  const { institution, role, user } = useReadySession();
  const isGuest = role === "guest";
  const now = useNow(1000);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [copiedHash, setCopiedHash] = useState("");

  useEffect(() => {
    // Admins see their whole institution; guests see only the messages they sent.
    const q = query(
      collection(db, "messageRegistry"),
      isGuest ? where("createdByUid", "==", user.uid) : where("institutionId", "==", institution.id),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    return onSnapshot(
      q,
      (snap) => {
        setError("");
        setEntries(
          snap.docs.map((d) => {
            const v = d.data();
            const createdAt = ms(v.createdAt) ?? 0;
            const expiresAt = ms(v.expiresAt) ?? 0;
            return {
              hash: d.id,
              recipient: v.recipient ?? "",
              createdAt,
              expiresAt,
              ttlSeconds: v.ttlSeconds ?? Math.round((expiresAt - createdAt) / 1000),
              queryHits: v.queryHits ?? 0,
              lastQueriedAt: ms(v.lastQueriedAt),
            };
          })
        );
      },
      (err) => setError(`Can't load the registry: ${err.message}`)
    );
  }, [institution.id, isGuest, user.uid]);

  const shown = useMemo(() => {
    if (!entries) return [];
    if (filter === "active") return entries.filter((e) => e.expiresAt > now);
    if (filter === "expired") return entries.filter((e) => e.expiresAt <= now);
    return entries;
  }, [entries, filter, now]);

  const activeCount = entries?.filter((e) => e.expiresAt > now).length ?? 0;
  const totalChecks = entries?.reduce((sum, e) => sum + e.queryHits, 0) ?? 0;

  async function copy(hash: string) {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Registry</h1>
        <p>
          <span className="live-dot" aria-hidden="true" /> Updates live as messages are sent and checked.{" "}
          {isGuest && "You see only the messages sent from this browser. "}
          {entries && (
            <>
              {activeCount} active of the latest {entries.length}, with {totalChecks} phone check
              {totalChecks === 1 ? "" : "s"}.
            </>
          )}
        </p>
      </header>

      <div className="segmented" role="radiogroup" aria-label="Filter by status">
        {(["all", "active", "expired"] as Filter[]).map((f) => (
          <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "active" ? "Active" : "Expired"}
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {entries === null && !error && <p className="muted">Loading registry…</p>}

      {entries && shown.length === 0 && (
        <div className="empty">
          {entries.length === 0
            ? "No messages registered yet. Send one from the Send page and it will appear here."
            : "No messages match this filter."}
        </div>
      )}

      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="registry">
            <thead>
              <tr>
                <th>Sent</th>
                <th>Recipient</th>
                <th>Fingerprint</th>
                <th>Status</th>
                <th>Time left</th>
                <th className="num">Checks</th>
                <th>Last check</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const left = e.expiresAt - now;
                const active = left > 0;
                const fraction = Math.max(0, Math.min(1, left / (e.ttlSeconds * 1000)));
                return (
                  <tr key={e.hash}>
                    <td>{formatDateTime(e.createdAt)}</td>
                    <td className="mono">{formatPhone(e.recipient)}</td>
                    <td>
                      <button className="hash-btn mono" onClick={() => copy(e.hash)} title="Copy full fingerprint">
                        {e.hash.slice(0, 10)}…{e.hash.slice(-4)}
                        <span className="sr-only">{copiedHash === e.hash ? " copied" : " copy"}</span>
                      </button>
                    </td>
                    <td>
                      <span className={active ? "pill pill-active" : "pill pill-expired"}>
                        {active ? "Active" : "Expired"}
                      </span>
                    </td>
                    <td>
                      {active ? (
                        <div className="ttl">
                          <div className="ttl-bar">
                            <div className="ttl-fill" style={{ width: `${fraction * 100}%` }} />
                          </div>
                          <span className="mono">{formatDuration(left)}</span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num">{e.queryHits}</td>
                    <td>{e.lastQueriedAt ? formatDateTime(e.lastQueriedAt) : <span className="muted">Never</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
