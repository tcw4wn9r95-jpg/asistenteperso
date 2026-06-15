"use client";

import { useEffect, useState } from "react";
import { listStreaks } from "@/lib/engine";
import type { StoredStreak } from "@/lib/store";

export default function ProgressPage() {
  const [streaks, setStreaks] = useState<StoredStreak[]>([]);

  useEffect(() => {
    setStreaks(listStreaks());
  }, []);

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Accountability</p>
        <h1 className="display">Streaks</h1>
      </header>
      <p className="muted small">Consistency beats intensity. Each <b>✓</b> you log on Today keeps a streak alive.</p>
      {streaks.length === 0 ? (
        <div className="empty hero" style={{ marginTop: 12 }}>
          <div className="hero-mark">🔥</div>
          <h2>No streaks yet</h2>
          <p>Mark something done on Today and your first streak begins. Small, steady wins.</p>
        </div>
      ) : (
        streaks.map((s) => (
          <div key={s.key} className="item-row">
            <div style={{ flex: 1 }}>
              <div className="title">{prettyKey(s.key)}</div>
              <div className="tag">last done {s.lastCompletedDate ?? "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="streak-num">🔥 {s.current}</div>
              <div className="tag">best {s.longest}</div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function prettyKey(key: string): string {
  const [type, rest] = key.split(":");
  if (!rest) return key;
  return `${rest.charAt(0).toUpperCase()}${rest.slice(1)} (${type})`;
}
