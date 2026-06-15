import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Claudio — Personal Time Assistant",
  description: "Plan your day around milestones, chores, training and food — built for chaotic newborn days.",
  manifest: "/manifest.webmanifest",
  applicationName: "Claudio",
  appleWebApp: {
    capable: true,
    title: "Claudio",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // Explicit legacy tag for older iOS Safari to launch full-screen standalone.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
        <Nav />
        <ServiceWorker />
      </body>
    </html>
  );
}
