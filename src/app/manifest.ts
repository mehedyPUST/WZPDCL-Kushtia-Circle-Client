import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WZPDCL Load Calculator",
    short_name: "WZPDCL Load",
    description:
      "33/11 kV power substation load calculator for WZPDCL Bottail-Kushtia. Works offline for basic feeder MW calculations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: "#080d16",
    background_color: "#080d16",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Load Calculator",
        short_name: "Calculator",
        description: "Open 33/11 kV Feeder Load Calculator",
        url: "/calculator",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
