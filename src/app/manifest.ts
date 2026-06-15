import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/basePath";

// Required for `output: export` (the manifest is generated as a static file).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claudio — Personal Time Assistant",
    short_name: "Claudio",
    description: "Plan your day around milestones, chores, training and food.",
    start_url: `${BASE_PATH}/today/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1115",
    theme_color: "#0f1115",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
