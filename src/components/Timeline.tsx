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

interface Metric { id: string; top: number; height: number; center: number }

export function Timeline({
  blocks,
  approved,
  onReorder,
  onCheckIn,
}: {
  blocks: TimelineBlock[];
  approved: boolean;
  // Reschedule the dragged block so it begins at `newStartMin`.
  onReorder: (blockId: string, newStartMin: number) => void;
  onCheckIn: (blockId: string, outcome: "DONE" | "SKIPPED") => void;
}) {
  const [drag, setDrag] = useState<{ id: string; dy: number; target: number } | null>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const metrics = useRef<Metric[]>([]);
  const startY = useRef(0);

  if (blocks.length === 0) return null;
  const order = blocks; // already sorted by start

  function measure() {
    metrics.current = order.map((b) => {
      const el = els.current.get(b.id)!;
      const r = el.getBoundingClientRect();
      return { id: b.id, top: r.top, height: r.height, center: r.top + r.height / 2 };
    });
  }

  function down(e: React.PointerEvent, b: TimelineBlock) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    measure();
    startY.current = e.clientY;
    setDrag({ id: b.id, dy: 0, target: order.findIndex((x) => x.id === b.id) });
  }

  function move(e: React.PointerEvent) {
    if (!drag) return;
    const dy = e.clientY - startY.current;
    const fromIdx = order.findIndex((x) => x.id === drag.id);
    const projectedCenter = metrics.current[fromIdx].center + dy;
    // Target index = how many *other* items sit above the projected center.
    let target = 0;
    metrics.current.forEach((m, i) => {
      if (i !== fromIdx && m.center < projectedCenter) target++;
    });
    if (dy !== drag.dy || target !== drag.target) setDrag({ id: drag.id, dy, target });
  }

  function up() {
    if (!drag) return;
    const fromIdx = order.findIndex((x) => x.id === drag.id);
    if (drag.target !== fromIdx) {
      // Build the final order and place the block right after its new predecessor.
      const ids = order.map((b) => b.id).filter((id) => id !== drag.id);
      ids.splice(drag.target, 0, drag.id);
      const pos = ids.indexOf(drag.id);
      const prev = pos > 0 ? blocks.find((b) => b.id === ids[pos - 1])! : null;
      const newStart = prev ? prev.endMin : Math.min(...blocks.map((b) => b.startMin));
      onReorder(drag.id, newStart);
    }
    setDrag(null);
  }

  // Compute the live vertical shift for each item while dragging.
  function shiftFor(index: number): number {
    if (!drag) return 0;
    const fromIdx = order.findIndex((x) => x.id === drag.id);
    if (index === fromIdx) return drag.dy;
    const h = metrics.current[fromIdx]?.height ?? 0;
    const gap = 10;
    if (drag.target > fromIdx && index > fromIdx && index <= drag.target) return -(h + gap);
    if (drag.target < fromIdx && index >= drag.target && index < fromIdx) return h + gap;
    return 0;
  }

  return (
    <div className="agenda">
      {order.map((b, i) => {
        const passive = b.kind === "PASSIVE_WAIT";
        const cls = passive ? "passive" : b.kind === "INTEGRATION" ? "integration" : "";
        const dragging = drag?.id === b.id;
        return (
          <div
            key={b.id}
            ref={(el) => { if (el) els.current.set(b.id, el); else els.current.delete(b.id); }}
            className={`agenda-item ${cls} ${dragging ? "dragging" : ""}`}
            style={{ transform: `translateY(${shiftFor(i)}px)`, transition: drag && !dragging ? "transform 0.16s ease" : "none", zIndex: dragging ? 5 : 1 }}
          >
            <div
              className="drag-handle"
              onPointerDown={(e) => down(e, b)}
              onPointerMove={move}
              onPointerUp={up}
              title="Drag to reschedule"
            >⠿</div>
            <div className="atime">
              <span className="t1">{fmt(b.startMin)}</span>
              <span className="t2">{fmt(b.endMin)}</span>
            </div>
            <div className="abody">
              <div className="atitle">{b.title}</div>
              <div className="ameta">
                {kindLabel(b.kind)} · {dur(b)}{b.locked ? " · pinned" : ""}
              </div>
              {approved && !passive && (
                <div className="intention">✦ I will {b.title.toLowerCase()} at {fmt(b.startMin)}</div>
              )}
            </div>
            {!passive && (
              <div className="aacts">
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
