import { useEffect, useState } from "react";

/** Re-renders every `intervalMs` so countdowns stay live. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Formats +94771234567 as +94 77 123 4567 for readability. */
export function formatPhone(e164: string): string {
  const m = /^\+94(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+94 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Rough SMS segment count: GSM-7 for plain ASCII, UCS-2 otherwise (e.g. Sinhala, Tamil). */
export function smsSegments(text: string): { parts: number; perPart: number; unicode: boolean } {
  const unicode = /[^\x00-\x7F]/.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const len = [...text].length;
  if (len <= single) return { parts: len === 0 ? 0 : 1, perPart: single, unicode };
  return { parts: Math.ceil(len / multi), perPart: multi, unicode };
}

/**
 * Turns a Google Drive share link into a direct-download link.
 * https://drive.google.com/file/d/<ID>/view?usp=sharing -> https://drive.google.com/uc?export=download&id=<ID>
 * Other links are returned unchanged.
 */
export function directDownloadUrl(url: string): string {
  const m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/.exec(url);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}
