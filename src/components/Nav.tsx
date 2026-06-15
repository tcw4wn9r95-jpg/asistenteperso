"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON: Record<string, React.ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 11l2 2 4-4" /><rect x="3.5" y="3.5" width="17" height="17" rx="3" /></svg>
  ),
  goals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></svg>
  ),
  streaks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3c1.5 3-1.5 4.5-1.5 7A3 3 0 0 0 15 12c.6 2.5-.5 4-3 6-3.5-1-6-3.5-6-7 0-4 4-5.5 6-8z" /></svg>
  ),
  claudio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3.5V7a2 2 0 0 1 2-2z" /></svg>
  ),
};

const ITEMS = [
  { href: "/today", label: "Today", key: "today" },
  { href: "/tasks", label: "Tasks", key: "tasks" },
  { href: "/milestones", label: "Goals", key: "goals" },
  { href: "/progress", label: "Streaks", key: "streaks" },
  { href: "/chat", label: "Claudio", key: "claudio" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} className={pathname?.startsWith(it.href) ? "active" : ""}>
          <span className="ico">{ICON[it.key]}</span>
          <span className="lbl">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
