"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  week: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>),
  goals: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /></svg>),
  chores: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h3l1.5 12.5a1 1 0 0 0 1 .9h4l1-13M9 7V4.5a1.5 1.5 0 0 1 3 0V7M7 7h13" /></svg>),
  momentum: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 19V5M9 19v-7M14 19v-10M19 19V8" strokeLinecap="round" /></svg>),
  settings: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.87-1.2l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 13.5H4.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 6.3 6.7l-.05-.05A2 2 0 1 1 9.08 3.8l.05.05a1.7 1.7 0 0 0 1.87.34H11a1.7 1.7 0 0 0 1-1.55V2.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05a1.7 1.7 0 0 0-.34 1.87V9.5a1.7 1.7 0 0 0 1.55 1H21.5a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" /></svg>),
};

const TABS = [
  { href: "/", key: "week", label: "Week" },
  { href: "/goals", key: "goals", label: "Goals" },
  { href: "/chores", key: "chores", label: "Chores" },
  { href: "/momentum", key: "momentum", label: "Momentum" },
  { href: "/settings", key: "settings", label: "Settings" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const active = t.href === "/" ? path === "/" : path?.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            <span className="ico">{ICONS[t.key]}</span>
            <span className="lbl">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
