import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/basePath";

// Required for `output: export` (the manifest is generated as a static file).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claudio",
    short_name: "Claudio",
    description: "A calm weekly companion that always knows the next right thing — and quietly reshuffles when life happens.",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#6366f1",
    theme_color: "#eef0f6",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
