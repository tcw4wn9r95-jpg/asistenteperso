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
      <div className="topbar">
        <h1>Streaks & accountability</h1>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Consistency beats intensity. Each <b>✓</b> you log on Today keeps a streak alive.
      </p>
      {streaks.length === 0 ? (
        <div className="empty">No streaks yet — check off something on Today to start one. 🔥</div>
      ) : (
        streaks.map((s) => (
          <div key={s.key} className="block">
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
