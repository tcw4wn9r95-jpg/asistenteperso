import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TabBar } from "@/components/TabBar";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Claudio",
  description: "A calm weekly companion that always knows the next right thing — and quietly reshuffles when life happens.",
  manifest: "/manifest.webmanifest",
  applicationName: "Claudio",
  appleWebApp: { capable: true, title: "Claudio", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#f2f2f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="app-shell">{children}</main>
        <TabBar />
        <ServiceWorker />
      </body>
    </html>
  );
}
