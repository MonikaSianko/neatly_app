import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neatly — Family Budget",
    short_name: "Neatly",
    description: "Budżet rodzinny. Money, neatly.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBFBFB",
    theme_color: "#FBFBFB",
    icons: [
      {
        src: "/neatly-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
