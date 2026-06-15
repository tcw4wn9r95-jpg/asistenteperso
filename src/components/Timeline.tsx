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

const PX_PER_MIN = 1.1;
const SNAP_MIN = 15;

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function Timeline({
  blocks,
  onMove,
  onCheckIn,
}: {
  blocks: TimelineBlock[];
  onMove: (blockId: string, deltaMin: number) => void;
  onCheckIn: (blockId: string, outcome: "DONE" | "SKIPPED") => void;
}) {
  const [drag, setDrag] = useState<{ id: string; deltaMin: number } | null>(null);
  const origin = useRef<{ y: number } | null>(null);

  if (blocks.length === 0) return null;

  const dayStart = Math.floor((Math.min(...blocks.map((b) => b.startMin)) - 30) / 60) * 60;
  const dayEnd = Math.ceil((Math.max(...blocks.map((b) => b.endMin)) + 30) / 60) * 60;
  const height = (dayEnd - dayStart) * PX_PER_MIN;

  const hourLines: number[] = [];
  for (let m = dayStart; m <= dayEnd; m += 60) hourLines.push(m);

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
    <div className="timeline" style={{ height }}>
      {hourLines.map((m) => (
        <div key={m} className="hourline" style={{ top: (m - dayStart) * PX_PER_MIN }}>
          <span>{fmt(m)}</span>
        </div>
      ))}

      {blocks.map((b) => {
        const isDrag = drag?.id === b.id;
        const delta = isDrag ? drag!.deltaMin : 0;
        const top = (b.startMin - dayStart + delta) * PX_PER_MIN;
        const blockHeight = Math.max(28, (b.endMin - b.startMin) * PX_PER_MIN - 4);
        const movable = b.kind !== "PASSIVE_WAIT";
        return (
          <div
            key={b.id}
            className={`tblock ${b.kind === "PASSIVE_WAIT" ? "passive" : ""} ${b.kind === "INTEGRATION" ? "integration" : ""} ${isDrag ? "dragging" : ""}`}
            style={{ top, height: blockHeight }}
          >
            {movable && (
              <span className="grip" onPointerDown={(e) => down(e, b)} onPointerMove={move} onPointerUp={() => up(b)} title="Drag to reschedule">
                ⠿
              </span>
            )}
            <div className="tbody">
              <div className="ttitle">{b.title}</div>
              <div className="ttime">
                {fmt(b.startMin + delta)}–{fmt(b.endMin + delta)}
                {b.locked ? " · pinned" : ""}
                {isDrag && delta !== 0 ? `  (${delta > 0 ? "+" : ""}${delta}m)` : ""}
              </div>
            </div>
            {movable && (
              <div className="tactions">
                <button className="btn ghost" onClick={() => onCheckIn(b.id, "DONE")}>✓</button>
                <button className="btn ghost" onClick={() => onCheckIn(b.id, "SKIPPED")}>✗</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
