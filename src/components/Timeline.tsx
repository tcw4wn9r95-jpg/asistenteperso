"use client";

import { useRef, useState } from "react";

export interface TimelineBlock {
  id: string;
  title: string;
  start: string; // ISO
  end: string;
  kind: string;
  locked: boolean;
  source: string;
}

const PX_PER_MIN = 1.1;
const SNAP_MIN = 15;

function localMin(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
function fmt(iso: string, offsetMin = 0): string {
  const d = new Date(new Date(iso).getTime() + offsetMin * 60000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Timeline({
  blocks,
  onMove,
  onCheckIn,
}: {
  blocks: TimelineBlock[];
  onMove: (blockId: string, newStartISO: string, newEndISO: string) => void;
  onCheckIn: (blockId: string, outcome: "DONE" | "SKIPPED") => void;
}) {
  const [drag, setDrag] = useState<{ id: string; deltaMin: number } | null>(null);
  const origin = useRef<{ y: number } | null>(null);

  if (blocks.length === 0) return null;

  // Day window: pad 30 min around the planned range, clamp to whole hours.
  const starts = blocks.map((b) => localMin(b.start));
  const ends = blocks.map((b) => localMin(b.end));
  const dayStart = Math.floor((Math.min(...starts) - 30) / 60) * 60;
  const dayEnd = Math.ceil((Math.max(...ends) + 30) / 60) * 60;
  const height = (dayEnd - dayStart) * PX_PER_MIN;

  const hourLines: number[] = [];
  for (let m = dayStart; m <= dayEnd; m += 60) hourLines.push(m);

  function pointerDown(e: React.PointerEvent, block: TimelineBlock) {
    if (block.kind === "PASSIVE_WAIT") return; // waits move with their task
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    origin.current = { y: e.clientY };
    setDrag({ id: block.id, deltaMin: 0 });
  }
  function pointerMove(e: React.PointerEvent) {
    if (!drag || !origin.current) return;
    const rawMin = (e.clientY - origin.current.y) / PX_PER_MIN;
    const snapped = Math.round(rawMin / SNAP_MIN) * SNAP_MIN;
    if (snapped !== drag.deltaMin) setDrag({ ...drag, deltaMin: snapped });
  }
  function pointerUp(block: TimelineBlock) {
    if (drag && drag.id === block.id && drag.deltaMin !== 0) {
      const ns = new Date(new Date(block.start).getTime() + drag.deltaMin * 60000);
      const ne = new Date(new Date(block.end).getTime() + drag.deltaMin * 60000);
      onMove(block.id, ns.toISOString(), ne.toISOString());
    }
    origin.current = null;
    setDrag(null);
  }

  return (
    <div className="timeline" style={{ height }}>
      {hourLines.map((m) => (
        <div key={m} className="hourline" style={{ top: (m - dayStart) * PX_PER_MIN }}>
          <span>{String(Math.floor(m / 60)).padStart(2, "0")}:00</span>
        </div>
      ))}

      {blocks.map((b) => {
        const isDrag = drag?.id === b.id;
        const delta = isDrag ? drag!.deltaMin : 0;
        const top = (localMin(b.start) - dayStart + delta) * PX_PER_MIN;
        const blockHeight = Math.max(28, (localMin(b.end) - localMin(b.start)) * PX_PER_MIN - 4);
        const movable = b.kind !== "PASSIVE_WAIT";
        return (
          <div
            key={b.id}
            className={`tblock ${b.kind === "PASSIVE_WAIT" ? "passive" : ""} ${b.kind === "INTEGRATION" ? "integration" : ""} ${isDrag ? "dragging" : ""}`}
            style={{ top, height: blockHeight }}
          >
            {movable && (
              <span
                className="grip"
                onPointerDown={(e) => pointerDown(e, b)}
                onPointerMove={pointerMove}
                onPointerUp={() => pointerUp(b)}
                title="Drag to reschedule"
              >
                ⠿
              </span>
            )}
            <div className="tbody">
              <div className="ttitle">{b.title}</div>
              <div className="ttime">
                {fmt(b.start, delta)}–{fmt(b.end, delta)}
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
