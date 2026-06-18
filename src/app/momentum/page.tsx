"use client";

import { useEffect, useState } from "react";
import { getStreaks, listChores, listGoals, Streak } from "@/lib/model";

export default function MomentumPage() {
  const [rows, setRows] = useState<{ key: string; name: string; s: Streak }[]>([]);

  useEffect(() => {
    const streaks = getStreaks();
    const goals = Object.fromEntries(listGoals().map((g) => [g.id, g.title]));
    const chores = Object.fromEntries(listChores().map((c) => [c.id, c.title]));
    const out: { key: string; name: string; s: Streak }[] = [];
    for (const [key, s] of Object.entries(streaks)) {
      if (s.current === 0 && s.longest === 0) continue;
      let name = key;
      if (key.startsWith("goal:")) name = goals[key.slice(5)] ?? "Goal";
      else if (key.startsWith("chore:")) name = chores[key.slice(6)] ?? "Chore";
      else if (key === "workouts") name = "Workouts";
      else if (key.startsWith("task:")) continue;
      out.push({ key, name, s });
    }
    out.sort((a, b) => b.s.current - a.s.current);
    setRows(out);
  }, []);

  return (
    <>
      <header className="lt"><div><h1>Momentum</h1><div className="sub">Consistency beats intensity.</div></div></header>

      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>
          The science: progress sticks when you show up <b>most</b> days, not <b>every</b> day. Claudio keeps
          your plan flexible and rolls misses forward — so one off day never breaks the chain. Each ✓ you
          log builds the streak below.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="empty"><div className="mark">🔥</div><h2>No streaks yet</h2><p>Check something off on your Week and your first streak begins.</p></div>
      ) : (
        <div className="list">
          {rows.map((r) => (
            <div key={r.key} className="item">
              <div className="item-main" style={{ cursor: "default" }}>
                <div className="item-title">{r.name}</div>
                <div className="item-sub">last done {r.s.last ?? "—"} · best {r.s.longest}</div>
              </div>
              <div className="metric"><div className="big" style={{ color: "var(--orange)" }}>🔥 {r.s.current}</div></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
