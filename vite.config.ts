import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

/**
 * Dev only: open the embedded PGLite database and apply `migrations/*.sql`
 * before the first request, so the first page load doesn't pay for it.
 * In production `src/lib/db.ts` does the same on import.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "patrimonio:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (process.env.DATABASE_URL?.trim()) return;
      const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
        ensureDbReady: () => Promise<void>;
      };
      await mod.ensureDbReady();
    },
  };
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default defineConfig(({ command, isPreview }) => ({
  server: { host: "0.0.0.0", port: 8080 },
  preview: { host: "127.0.0.1", port: 8081 },
  resolve: { tsconfigPaths: true },
  // PGLite ships wasm + data files next to its JS; bundling it into the SSR
  // chunk loses them. Keep it external so the no-DATABASE_URL fallback also
  // works from a production build (Nitro copies it into .output/server).
  ssr: { external: ["@electric-sql/pglite"] },
  plugins: [
    pgliteBootstrapPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: process.env.NITRO_PRESET || "node-server",
            // Full-copy PGLite (wasm + data files are loaded from disk at runtime).
            traceDeps: ["@electric-sql/pglite*"],
            routeRules: {
              "/**": { headers: SECURITY_HEADERS },
              "/assets/**": {
                headers: {
                  "Cache-Control": "public, max-age=31536000, immutable",
                },
              },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
