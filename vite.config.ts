// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Some Solana dependencies (rpc-websockets and the 2.0.0-rc.1 @solana/codecs family pulled in by
// @solana/spl-token) only export "browser" and "node" builds, so the Worker server build cannot
// resolve them. Several nested copies exist, so resolve each import to the browser build of the
// copy that the importing file would load; the browser builds use only Web APIs the Worker has.
const BROWSER_ONLY_EXPORTS = /^(rpc-websockets|@solana\/(codecs|codecs-core|codecs-numbers|codecs-strings|codecs-data-structures|errors|options))$/;
const projectRoot = dirname(fileURLToPath(import.meta.url));

function findBrowserBuild(pkg: string, importer: string | undefined): string | null {
  let dir = importer ? dirname(importer.split("?")[0] ?? importer) : projectRoot;
  for (;;) {
    const candidate = join(dir, "node_modules", pkg, "dist", "index.browser.mjs");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const browserBuildForWorkerless: Plugin = {
  name: "diademfall:browser-only-exports",
  enforce: "pre",
  resolveId(source, importer) {
    if (!BROWSER_ONLY_EXPORTS.test(source)) return null;
    return findBrowserBuild(source, importer);
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [browserBuildForWorkerless],
});
