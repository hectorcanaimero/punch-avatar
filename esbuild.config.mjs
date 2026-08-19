import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const watch = process.argv.includes("--watch");
const outfile = "build/index.js";

mkdirSync(dirname(outfile), { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile,
  platform: "neutral",
  format: "cjs",
  target: "es2020",
  sourcemap: false,
  minify: false,
  // Nakama injects InitModule globals; keep the entry export surface simple.
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("[esbuild] watching src/ → build/index.js");
} else {
  await esbuild.build(options);
  console.log(`[esbuild] wrote ${outfile}`);
}
