import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Семейные финансы",
        short_name: "Финансы",
        description: "Общий учёт доходов, расходов и накоплений",
        lang: "ru",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f4f5f7",
        theme_color: "#46746a",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"]
      }
    })
  ]
});
