import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

/** Also callable after generation to wire static URLs without re-encoding. */
export async function wireWebp() {
  const generated = await readFile("src/lib/assets/optimized-images.ts", "utf8");
  const map = JSON.parse(generated.match(/const WEBP[^=]*= (\{[\s\S]*?\});/)[1]);
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!/\.(css|tsx?|mjs)$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      let source = await readFile(file, "utf8");
      const original = source;
      // A replaced PNG may no longer benefit from WebP: undo stale literal URLs.
      source = source.replace(/\/(?:assets|game)\/[\w/-]+\.webp/g, (webp) => {
        const png = webp.replace(/\.webp$/, ".png");
        return existsSync("public" + png) ? (map[png] ?? png) : webp;
      });
      for (const [png, webp] of Object.entries(map)) source = source.replaceAll(png, webp);
      if (source.includes("optimizedImage(") && !source.includes("import { optimizedImage }")) {
        source = 'import { optimizedImage } from "@/lib/assets/optimized-images";\n' + source;
      }
      if (source !== original) await writeFile(file, source);
    }
  }
  for (const folder of ["src/components", "src/styles", "src/routes"]) await walk(folder);
}
if (process.argv[1]?.endsWith("wire-webp.mjs")) await wireWebp();
