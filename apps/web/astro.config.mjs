import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// See ADR-0001: one Astro app, deployed as one Cloudflare Worker, with a
// custom worker entry (src/worker.ts) so the same deployable also exports a
// scheduled() handler for monitoring cron (Part 4).
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://crawlpact.com",
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
