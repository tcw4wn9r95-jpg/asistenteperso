"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Static-export friendly redirect to the Today screen (the home of the app).
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/today");
  }, [router]);
  return <div className="empty">Opening Claudio…</div>;
}
