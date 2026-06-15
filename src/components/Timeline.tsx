"use client";

import { useRef, useState } from "react";

export interface TimelineBlock {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  kind: string;
  locked: boolean;
  outcome?: "DONE" | "SKIPPED";
}

function fmt(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
}
function dur(b: TimelineBlock): string {
  const d = b.endMin - b.startMin;
  return d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}` : ""}` : `${d} min`;
}
function kindLabel(kind: string): string {
  if (kind === "PASSIVE_WAIT") return "hands-free";
  if (kind === "INTEGRATION") return "from your apps";
  return "focus";
}

interface Metric { id: string; center: number; height: number }

export function Agenda({
  blocks,
  nowMin,
  onComplete,
  onReorder,
  onOpen,
}: {
  blocks: TimelineBlock[];
  nowMin?: number;
  onComplete: (id: string) => void;
  onReorder: (id: string, newStartMin: number) => void;
  onOpen: (block: TimelineBlock) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; dy: number; target: number } | null>(null);
  const els = useRef(new Map<string, HTMLLIElement>());
  const metrics = useRef<Metric[]>([]);
  const startY = useRef(0);

  if (blocks.length === 0) return null;
  const order = blocks;

  // Focus block: the one happening now, else the next not-yet-done item.
  let focusId: string | null = null;
  if (nowMin != null) {
    const current = order.find((b) => b.startMin <= nowMin && nowMin < b.endMin && !b.outcome);
    focusId = (current ?? order.find((b) => b.startMin >= nowMin && !b.outcome))?.id ?? null;
  }

  function measure() {
    metrics.current = order.map((b) => {
      const r = els.current.get(b.id)!.getBoundingClientRect();
      return { id: b.id, center: r.top + r.height / 2, height: r.height };
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
    const from = order.findIndex((x) => x.id === drag.id);
    const projected = metrics.current[from].center + dy;
    let target = 0;
    metrics.current.forEach((m, i) => { if (i !== from && m.center < projected) target++; });
    if (dy !== drag.dy || target !== drag.target) setDrag({ id: drag.id, dy, target });
  }
  function up() {
    if (!drag) return;
    const from = order.findIndex((x) => x.id === drag.id);
    if (drag.target !== from) {
      const ids = order.map((b) => b.id).filter((id) => id !== drag.id);
      ids.splice(drag.target, 0, drag.id);
      const pos = ids.indexOf(drag.id);
      const prev = pos > 0 ? blocks.find((b) => b.id === ids[pos - 1])! : null;
      onReorder(drag.id, prev ? prev.endMin : Math.min(...blocks.map((b) => b.startMin)));
    }
    setDrag(null);
  }
  function shiftFor(i: number): number {
    if (!drag) return 0;
    const from = order.findIndex((x) => x.id === drag.id);
    if (i === from) return drag.dy;
    const h = (metrics.current[from]?.height ?? 0) + 8;
    if (drag.target > from && i > from && i <= drag.target) return -h;
    if (drag.target < from && i >= drag.target && i < from) return h;
    return 0;
  }

  return (
    <ul className="agenda">
      {order.map((b, i) => {
        const passive = b.kind === "PASSIVE_WAIT";
        const done = b.outcome === "DONE";
        const skipped = b.outcome === "SKIPPED";
        const isFocus = b.id === focusId;
        const current = nowMin != null && b.startMin <= nowMin && nowMin < b.endMin;
        const dragging = drag?.id === b.id;
        const classes = [
          "trow",
          passive ? "passive" : "",
          done ? "done" : "",
          skipped ? "skipped" : "",
          isFocus ? "focus" : "",
          b.kind === "INTEGRATION" ? "integration" : "",
          dragging ? "dragging" : "",
        ].filter(Boolean).join(" ");
        return (
          <li
            key={b.id}
            ref={(el) => { if (el) els.current.set(b.id, el); else els.current.delete(b.id); }}
            className={classes}
            style={{ transform: `translateY(${shiftFor(i)}px)`, transition: drag && !dragging ? "transform .16s ease" : "none", zIndex: dragging ? 5 : 1 }}
          >
            {passive ? (
              <span className="check ghost" aria-hidden>⏳</span>
            ) : (
              <button className="check" aria-label={done ? "Mark not done" : "Mark done"} aria-pressed={done} onClick={() => onComplete(b.id)}>
                {done ? "✓" : ""}
              </button>
            )}

            <button className="trow-main" onClick={() => onOpen(b)}>
              {isFocus && <span className="now-chip">{current ? "Now" : "Up next"}</span>}
              <span className="trow-title">{b.title}</span>
              <span className="trow-sub">{fmt(b.startMin)}–{fmt(b.endMin)} · {kindLabel(b.kind)} · {dur(b)}{skipped ? " · skipped" : ""}{b.locked ? " · pinned" : ""}</span>
            </button>

            {!passive && (
              <span className="reorder" onPointerDown={(e) => down(e, b)} onPointerMove={move} onPointerUp={up} title="Drag to reschedule" aria-label="Drag to reschedule">⠿</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
