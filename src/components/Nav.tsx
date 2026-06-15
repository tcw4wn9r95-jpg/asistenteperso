"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/today", label: "Today", ico: "📅" },
  { href: "/tasks", label: "Tasks", ico: "✅" },
  { href: "/milestones", label: "Goals", ico: "🎯" },
  { href: "/progress", label: "Streaks", ico: "🔥" },
  { href: "/chat", label: "Claudio", ico: "💬" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} className={pathname?.startsWith(it.href) ? "active" : ""}>
          <span className="ico">{it.ico}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
