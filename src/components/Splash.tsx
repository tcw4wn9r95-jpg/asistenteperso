"use client";

import { useEffect, useState } from "react";
import { Logo } from "./Logo";

// A brief branded launch screen (like Coach Claudio): the mark + wordmark on the
// brand gradient, shown once per app load, then it fades out. Sits above
// everything and ignores pointer events while fading so it never traps a tap.
export function Splash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const fade = setTimeout(() => setPhase("out"), 1100);
    const done = setTimeout(() => setPhase("gone"), 1600);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`splash ${phase === "out" ? "splash-out" : ""}`} aria-hidden>
      <div className="splash-inner">
        <div className="splash-mark"><Logo size={92} /></div>
        <div className="splash-word">Claudio</div>
        <div className="splash-tag">your calm weekly companion</div>
      </div>
    </div>
  );
}
