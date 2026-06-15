"use client";

import { useRef, useState } from "react";

export interface TimelineBlock {
  id: string;
  title: string;
  startMin: number; // minutes from local midnight
  endMin: number;
  kind: string;
  locked: boolean;
}

const PX_PER_MIN = 0.9; // drag sensitivity
const SNAP_MIN = 15;

function fmt(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
}
function dur(b: TimelineBlock): string {
  const d = b.endMin - b.startMin;
  return d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ""}` : `${d}m`;
}
function kindLabel(kind: string): string {
  switch (kind) {
    case "PASSIVE_WAIT": return "Hands-free";
    case "INTEGRATION": return "From your apps";
    default: return "Focus";
  }
}

export function Timeline({
  blocks,
  approved,
  onMove,
  onNudge,
  onCheckIn,
}: {
  blocks: TimelineBlock[];
  approved: boolean;
  onMove: (blockId: string, deltaMin: number) => void;
  onNudge: (blockId: string, deltaMin: number) => void;
  onCheckIn: (blockId: string, outcome: "DONE" | "SKIPPED") => void;
}) {
  const [drag, setDrag] = useState<{ id: string; deltaMin: number } | null>(null);
  const origin = useRef<{ y: number } | null>(null);

  if (blocks.length === 0) return null;

  function down(e: React.PointerEvent, b: TimelineBlock) {
    if (b.kind === "PASSIVE_WAIT") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    origin.current = { y: e.clientY };
    setDrag({ id: b.id, deltaMin: 0 });
  }
  function move(e: React.PointerEvent) {
    if (!drag || !origin.current) return;
    const snapped = Math.round((e.clientY - origin.current.y) / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
    if (snapped !== drag.deltaMin) setDrag({ ...drag, deltaMin: snapped });
  }
  function up(b: TimelineBlock) {
    if (drag && drag.id === b.id && drag.deltaMin !== 0) onMove(b.id, drag.deltaMin);
    origin.current = null;
    setDrag(null);
  }

  return (
    <div className="agenda">
      {blocks.map((b) => {
        const isDrag = drag?.id === b.id;
        const delta = isDrag ? drag!.deltaMin : 0;
        const passive = b.kind === "PASSIVE_WAIT";
        const cls = passive ? "passive" : b.kind === "INTEGRATION" ? "integration" : "";
        return (
          <div key={b.id} className={`agenda-item ${cls} ${isDrag ? "dragging" : ""}`}>
            <div className="atime">
              <span className="t1">{fmt(b.startMin + delta)}</span>
              <span className="t2">{fmt(b.endMin + delta)}</span>
            </div>
            <div className="abody">
              <div className="atitle">{b.title}</div>
              <div className="ameta">
                {kindLabel(b.kind)} · {dur(b)}
                {b.locked ? " · pinned" : ""}
                {isDrag && delta !== 0 ? `  (${delta > 0 ? "+" : ""}${delta}m)` : ""}
              </div>
              {approved && !passive && (
                <div className="intention">✦ I will {b.title.toLowerCase()} at {fmt(b.startMin + delta)}</div>
              )}
            </div>
            {!passive && (
              <div className="aacts">
                <span className="grip" onPointerDown={(e) => down(e, b)} onPointerMove={move} onPointerUp={() => up(b)} title="Drag to reschedule">⠿</span>
                <div className="nudge">
                  <button className="icon-btn sm" onClick={() => onNudge(b.id, -15)} aria-label="15 minutes earlier">−</button>
                  <button className="icon-btn sm" onClick={() => onNudge(b.id, 15)} aria-label="15 minutes later">+</button>
                </div>
                <button className="icon-btn ok" onClick={() => onCheckIn(b.id, "DONE")} aria-label="Done">✓</button>
                <button className="icon-btn" onClick={() => onCheckIn(b.id, "SKIPPED")} aria-label="Skip">✕</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
