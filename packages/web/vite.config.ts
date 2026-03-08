import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["vite.svg", "pwa-icon.svg", "pwa-maskable-icon.svg"],
      manifest: {
        name: "Web App",
        short_name: "Web",
        description: "A Progressive Web App built with Vite",
        theme_color: "#ef5e41",
        background_color: "#02040f",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Allow large assets (e.g. pixel-office-bg.png ~5.7 MB) to be precached
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Disable minification to avoid terser/rollup compatibility issues with Vite 7
        mode: "development",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 89,
        statements: 90,
      },
      exclude: [
        "node_modules",
        "**/*.test.{ts,tsx}",
        "**/*.config.{ts,js}",
        "**/components/ui/**",
        "**/components/*-example.tsx",
        "**/pages/**/__tests__/**",
        "**/App.css",
        // Excluded from coverage only (tests still run): Radix tab/viewMode branches and ref callbacks are hard to cover
        "**/pages/Office.tsx",
      ],
    },
  },
});
