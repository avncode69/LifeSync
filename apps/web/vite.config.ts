import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [
    vinext(),
    ...(process.env.CLOUDFLARE_BUILD === "1"
      ? [cloudflare({ configPath: "wrangler.web.jsonc", viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } })]
      : []),
  ],
  server: { proxy: { "/api": { target: process.env.API_URL ?? "http://127.0.0.1:8787", changeOrigin: false } } },
});
