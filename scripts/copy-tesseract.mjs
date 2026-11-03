// Copia worker e motore WebAssembly di Tesseract.js in public/tesseract (serviti dallo stesso dominio).
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const dest = join(root, "public", "tesseract");
const coreDest = join(dest, "core");
mkdirSync(coreDest, { recursive: true });

const tjs = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(require.resolve("tesseract.js-core/package.json"));
cpSync(join(tjs, "dist", "worker.min.js"), join(dest, "worker.min.js"));
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core.wasm.js", "tesseract-core-simd.wasm.js"]) {
  const src = join(core, f);
  if (existsSync(src)) cpSync(src, join(coreDest, f));
}
console.log("[tesseract] file OCR copiati in public/tesseract");
