"use client";

import { useEffect, useState } from "react";

interface Streak {
  id: string;
  key: string;
  current: number;
  longest: number;
  lastCompletedDate: string | null;
}

export default function ProgressPage() {
  const [streaks, setStreaks] = useState<Streak[]>([]);

  useEffect(() => {
    fetch("/api/accountability/streaks")
      .then((r) => r.json())
      .then(setStreaks);
  }, []);

  return (
    <>
      <div className="topbar">
        <h1>Streaks & accountability</h1>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Consistency beats intensity. Each <b>Done</b> you log keeps a streak alive — and Claudio
        uses these to nudge and rebalance your week.
      </p>
      {streaks.length === 0 ? (
        <div className="empty">No streaks yet — check off something on Today to start one. 🔥</div>
      ) : (
        streaks.map((s) => (
          <div key={s.id} className="block">
            <div style={{ flex: 1 }}>
              <div className="title">{prettyKey(s.key)}</div>
              <div className="tag">last done {s.lastCompletedDate ?? "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>🔥 {s.current}</div>
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
