import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claudio — Personal Time Assistant",
    short_name: "Claudio",
    description: "Plan your day around milestones, chores, training and food.",
    start_url: "/today",
    display: "standalone",
    background_color: "#0f1115",
    theme_color: "#0f1115",
    icons: [],
  };
}
